import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import { finalize, normalize, NormalizeError, SUPPORTED_SCHEMA } from "@/core/normalize";
import { canonical } from "@/core/merge";

function norm(lua: string) {
  return normalize(parseLua(lua));
}

function global(body: string) {
  return norm(`return { schemaVersion = 1, ${body} }`);
}

describe("normalize: file and schema", () => {
  it("reads the game's wrapper and a fixture's return", () => {
    const wrapped = norm('CommunitiesForeverDB = { ["profileKeys"] = {}, ["global"] = { ["schemaVersion"] = 1 } }');
    const returned = norm("return { schemaVersion = 1 }");
    expect(wrapped).toEqual(returned);
    expect(returned).toEqual({
      schemaVersion: 1,
      community: {},
      people: {},
      characters: {},
      locations: {},
      presence: {},
    });
  });

  it("rejects a file that is not CommunitiesForever's", () => {
    expect(() => norm("SomeOtherAddonDB = { global = {} }")).toThrow(NormalizeError);
    expect(() => norm("CommunitiesForeverDB = { profileKeys = {} }")).toThrow("not a CommunitiesForever");
    expect(() => norm("return 5")).toThrow(NormalizeError);
  });

  it("rejects a file without a numeric schemaVersion", () => {
    expect(() => norm("return { self = {} }")).toThrow("no schemaVersion");
    expect(() => norm('return { schemaVersion = "1" }')).toThrow("no schemaVersion");
  });

  it("rejects a newer schema with the version in the message", () => {
    expect(() => norm(`return { schemaVersion = ${SUPPORTED_SCHEMA + 1} }`)).toThrow(
      `The file has schema version ${SUPPORTED_SCHEMA + 1}; this site reads up to ${SUPPORTED_SCHEMA}. Update the site.`,
    );
  });
});

describe("normalize: missing and wrong fields", () => {
  it("leaves out fields that are missing or of the wrong type", () => {
    const d = global(`
      self = { battleTag = "Ada#1001", version = "x", chars = {
        ["Player-1-A"] = { name = 5, level = "60", professions = { [186] = { name = "Mining", rank = "x" }, [185] = 7 },
                           talents = { 5, { name = "Fire" } }, quests = { [1] = true }, ilvl = "x" },
        ["Player-1-B"] = "not a table",
      } },
      people = { ["Bob#2002"] = { removed = { ["Player-1-C"] = "x" }, chars = 5 }, ["Bad#1"] = 7 },
      presence = { ["Player-1-D"] = { battleTag = "Cleo#3003" }, ["Player-1-E"] = 5 },
      locations = { ["Player-1-F"] = { zone = 5, seenAt = 1 } },
      settings = { clubId = true, clubName = {} },
    `);
    expect(d.characters["Player-1-A"]).toEqual({
      guid: "Player-1-A",
      owner: "Ada#1001",
      hasRecord: true,
      professions: { "186": { name: "Mining" } },
      talents: [{}, { name: "Fire" }],
      quests: {},
    });
    expect(Object.keys(d.characters)).toEqual(["Player-1-A"]);
    expect(d.people["Bob#2002"]).toMatchObject({ hasRecord: true, removed: {} });
    expect(d.people["Bad#1"]).toBeUndefined();
    expect(d.people["Ada#1001"]).not.toHaveProperty("version");
    expect(d.community).toEqual({});
  });

  it("accepts {} where the addon writes a list", () => {
    const d = global('self = { battleTag = "Ada#1001", chars = { ["G"] = { talents = {}, mainTree = 1 } } }');
    expect(d.characters.G).toMatchObject({ talents: [], mainTree: 1 });
    expect(d.characters.G).not.toHaveProperty("mainTreeName");
  });

  it("reads a list written with explicit [1], [2] keys in order", () => {
    const d = global(
      'self = { battleTag = "A#1", chars = { G = { talents = { [2] = { name = "Two" }, [1] = { name = "One" } } } } }',
    );
    expect(d.characters.G?.talents).toEqual([{ name: "One" }, { name: "Two" }]);
  });
});

describe("normalize: people", () => {
  it("names people: own display name > BattleTag name part", () => {
    const d = global(`
      self = { battleTag = "Ada#1001", accountId = "0a1b2c3d4e5f" },
      people = { ["Bob#2002"] = { displayName = "  Bobby  " }, ["Cleo#3003"] = {}, ["aid:abc123"] = {} },
    `);
    expect(d.people["Ada#1001"]).toMatchObject({ displayName: "Ada", isUploader: true, accountId: "0a1b2c3d4e5f" });
    expect(d.people["Ada#1001"]).not.toHaveProperty("ownDisplayName");
    expect(d.people["Bob#2002"]).toMatchObject({ displayName: "Bobby", ownDisplayName: "Bobby", isUploader: false });
    expect(d.people["Cleo#3003"]?.displayName).toBe("Cleo");
    expect(d.people["aid:abc123"]).toMatchObject({ displayName: "Unknown player", accountId: "abc123" });
    expect(d.people["aid:abc123"]).not.toHaveProperty("battleTag");
    expect(d.uploader).toBe("Ada#1001");
  });

  it("keys the uploader by account ID when the BattleTag is missing", () => {
    expect(global('self = { accountId = "abc" }').uploader).toBe("aid:abc");
    expect(global("self = {}").uploader).toBe("uploader");
    expect(global("").uploader).toBeUndefined();
  });

  it("keeps record fields", () => {
    const d = global(
      'people = { ["Bob#2002"] = { version = 5, receivedAt = 6, via = "Cleo#3003", aid = "b0b", removed = { G = 4 } } }',
    );
    expect(d.people["Bob#2002"]).toEqual({
      key: "Bob#2002",
      battleTag: "Bob#2002",
      accountId: "b0b",
      displayName: "Bob",
      isUploader: false,
      hasRecord: true,
      version: 5,
      receivedAt: 6,
      via: "Cleo#3003",
      removed: { G: 4 },
    });
  });

  it("makes a person with stub characters for a friend seen only through presence", () => {
    const d = global(`
      presence = { ["Player-2-A"] = { battleTag = "Bob#2002", lastSeen = 10 }, ["Player-2-B"] = { battleTag = "Bob#2002", lastSeen = 11 } },
      locations = { ["Player-2-A"] = { zone = "Durotar", seenAt = 9 } },
    `);
    expect(d.people["Bob#2002"]).toMatchObject({ displayName: "Bob", hasRecord: false, isUploader: false });
    expect(d.characters["Player-2-A"]).toEqual({
      guid: "Player-2-A",
      owner: "Bob#2002",
      hasRecord: false,
      professions: {},
      talents: [],
      quests: {},
    });
    expect(d.characters["Player-2-B"]?.owner).toBe("Bob#2002");
    expect(d.locations["Player-2-A"]).toEqual({ zone: "Durotar", seenAt: 9 });
  });

  it("keeps a GUID seen only in locations as a stub without owner", () => {
    const d = global('locations = { ["Player-3-A"] = { zone = "Mulgore", seenAt = 1 } }');
    expect(d.characters["Player-3-A"]).toMatchObject({ hasRecord: false });
    expect(d.characters["Player-3-A"]).not.toHaveProperty("owner");
  });

  it("lets a presence link decide the owner over the record", () => {
    const d = global(`
      people = { ["Bob#2002"] = { chars = { G = { name = "Gil Example" } } } },
      presence = { G = { battleTag = "Cleo#3003", lastSeen = 1 } },
    `);
    expect(d.characters.G).toMatchObject({ owner: "Cleo#3003", name: "Gil Example", hasRecord: true });
  });

  it("hides characters removed by their owner unless newer than the removal", () => {
    const d = global(`
      people = { ["Bob#2002"] = { removed = { Old = 100, New = 100, Seen = 100 },
                                  chars = { Old = { updatedAt = 100 }, New = { updatedAt = 101 } } } },
      presence = { Seen = { battleTag = "Bob#2002", lastSeen = 200 } },
    `);
    expect(Object.keys(d.characters).sort()).toEqual(["New"]);
    expect(d.people["Bob#2002"]?.removed).toEqual({ Old: 100, New: 100, Seen: 100 });
  });
});

describe("normalize: characters", () => {
  it("reads mainTree as an index into talents", () => {
    const d = global(`self = { battleTag = "A#1", chars = { G = { mainTree = 2,
      talents = { { name = "Arms", points = 0 }, { name = "Fury", points = 5 }, { name = "Protection", points = 0 } } } } }`);
    expect(d.characters.G).toMatchObject({ mainTree: 2, mainTreeName: "Fury" });
  });

  it("accepts mainTree as a tree name", () => {
    const d = global(`self = { battleTag = "A#1", chars = { G = { mainTree = "Fury",
      talents = { { name = "Arms" }, { name = "Fury" } } } } }`);
    expect(d.characters.G).toMatchObject({ mainTree: 2, mainTreeName: "Fury" });
  });

  it("reads clubId as a number or a string", () => {
    expect(global("settings = { clubId = 215537682 }").community).toEqual({ id: "215537682" });
    expect(global('settings = { clubId = "40000001", clubName = "Friends" }').community).toEqual({
      id: "40000001",
      name: "Friends",
    });
  });

  it("strips WoW escapes from every string", () => {
    const d = global(`
      self = { battleTag = "A#1", chars = { G = { name = "|cffff0000Red|r Name", realm = "R|z",
        professions = { [186] = { name = "Min|ring" } }, talents = { { name = "|TIcon|tFire" } },
        quests = { [1] = { title = "Q|r", area = "|cff00ff00Zone" } } } } },
      locations = { G = { zone = "|cffffffffDurotar|r", seenAt = 1 } },
      settings = { clubName = "|cffff0000Club|r" },
    `);
    expect(d.characters.G).toMatchObject({
      name: "Red Name",
      realm: "Rz",
      professions: { "186": { name: "Mining" } },
      talents: [{ name: "Fire" }],
      quests: { "1": { title: "Q", area: "Zone" } },
    });
    expect(d.locations.G?.zone).toBe("Durotar");
    expect(d.community.name).toBe("Club");
  });

  it("treats keys such as __proto__ and constructor as ordinary GUIDs", () => {
    const d = global(`
      presence = { ["__proto__"] = { battleTag = "constructor", lastSeen = 1 } },
      locations = { ["toString"] = { zone = "Durotar", seenAt = 1 } },
    `);
    expect(Object.keys(d.characters).sort()).toEqual(["__proto__", "toString"]);
    expect(d.people.constructor).toMatchObject({ hasRecord: false });
    expect(d.characters.hasOwnProperty).toBeUndefined();
  });
});

describe("finalize", () => {
  it("is idempotent", () => {
    const text = readFileSync(new URL("../fixtures/real/beta-2026-10.lua", import.meta.url), "utf8");
    const once = norm(text);
    const twice = finalize(norm(text));
    expect(canonical(twice)).toBe(canonical(once));
  });
});
