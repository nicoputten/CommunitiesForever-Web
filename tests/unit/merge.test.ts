import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import { canonical, merge } from "@/core/merge";
import type { Dataset } from "@/core/model";
import { normalize } from "@/core/normalize";

function upload(body: string): Dataset {
  return normalize(parseLua(`return { schemaVersion = 1, ${body} }`));
}

/** merge in both orders; asserts they agree and returns the result. */
function both(a: Dataset, b: Dataset): Dataset {
  const ab = merge(a, b);
  expect(canonical(merge(b, a))).toBe(canonical(ab));
  return ab;
}

describe("merge", () => {
  it("keeps the newer copy of a character", () => {
    const a = upload('people = { ["Bob#2002"] = { version = 1, chars = { G = { level = 10, updatedAt = 100 } } } }');
    const b = upload('people = { ["Bob#2002"] = { version = 2, chars = { G = { level = 12, updatedAt = 200 } } } }');
    expect(both(a, b).characters.G?.level).toBe(12);
  });

  it("prefers a record over a stub, whatever its age", () => {
    const a = upload('presence = { G = { battleTag = "Bob#2002", lastSeen = 999 } }');
    const b = upload('people = { ["Bob#2002"] = { chars = { G = { name = "Gil Example", updatedAt = 1 } } } }');
    const m = both(a, b);
    expect(m.characters.G).toMatchObject({ hasRecord: true, name: "Gil Example", owner: "Bob#2002" });
    expect(m.people["Bob#2002"]).toMatchObject({ hasRecord: true });
  });

  it("keeps the newer sighting and presence link", () => {
    const a = upload(`locations = { G = { zone = "Durotar", seenAt = 10 } },
                      presence = { G = { battleTag = "Bob#2002", lastSeen = 10 } }`);
    const b = upload(`locations = { G = { zone = "Mulgore", seenAt = 20 } },
                      presence = { G = { battleTag = "Cleo#3003", lastSeen = 5 } }`);
    const m = both(a, b);
    expect(m.locations.G).toEqual({ zone: "Mulgore", seenAt: 20 });
    expect(m.presence.G).toEqual({ battleTag: "Bob#2002", lastSeen: 10 });
    expect(m.characters.G?.owner).toBe("Bob#2002");
  });

  it("takes person fields from the newer record and keeps every removal", () => {
    const a = upload('people = { ["Bob#2002"] = { version = 1, displayName = "Old", removed = { X = 50, Y = 10 } } }');
    const b = upload(
      'people = { ["Bob#2002"] = { version = 2, displayName = "New", aid = "b0b", removed = { Y = 20 } } }',
    );
    expect(both(a, b).people["Bob#2002"]).toMatchObject({
      displayName: "New",
      version: 2,
      accountId: "b0b",
      removed: { X: 50, Y: 20 },
    });
  });

  it("hides a character removed in one upload unless the other has a newer copy", () => {
    const a = upload(`people = { ["Bob#2002"] = { version = 1, chars = {
      Old = { updatedAt = 100 }, Back = { updatedAt = 300 } } } }`);
    const b = upload('people = { ["Bob#2002"] = { version = 2, removed = { Old = 200, Back = 200 } } }');
    expect(Object.keys(both(a, b).characters).sort()).toEqual(["Back"]);
  });

  it("removes the uploader's character that a newer own record no longer lists", () => {
    const before = upload(`self = { battleTag = "Ada#1001", version = 100,
      chars = { Kept = { updatedAt = 90 }, Deleted = { updatedAt = 80 } } }`);
    const after = upload(`self = { battleTag = "Ada#1001", version = 200,
      chars = { Kept = { updatedAt = 90 }, New = { updatedAt = 150 } } }`);
    const m = both(before, after);
    expect(Object.keys(m.characters).sort()).toEqual(["Kept", "New"]);
    expect(m.people["Ada#1001"]?.removed).toEqual({ Deleted: 200 });

    // The removal is remembered: merging the old upload in again does not bring it back.
    expect(Object.keys(both(m, before).characters).sort()).toEqual(["Kept", "New"]);
  });

  it("does not remove the uploader's character that an older own record did not list yet", () => {
    const older = upload('self = { battleTag = "Ada#1001", version = 100, chars = {} }');
    const newer = upload('self = { battleTag = "Ada#1001", version = 200, chars = { New = { updatedAt = 150 } } }');
    expect(Object.keys(both(older, newer).characters)).toEqual(["New"]);
  });

  it("takes community, uploader and version from the upload with the newer own record", () => {
    const a = upload('self = { battleTag = "Ada#1001", version = 1 }, settings = { clubId = 1, clubName = "Old" }');
    const b = upload('self = { battleTag = "Ada#1001", version = 2 }, settings = { clubId = "2", clubName = "New" }');
    expect(both(a, b)).toMatchObject({ version: 2, uploader: "Ada#1001", community: { id: "2", name: "New" } });
  });

  it("does not depend on the order of three uploads", () => {
    const uploads = [
      upload(`self = { battleTag = "Ada#1001", version = 100, chars = { A1 = { level = 5, updatedAt = 100 } } },
              presence = { B1 = { battleTag = "Bob#2002", lastSeen = 100 } },
              locations = { A1 = { zone = "Durotar", seenAt = 100 } }`),
      upload(`self = { battleTag = "Ada#1001", version = 200, chars = { A1 = { level = 9, updatedAt = 200 } } },
              people = { ["Bob#2002"] = { version = 150, chars = { B1 = { level = 3, updatedAt = 150 } } } },
              locations = { B1 = { zone = "Mulgore", seenAt = 160 } }`),
      upload(`self = { battleTag = "Ada#1001", version = 300, chars = { A2 = { level = 1, updatedAt = 300 } } },
              people = { ["Bob#2002"] = { version = 140, displayName = "Bobby", chars = { B1 = { level = 2, updatedAt = 140 } } } },
              presence = { B1 = { battleTag = "Bob#2002", lastSeen = 300 } }`),
    ] as const;
    const [x, y, z] = uploads;
    const orders = [
      merge(merge(x, y), z),
      merge(merge(x, z), y),
      merge(merge(y, z), x),
      merge(merge(z, y), x),
      merge(x, merge(y, z)),
    ].map(canonical);
    expect(new Set(orders).size).toBe(1);
    const m = merge(merge(x, y), z);
    expect(Object.keys(m.characters).sort()).toEqual(["A2", "B1"]);
    expect(m.characters.B1).toMatchObject({ level: 3, owner: "Bob#2002" });
    expect(m.people["Bob#2002"]?.displayName).toBe("Bob");
  });

  it("gives the same result when an upload is merged twice", () => {
    const a = upload(`self = { battleTag = "Ada#1001", version = 1, chars = { A = { updatedAt = 1 } } },
                      presence = { B = { battleTag = "Bob#2002", lastSeen = 1 } }`);
    expect(canonical(merge(a, a))).toBe(canonical(a));
  });

  it("decides ties the same way in either order", () => {
    const a = upload('people = { ["Bob#2002"] = { chars = { G = { level = 10, updatedAt = 100 } } } }');
    const b = upload('people = { ["Bob#2002"] = { chars = { G = { level = 11, updatedAt = 100 } } } }');
    both(a, b);
  });

  it("does not change its inputs", () => {
    const a = upload('self = { battleTag = "Ada#1001", version = 100, chars = { Gone = { updatedAt = 50 } } }');
    const b = upload('self = { battleTag = "Ada#1001", version = 200, chars = {} }');
    const before = [canonical(a), canonical(b)];
    merge(a, b);
    expect([canonical(a), canonical(b)]).toEqual(before);
  });
});
