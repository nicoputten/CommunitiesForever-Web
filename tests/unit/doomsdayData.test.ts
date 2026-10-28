import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readAllGoals } from "@/core/doomsday/record";
import { readFeeds } from "@/core/feed";
import { parseLua } from "@/core/lua";
import { normalize } from "@/core/normalize";

// WEB-55: the new upload data (addon CF-52, CF-53, CF-55, CF-56) from a handwritten fixture
// (tests/fixtures/doomsday/README.md), one without it (the v0.4 release) and one with `false`.

const fixture = (name: string) => parseLua(readFileSync(path.join("tests/fixtures", name), "utf8"));
const ADA = "Player-1-0000A001";

describe("Doomsday data in uploads", () => {
  const chunk = fixture("doomsday/savedvariables.lua");

  it("reads pvp and riding per character", () => {
    const data = normalize(chunk);
    expect(data.characters[ADA]).toMatchObject({
      riding: 75,
      pvp: {
        hk: 1234,
        rank: 6,
        rankName: "Stone Guard",
        weekKills: 61,
        weekHonor: 4200,
        deaths: 101,
        duelsWon: 12,
        duelsLost: 4,
      },
    });
    expect(data.characters["Player-1-0000B001"]).toMatchObject({ riding: 150, pvp: { hk: 0, rank: 0 } });
    expect(data.characters["Player-1-0000C001"]).not.toHaveProperty("pvp");
    expect(data.characters["Player-1-0000C001"]).not.toHaveProperty("riding");
  });

  it("reads every new feed field", () => {
    const [ada, bob, cid] = readFeeds(chunk);
    expect(ada!.days[20754]![ADA]).toMatchObject({
      kills: { "Hillsbrad Foothills": 3, "Arathi Basin": 2 },
      deaths: [
        { t: 1793212000, zone: "Hillsbrad Foothills", cause: "player" },
        { t: 1793213000, zone: "Alterac Mountains", cause: "fall" },
      ],
      duels: [{ t: 1793214000, won: true, vs: "Bob Example" }],
      loot: { rare: 2, epic: [{ id: 12345, name: "Example Blade", slot: "INVTYPE_2HWEAPON", level: 42 }] },
      notable: { "12360": 1 },
      gold: { gained: 15000, spent: 4000 },
      sessions: [{ from: 1793205000, to: 1793219000 }],
      groups: ["Player-1-0000B001"],
      pvpKills: [
        {
          t: 1793211000,
          zone: "Hillsbrad Foothills",
          name: "Foe Example",
          lvl: 44,
          myLvl: 41,
          class: "PALADIN",
          race: "Human",
          rank: 2,
          solo: true,
          bg: false,
        },
        { t: 1793211500, zone: "Hillsbrad Foothills", lvl: -1, myLvl: 41, solo: false },
        { t: 1793215000, zone: "Arathi Basin", name: "Other Example", myLvl: 42, bg: true },
      ],
    });
    // An unknown death cause becomes "other", as the addon cleans it.
    expect(bob!.days[20754]!["Player-1-0000B001"]!.deaths).toEqual([{ t: 1793214500, cause: "other" }]);
    // An addon before CF-52 sends none of them.
    const old = cid!.days[20754]!["Player-1-0000C001"]!;
    for (const key of ["kills", "deaths", "duels", "loot", "notable", "gold", "sessions", "groups", "pvpKills"]) {
      expect(old).not.toHaveProperty(key);
    }
  });

  it("reads goals per day and week", () => {
    expect(readAllGoals(chunk)).toEqual([
      {
        owner: "Ada#1001",
        days: {
          20754: {
            set: ["d.quests10", "d.level", "d.dungeon", "hunt", "p.loneWolf"],
            swapped: {},
            done: { "d.quests10": 1793216000, "d.level": 1793219000 },
            at: 1793219000,
          },
        },
        weeks: {
          2965: { set: ["w.days3", "w.quests50", "w.cap", "b.kills50"], swapped: {}, done: {}, at: 1793219000 },
        },
        streak: 3,
        best: 7,
        pool: 1,
        reset: 68400,
      },
      {
        owner: "Bob#2002",
        days: {
          20754: {
            set: ["d.quests10", "d.altLevel", "d.dungeon", "hunt", "p.loneWolf"],
            swapped: { "d.altLevel": "d.level" },
            done: {},
            at: 1793218000,
          },
        },
        weeks: {},
        streak: 0,
        best: 2,
        pool: 1,
        reset: 68400,
      },
    ]);
  });

  it("caps lists as the addon does", () => {
    const many = Array.from({ length: 120 }, (_, i) => `{ t = ${i} }`).join(", ");
    const [feed] = readFeeds(
      parseLua(`return { schemaVersion = 2, self = { battleTag = "Ada#1001", feed = { [20754] = { G = {
        deaths = { ${many} }, duels = { ${many} }, sessions = { ${many} }, pvpKills = { ${many} },
        loot = { rare = -1, epic = { ${many} } },
      } } } } }`),
    );
    const day = feed!.days[20754]!.G!;
    expect([day.deaths!.length, day.duels!.length, day.sessions!.length, day.pvpKills!.length]).toEqual([
      50, 50, 50, 100,
    ]);
    expect(day.loot).toEqual({ epic: expect.any(Array) });
    expect(day.loot!.epic).toHaveLength(50);
  });

  it("has nothing new from a released addon without the fields", () => {
    const old = fixture("addon/v0.4/savedvariables.lua");
    expect(readAllGoals(old)).toEqual([]);
    expect(Object.values(normalize(old).characters).some((c) => c.pvp !== undefined || c.riding !== undefined)).toBe(
      false,
    );
  });

  it("reads false (sharing off, an older addon) as nothing sent", () => {
    const chunk = fixture("doomsday/goals-false.lua");
    expect(readFeeds(chunk)).toEqual([]);
    expect(readAllGoals(chunk)).toEqual([]);
  });
});
