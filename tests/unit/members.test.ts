import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import { membersOf, onlyMembers, readRoster, rosterHoldsUploader, rosterPeople } from "@/core/members";
import { normalize } from "@/core/normalize";

// WEB-85: only people with a character in the in-game community or guild are members.

const chunk = (body: string) => parseLua(`return { schemaVersion = 1, ${body} }`);

/**
 * Nico's file: his own character N, Ada (runs the addon, character A in the guild), Bob (a Battle.net friend seen
 * playing, character B, not in the guild), Cleo (in the guild, seen only through presence, character C), a sighting of
 * each, and an ownerless sighting of X (in the guild) and Y (not).
 */
const body = (members: string) => `
  self = { battleTag = "Nico#1000", version = 1, chars = { N = { name = "Nico Example", updatedAt = 1 } } },
  people = {
    ["Ada#1001"] = { version = 1, chars = { A = { name = "Ada Example", updatedAt = 1 } } },
    ["Bob#2002"] = { version = 1, chars = { B = { name = "Bob Example", updatedAt = 1 } } },
  },
  presence = { B = { battleTag = "Bob#2002", lastSeen = 5 }, C = { battleTag = "Cleo#3003", lastSeen = 5 } },
  locations = {
    N = { zone = "Durotar", seenAt = 5 }, A = { zone = "Durotar", seenAt = 5 }, B = { zone = "Durotar", seenAt = 5 },
    C = { zone = "Durotar", seenAt = 5 }, X = { zone = "Durotar", seenAt = 5 }, Y = { zone = "Durotar", seenAt = 5 },
  },
  settings = { clubId = 7 },
  ${members}
`;
const roster = new Set(["N", "A", "C", "X"]);

describe("readRoster", () => {
  it("reads the GUIDs of `members` and the newest seenAt, whatever the entries hold", () => {
    const c = chunk(
      body(
        `members = { N = { name = "Nico Example", seenAt = 9 }, A = { seenAt = 12 }, C = { seenAt = "x" }, X = {} }`,
      ),
    );
    expect(readRoster(c)).toEqual({ guids: new Set(["N", "A", "C", "X"]), seenAt: 12 });
    expect(readRoster(chunk(body("members = { N = {} }")))).toEqual({ guids: new Set(["N"]) });
  });

  it("is undefined without `members`, when it is empty or not a table, and skips entries that aren't tables", () => {
    expect(readRoster(chunk(body("")))).toBeUndefined();
    expect(readRoster(chunk(body("members = {}")))).toBeUndefined();
    expect(readRoster(chunk(body(`members = "everyone"`)))).toBeUndefined();
    expect(readRoster(chunk(body(`members = { N = true, A = 5 }`)))).toBeUndefined();
    expect(readRoster(chunk(body(`members = { N = true, A = {} }`)))).toEqual({ guids: new Set(["A"]) });
  });

  it("reads the game's format too", () => {
    const c = parseLua(
      `CommunitiesForeverDB = { ["global"] = { schemaVersion = 2, members = { ["G-1"] = { name = "Ves Doombringer", seenAt = 1 } } } }`,
    );
    expect(readRoster(c)).toEqual({ guids: new Set(["G-1"]), seenAt: 1 });
  });
});

describe("rosterHoldsUploader", () => {
  const data = normalize(chunk(body("")));
  it("is true only when one of the uploader's own characters is on it", () => {
    expect(rosterHoldsUploader(data, roster)).toBe(true);
    expect(rosterHoldsUploader(data, new Set(["A", "C"]))).toBe(false);
  });
});

describe("membersOf", () => {
  const data = normalize(chunk(body("")));
  it("with proof: the BattleTags with a character on it, presence included; never a Battle.net friend alone", () => {
    expect([...rosterPeople(data, roster)].sort()).toEqual(["Ada#1001", "Cleo#3003", "Nico#1000"]);
    expect(membersOf(data, roster, "none").sort()).toEqual(["Ada#1001", "Cleo#3003", "Nico#1000"]);
    expect(membersOf(data, new Set(["C"]), "none")).toEqual(["Cleo#3003"]);
    expect(membersOf(data, undefined, "none")).toEqual([]);
  });

  it("the fallback: everyone for an upload from before WEB-85, else the uploader, plus the proven", () => {
    expect(membersOf(data, undefined, "all").sort()).toEqual(["Ada#1001", "Bob#2002", "Cleo#3003", "Nico#1000"]);
    expect(membersOf(data, undefined, "self")).toEqual(["Nico#1000"]);
    expect(membersOf(data, new Set(["C"]), "self").sort()).toEqual(["Cleo#3003", "Nico#1000"]);
  });

  it("strips escapes and leaves out a file without a BattleTag", () => {
    expect(
      membersOf(normalize(chunk(`self = { battleTag = "|cffff0000Eve|r#5005", version = 1 }`)), undefined, "self"),
    ).toEqual(["Eve#5005"]);
    expect(membersOf(normalize(chunk(`self = { accountId = "9", version = 1 }`)), undefined, "self")).toEqual([]);
  });
});

describe("onlyMembers", () => {
  it("drops the people left out with their characters, presence links and sightings; ownerless ones off the roster", () => {
    const data = normalize(chunk(body("")));
    const linked = rosterPeople(data, roster);
    const { data: kept, dropped, droppedPeople } = onlyMembers(data, (p) => linked.has(p.key), roster);
    expect(Object.keys(kept.people).sort()).toEqual(["Ada#1001", "Cleo#3003", "Nico#1000"]);
    expect(Object.keys(kept.characters).sort()).toEqual(["A", "C", "N", "X"]);
    expect(Object.keys(kept.presence)).toEqual(["C"]);
    expect(Object.keys(kept.locations).sort()).toEqual(["A", "C", "N", "X"]);
    expect([...dropped].sort()).toEqual(["B", "Y"]);
    expect([...droppedPeople]).toEqual(["Bob#2002"]);
    // The input stays as it was.
    expect(Object.keys(data.people)).toHaveLength(4);
  });

  it("keeps ownerless characters without a roster", () => {
    const data = normalize(chunk(body("")));
    const { data: kept } = onlyMembers(data, (p) => p.key !== "Bob#2002", undefined);
    expect(Object.keys(kept.characters).sort()).toEqual(["A", "C", "N", "X", "Y"]);
  });
});
