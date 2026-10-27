import { describe, expect, it } from "vitest";
import { botBearerToken, formatBotToken, milestones, parseCursor, parseMessageId, type Milestone } from "@/core/bot";
import type { UploadSummary } from "@/core/diff";
import type { Character, Dataset } from "@/core/model";

// WEB-38: the bot token's format, the feed's cursor and the milestones an upload reaches.

describe("bot token", () => {
  it("is cfb_ and 43 base64url characters, and only that is a bot Bearer token", () => {
    const token = formatBotToken(new Uint8Array(32).fill(255));
    expect(token).toMatch(/^cfb_[A-Za-z0-9_-]{43}$/);
    expect(botBearerToken(`Bearer ${token}`)).toBe(token);
    expect(botBearerToken(`bearer  ${token} `)).toBe(token);
    expect(botBearerToken(`Bearer cfu_${"x".repeat(43)}`)).toBeUndefined();
    expect(botBearerToken(`Bearer ${token}x`)).toBeUndefined();
    expect(botBearerToken(`Basic ${token}`)).toBeUndefined();
    expect(botBearerToken(null)).toBeUndefined();
  });
});

describe("cursor and message id", () => {
  it("reads the cursor as an event id, 0 when missing", () => {
    expect([parseCursor(null), parseCursor(""), parseCursor("0"), parseCursor("42")]).toEqual([0, 0, 0, 42]);
    for (const bad of ["-1", "1.5", "abc", "1e3", "9".repeat(16)]) expect(parseCursor(bad)).toBeUndefined();
  });

  it("takes a Discord snowflake only", () => {
    expect(parseMessageId("1234567890123456789")).toBe("1234567890123456789");
    for (const bad of [1234, "", "12a", "1".repeat(33), undefined]) expect(parseMessageId(bad)).toBeUndefined();
  });
});

const char = (guid: string, name: string, level: number, owner = "Ada#1001"): Character => ({
  guid,
  owner,
  hasRecord: true,
  name,
  classFile: "MAGE",
  level,
  professions: {},
  talents: [],
  quests: {},
});

const after: Dataset = {
  schemaVersion: 1,
  community: {},
  people: {
    "Ada#1001": {
      key: "Ada#1001",
      battleTag: "Ada#1001",
      displayName: "Ada",
      isUploader: true,
      hasRecord: true,
      removed: {},
    },
  },
  characters: {
    A: char("A", "Ada Example", 31),
    B: char("B", "Bo Example", 60),
    C: char("C", "Cy Example", 22),
    D: char("D", "Di Example", 59),
    N: char("N", "New Example", 40),
  },
  locations: {},
  presence: {},
};

function summary(over: Partial<UploadSummary>): UploadSummary {
  return {
    newPeople: [],
    newCharacters: [],
    removedCharacters: [],
    levelUps: [],
    professionGains: [],
    itemLevelGains: [],
    sightings: [],
    senders: [],
    counts: { levelsGained: 0, skillGains: 0, itemLevelGains: 0, newCharacters: 0, sightings: 0, peopleWithNewData: 0 },
    ...over,
  };
}

const short = (list: Milestone[]) =>
  list.map((m) => {
    const level = m.kind === "level" || m.kind === "maxLevel" ? ` ${m.level}` : "";
    const rank = m.kind === "professionCap" ? ` ${m.profession} ${m.rank}` : "";
    return `${m.kind} ${m.character.name}${level}${rank}`;
  });

describe("milestones", () => {
  it("one per level mark crossed (the highest), the level cap as its own kind", () => {
    const got = milestones(
      summary({
        levelUps: [
          { guid: "A", name: "Ada Example", from: 18, to: 31 },
          { guid: "B", name: "Bo Example", from: 55, to: 60 },
          { guid: "C", name: "Cy Example", from: 21, to: 22 },
          { guid: "D", name: "Di Example", from: 49, to: 59 },
        ],
      }),
      after,
    );
    expect(short(got)).toEqual(["maxLevel Bo Example 60", "level Ada Example 30", "level Di Example 50"]);
    expect(got[1]).toMatchObject({ from: 18, character: { level: 31, classFile: "MAGE", ownerName: "Ada" } });
  });

  it("a profession only when its rank rises to the cap, not when the cap is raised", () => {
    const gain = (to: number, max: number, capReached: boolean, from?: number) => ({
      guid: "A",
      skillLine: "186",
      profession: "Mining",
      to,
      max,
      capReached,
      ...(from === undefined ? {} : { from }),
    });
    const got = milestones(
      summary({ professionGains: [gain(150, 150, true, 140), gain(160, 225, false, 150)] }),
      after,
    );
    expect(short(got)).toEqual(["professionCap Ada Example Mining 150"]);
    expect(got[0]).toMatchObject({ skillLine: "186" });
  });

  it("a new character once, its levels and professions part of it; stubs without a record left out", () => {
    const got = milestones(
      summary({
        newCharacters: [
          { guid: "N", name: "New Example", hasRecord: true, level: 40 },
          { guid: "S", hasRecord: false },
        ],
        levelUps: [{ guid: "N", from: 1, to: 40 }],
        professionGains: [{ guid: "N", skillLine: "186", to: 75, max: 75, capReached: true }],
      }),
      after,
    );
    expect(short(got)).toEqual(["newCharacter New Example"]);
  });

  it("names only: no BattleTag anywhere in a milestone", () => {
    const got = milestones(summary({ levelUps: [{ guid: "A", from: 19, to: 20 }] }), after);
    expect(JSON.stringify(got)).not.toContain("#");
    expect(milestones(summary({}), after)).toEqual([]);
  });
});
