import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { block, currentRole, listMembers, putGuest } from "@/server/access";
import { listLog } from "@/server/admins";
import { openDatabase, type Db } from "@/server/db";
import { doomsdayGoals, feedDays, membersBefore, sightings, uploads } from "@/server/db/schema";
import { loadState, memberProof, rebuild, upload } from "@/server/uploads";

// WEB-85: only people with a character in the in-game community or guild are members. A roster (addon CF-89
// `members`) proves it: the owner's newest, and friends' newer ones. The owner's first one cleans up the members and
// data from before. Battle.net friendship never makes anyone a member.

const ADMIN = "Nico#1000";
const lua = (body: string) => new TextEncoder().encode(`return { schemaVersion = 1, ${body} }`);
/** A roster as the addon writes it; `seenAt` tells how fresh it is. */
const roster = (guids: string[], seenAt = 100) =>
  `members = { ${guids.map((g) => `["${g}"] = { name = "Someone Example", seenAt = ${seenAt} }`).join(", ")} },`;

/**
 * Nico's file (`v` makes each one different): Ada runs the addon (A), Bob is a Battle.net friend outside the guild (B),
 * Cleo is in the guild without the addon (presence C), Eve runs the addon outside the guild (E) and relays her feed and
 * Doomsday goals. Everyone was seen somewhere.
 */
const nico = (v: number, extra = "") =>
  lua(`
    self = { battleTag = "${ADMIN}", version = ${v}, chars = { N = { name = "Nico Example", updatedAt = ${v} } } },
    people = {
      ["Ada#1001"] = { version = 1, chars = { A = { name = "Ada Example", updatedAt = 1 } } },
      ["Eve#5005"] = { version = 1, chars = { E = { name = "Eve Example", updatedAt = 1 } },
        feed = { [20744] = { E = { at = 10, levelFrom = 1, levelTo = 2 } } },
        goals = { days = { [20744] = { set = { "d.level" }, done = {}, at = 10 } }, weeks = {} } },
    },
    presence = { B = { battleTag = "Bob#2002", lastSeen = 5 }, C = { battleTag = "Cleo#3003", lastSeen = 5 } },
    locations = {
      N = { zone = "Durotar", seenAt = 5 }, A = { zone = "Durotar", seenAt = 5 }, B = { zone = "Durotar", seenAt = 5 },
      C = { zone = "Durotar", seenAt = 5 }, E = { zone = "Durotar", seenAt = 5 },
    },
    settings = { clubId = 7 },
    ${extra}
  `);
/** Ada's own file, with Dan (D), a Battle.net friend of hers who may join the guild, and Fay (F), who never does. */
const ada = (v: number, extra = "") =>
  lua(`
    self = { battleTag = "Ada#1001", version = ${v}, chars = { A = { name = "Ada Example", updatedAt = ${v} } } },
    presence = { D = { battleTag = "Dan#4004", lastSeen = 5 }, F = { battleTag = "Fay#7007", lastSeen = 5 } },
    locations = { D = { zone = "Durotar", seenAt = 6 }, F = { zone = "Durotar", seenAt = 6 } },
    settings = { clubId = 7 },
    ${extra}
  `);

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = openDatabase(path.join(dir, "test.sqlite"));
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const up = (file: Uint8Array, user: string, now: number) => upload(db, file, user, now, ADMIN);
const role = (tag: string) => currentRole(db, tag, ADMIN);
const memberTags = () => listMembers(db).map((m) => m.battleTag);
const shown = () => {
  const d = loadState(db)?.data;
  return { people: Object.keys(d?.people ?? {}).sort(), characters: Object.keys(d?.characters ?? {}).sort() };
};
const history = () => ({
  feed: db
    .select({ owner: feedDays.owner })
    .from(feedDays)
    .all()
    .map((r) => r.owner),
  goals: db
    .select({ owner: doomsdayGoals.owner })
    .from(doomsdayGoals)
    .all()
    .map((r) => r.owner),
  sightings: db
    .select({ guid: sightings.guid })
    .from(sightings)
    .all()
    .map((r) => r.guid)
    .sort(),
});
const removedLog = () =>
  listLog(db)
    .filter((l) => l.action === "memberRemoved")
    .map((l) => [l.by, l.target]);

/** A site as on the day WEB-85 went live: the uploads so far keep the old rule (the rebuild makes what it made). */
function deployHere(): void {
  const last = db.select({ id: uploads.id }).from(uploads).all().at(-1)?.id ?? 0;
  db.update(membersBefore).set({ lastUpload: last }).where(eq(membersBefore.id, 1)).run();
  rebuild(db, ADMIN);
}

describe("before the first roster", () => {
  it("on a new site, a file without a roster makes only its uploader a member, and shows only the group", () => {
    expect(up(nico(1), ADMIN, 1000).status).toBe("ok");
    expect(memberTags()).toEqual([ADMIN]);
    expect(role("Ada#1001")).toBeUndefined();
    expect(role("Bob#2002")).toBeUndefined();
    expect(shown().people).toEqual([ADMIN]);
    expect(history()).toEqual({ feed: [], goals: [], sightings: ["N"] });
  });

  it("on a site from before WEB-85, keeps who it had; a new file adds only its uploader and nobody new is shown", () => {
    up(nico(1), ADMIN, 1000);
    deployHere();
    expect(memberTags()).toEqual(["Ada#1001", "Bob#2002", "Cleo#3003", "Eve#5005", ADMIN]);
    expect(up(ada(2), "Ada#1001", 1100).status).toBe("ok");
    expect(role("Dan#4004")).toBeUndefined();
    expect(shown().people).not.toContain("Dan#4004");
    expect(shown().characters).not.toContain("D");
    // Nico's next file without a roster changes nothing about who is in.
    up(nico(3), ADMIN, 1200);
    expect(memberTags()).toEqual(["Ada#1001", "Bob#2002", "Cleo#3003", "Eve#5005", ADMIN]);
    expect(memberProof(db, ADMIN)).toEqual({ owner: false });
  });

  it("a friend's roster proves new members already; nobody is removed until the owner's", () => {
    up(nico(1), ADMIN, 1000);
    deployHere();
    expect(up(ada(2, roster(["A", "D"])), "Ada#1001", 1100).status).toBe("ok");
    expect(role("Dan#4004")).toBe("member");
    expect(role("Fay#7007")).toBeUndefined();
    expect(shown().characters).toContain("D");
    expect(shown().characters).not.toContain("F");
    expect(memberTags()).toContain("Eve#5005");
    expect(removedLog()).toEqual([]);
  });
});

describe("the owner's first roster", () => {
  beforeEach(() => {
    up(nico(1), ADMIN, 1000);
    deployHere();
    putGuest(db, "Gus#6006", false, ADMIN, 1000);
    block(db, "Bob#2002", ADMIN, 1000);
  });

  it("removes members with no character in the community, with their data, feed, Doomsday and sightings", () => {
    expect(history().goals).toEqual(["Eve#5005"]);
    expect(up(nico(2, roster(["N", "A", "C"])), ADMIN, 2000).status).toBe("ok");
    expect(memberTags()).toEqual(["Ada#1001", "Cleo#3003", ADMIN]);
    expect(role("Eve#5005")).toBeUndefined();
    expect(role("Ada#1001")).toBe("member");
    expect(role("Cleo#3003")).toBe("member");
    expect(role(ADMIN)).toBe("admin");
    // Blocks and guests stay as they are.
    expect(role("Bob#2002")).toBeUndefined();
    expect(role("Gus#6006")).toBe("guest");
    expect(shown()).toEqual({ people: ["Ada#1001", "Cleo#3003", ADMIN], characters: ["A", "C", "N"] });
    expect(history()).toEqual({ feed: [], goals: [], sightings: ["A", "C", "N"] });
    // In Admin changes, by the owner whose upload it was; the blocked Bob isn't named.
    expect(removedLog()).toEqual([[ADMIN, "Eve#5005"]]);
  });

  it("a rebuild comes to the same", () => {
    up(nico(2, roster(["N", "A", "C"])), ADMIN, 2000);
    const before = { members: memberTags(), shown: shown(), history: history() };
    rebuild(db, ADMIN);
    expect({ members: memberTags(), shown: shown(), history: history() }).toEqual(before);
  });

  it("someone who leaves the community stops being a member; someone who joins becomes one", () => {
    up(nico(2, roster(["N", "A", "C"])), ADMIN, 2000);
    up(nico(3, `${roster(["N", "C", "E"])}`), ADMIN, 3000);
    expect(memberTags()).toEqual(["Cleo#3003", "Eve#5005", ADMIN]);
    expect(role("Ada#1001")).toBeUndefined();
    expect(shown().people).toEqual(["Cleo#3003", "Eve#5005", ADMIN]);
    expect(removedLog()).toEqual([
      [ADMIN, "Ada#1001"],
      [ADMIN, "Eve#5005"],
    ]);
  });

  it("a friend's newer roster adds who joined since, and removes nobody", () => {
    up(nico(2, roster(["N", "A", "C"], 100)), ADMIN, 2000);
    expect(up(ada(3, roster(["A", "D"], 200)), "Ada#1001", 3000).status).toBe("ok");
    expect(memberTags()).toEqual(["Ada#1001", "Cleo#3003", "Dan#4004", ADMIN]);
    expect(shown().characters).toEqual(["A", "C", "D", "N"]);
    expect(removedLog()).toEqual([[ADMIN, "Eve#5005"]]);
    // A rebuild comes to the same.
    rebuild(db, ADMIN);
    expect(memberTags()).toEqual(["Ada#1001", "Cleo#3003", "Dan#4004", ADMIN]);
  });

  it("a friend's roster older than the owner's proves nothing (a stale list never brings anyone back)", () => {
    up(nico(2, roster(["N", "A", "C"], 200)), ADMIN, 2000);
    up(ada(3, roster(["A", "D", "E"], 100)), "Ada#1001", 3000);
    expect(role("Dan#4004")).toBeUndefined();
    expect(role("Eve#5005")).toBeUndefined();
    expect(memberProof(db, ADMIN)).toEqual({ roster: new Set(["N", "A", "C"]), owner: true });
  });

  it("the owner's next roster without someone a friend proved ends it", () => {
    up(nico(2, roster(["N", "A", "C"], 100)), ADMIN, 2000);
    up(ada(3, roster(["A", "D"], 200)), "Ada#1001", 3000);
    up(nico(4, roster(["N", "A", "C"], 300)), ADMIN, 4000);
    expect(role("Dan#4004")).toBeUndefined();
    expect(shown().characters).not.toContain("D");
    expect(removedLog()).toEqual([
      [ADMIN, "Dan#4004"],
      [ADMIN, "Eve#5005"],
    ]);
  });

  it("after the cleanup, an old file brings no Battle.net friend back: no access, no data", () => {
    up(nico(2, roster(["N", "A", "C"])), ADMIN, 2000);
    // Ada's file from an addon without `members`, naming Dan and Fay (presence, sightings).
    expect(up(ada(3), "Ada#1001", 3000).status).toBe("ok");
    // Nico's too, naming Eve (with feed and Doomsday) and Bob.
    expect(up(nico(4), ADMIN, 4000).status).toBe("ok");
    for (const tag of ["Dan#4004", "Fay#7007", "Eve#5005"]) expect(role(tag)).toBeUndefined();
    expect(memberTags()).toEqual(["Ada#1001", "Cleo#3003", ADMIN]);
    expect(shown()).toEqual({ people: ["Ada#1001", "Cleo#3003", ADMIN], characters: ["A", "C", "N"] });
    expect(history()).toEqual({ feed: [], goals: [], sightings: ["A", "C", "N"] });
  });

  it("ignores a roster without the uploader's own characters (a list the game had not loaded)", () => {
    up(nico(2, roster(["A"])), ADMIN, 2000);
    expect(memberProof(db, ADMIN)).toEqual({ owner: false });
    expect(memberTags()).toEqual(["Ada#1001", "Bob#2002", "Cleo#3003", "Eve#5005", ADMIN]);
    expect(removedLog()).toEqual([]);
    up(ada(3, roster(["D"], 500)), "Ada#1001", 3000);
    expect(role("Dan#4004")).toBeUndefined();
  });

  it("a friend's file without a roster afterwards adds only those the owner's roster proves", () => {
    up(nico(2, roster(["N", "A", "C", "D"])), ADMIN, 2000);
    expect(role("Dan#4004")).toBeUndefined();
    up(ada(3), "Ada#1001", 3000);
    expect(role("Dan#4004")).toBe("member");
    expect(role("Fay#7007")).toBeUndefined();
    expect(shown().characters).toContain("D");
    expect(shown().characters).not.toContain("F");
  });
});
