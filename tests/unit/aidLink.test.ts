import { describe, expect, it } from "vitest";
import { diff } from "@/core/diff";
import { parseLua } from "@/core/lua";
import { canonical, merge } from "@/core/merge";
import type { Dataset } from "@/core/model";
import { finalize, normalize } from "@/core/normalize";

// WEB-86: someone known only through the guild is stored under "aid:<accountId>", without a display name or
// BattleTag. They are named after their first character, and become their BattleTag's person once a file proves it.

const upload = (body: string): Dataset => normalize(parseLua(`return { schemaVersion = 1, ${body} }`));

function both(a: Dataset, b: Dataset): Dataset {
  const ab = merge(a, b);
  expect(canonical(merge(b, a))).toBe(canonical(ab));
  return ab;
}

/** A guild mate's file (an addon before CF-90): Ves runs the addon in the guild, not their Battle.net friend. */
const guildMate = (v = 1) =>
  upload(`
    self = { battleTag = "Ada#1001", version = ${v}, chars = { A = { name = "Ada Example", updatedAt = 1 } } },
    people = { ["aid:0a1b"] = { version = ${v}, chars = {
      V2 = { name = "Zed Doombringer", updatedAt = ${v} }, V1 = { name = "Ves Doombringer", updatedAt = ${v} },
    } } },
  `);

describe("naming a person without a display name or BattleTag", () => {
  it("shows their first character by name, never Unknown player", () => {
    const d = guildMate();
    expect(d.people["aid:0a1b"]).toMatchObject({ displayName: "Ves Doombringer", accountId: "0a1b" });
    expect(d.people["aid:0a1b"]).not.toHaveProperty("battleTag");
  });

  it("an own display name still wins; without any named character it stays Unknown player", () => {
    const d = upload(`people = {
      ["aid:1"] = { displayName = "Vessie", chars = { V = { name = "Ves Doombringer" } } },
      ["aid:2"] = { chars = { W = { level = 3 } } },
    }`);
    expect(d.people["aid:1"]?.displayName).toBe("Vessie");
    expect(d.people["aid:2"]?.displayName).toBe("Unknown player");
  });

  it("follows the characters they own after finalize (a presence link takes one away)", () => {
    const d = upload(`
      people = { ["aid:1"] = { chars = { V = { name = "Ves Doombringer" }, W = { name = "Abe Example" } } } },
      presence = { W = { battleTag = "Bob#2002", lastSeen = 5 } },
    `);
    expect(d.people["aid:1"]?.displayName).toBe("Ves Doombringer");
  });
});

describe("linking an aid: person to their BattleTag", () => {
  it("a record keyed by BattleTag that carries aid absorbs the aid: person of the same file", () => {
    const d = upload(`people = {
      ["aid:0a1b"] = { version = 1, receivedAt = 1, chars = { V1 = { name = "Ves Doombringer", updatedAt = 1 } } },
      ["Ves#4321"] = { aid = "0a1b", version = 2, chars = { V1 = { name = "Ves Doombringer", updatedAt = 2 } } },
    }`);
    expect(Object.keys(d.people)).toEqual(["Ves#4321"]);
    expect(d.people["Ves#4321"]).toMatchObject({ displayName: "Ves", accountId: "0a1b", version: 2 });
    expect(d.characters.V1?.owner).toBe("Ves#4321");
  });

  it("a later file from the new addon (CF-90) links them across uploads, in either order", () => {
    const later = upload(`
      self = { battleTag = "Ada#1001", version = 3, chars = { A = { name = "Ada Example", updatedAt = 1 } } },
      people = { ["Ves#4321"] = { aid = "0a1b", version = 3, chars = { V1 = { name = "Ves Doombringer", updatedAt = 3 } } } },
    `);
    const m = both(guildMate(), later);
    expect(m.people["aid:0a1b"]).toBeUndefined();
    expect(m.people["Ves#4321"]).toMatchObject({ displayName: "Ves", accountId: "0a1b", hasRecord: true, version: 3 });
    expect(m.characters.V1?.owner).toBe("Ves#4321");
    expect(m.characters.V2?.owner).toBe("Ves#4321");
    // An old file again changes nothing; merging stays associative.
    expect(canonical(both(m, guildMate()))).toBe(canonical(m));
    expect(canonical(merge(merge(guildMate(), guildMate(2)), later))).toBe(
      canonical(merge(guildMate(), merge(guildMate(2), later))),
    );
  });

  it("their own upload proves it: self.battleTag with self.accountId", () => {
    const own = upload(`
      self = { battleTag = "Ves#4321", accountId = "0a1b", displayName = "Vessie", version = 5,
        chars = { V1 = { name = "Ves Doombringer", updatedAt = 5 } } },
    `);
    const m = both(guildMate(), own);
    expect(m.people["aid:0a1b"]).toBeUndefined();
    expect(m.people["Ves#4321"]).toMatchObject({ displayName: "Vessie", isUploader: true });
    expect(m.characters.V1?.owner).toBe("Ves#4321");
    // V2 came only from the guild mate's copy and moves over too: Ves's own record no longer listing it is their call.
    expect(m.characters.V2?.owner).toBe("Ves#4321");
  });

  it("keeps the newer record's fields and every removal", () => {
    const d = finalize(
      upload(`people = {
        ["aid:7"] = { version = 9, displayName = "Vessie", removed = { X = 4 }, chars = { V = { name = "Ves Doombringer" } } },
        ["Ves#4321"] = { aid = "7", version = 2, via = "Ada#1001", removed = { Y = 3 } },
      }`),
    );
    expect(d.people["Ves#4321"]).toMatchObject({ version: 9, ownDisplayName: "Vessie", displayName: "Vessie" });
    expect(d.people["Ves#4321"]).not.toHaveProperty("via");
    expect(d.people["Ves#4321"]?.removed).toEqual({ X: 4, Y: 3 });
  });

  it("is not a new person in the upload report", () => {
    const before = guildMate();
    const after = merge(
      before,
      upload(
        `people = { ["Ves#4321"] = { aid = "0a1b", version = 3, chars = { V1 = { name = "Ves Doombringer", updatedAt = 3 } } } }`,
      ),
    );
    expect(diff(before, after).newPeople).toEqual([]);
  });
});
