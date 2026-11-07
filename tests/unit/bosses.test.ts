import { describe, expect, it } from "vitest";
import type { DungeonBossNotes } from "@/core/gamedata/bosses";
import { type BossInput, buildBosses, ownDrops } from "@/core/recipes/bosses";
import type { SqlRow } from "@/core/recipes/sqlDump";

// WEB-96: dungeon bosses and their own loot, from invented rows in the import's formats (names, IDs and chances are
// made up; the dungeon ids and map names are ours, src/core/gamedata/dungeons.ts).

const enc = (ID: number, MapID: number, Name_lang: string, OrderIndex: number, DifficultyID = 0) => ({
  ID: String(ID),
  MapID: String(MapID),
  Name_lang,
  OrderIndex: String(OrderIndex),
  DifficultyID: String(DifficultyID),
});
const loot = (entry: number, item: number, chance: number, groupid = 0, mincountOrRef = 1): SqlRow => ({
  entry,
  item,
  ChanceOrQuestChance: chance,
  groupid,
  mincountOrRef,
});

const notes: Record<string, DungeonBossNotes> = {
  dm: { final: "Test Captain", optional: ["Test Cook"] },
  sm: {
    wings: { graveyard: ["Test Ghost"], armory: ["Test Champion", "Test Herald"] },
    finals: { graveyard: "Test Ghost", armory: "Test Champion" },
  },
};
const together = { "Test Champion": ["Test Champion", "Test Squire"], "Test Pair": ["Test Twin"] };

function input(): BossInput {
  return {
    maps: [
      { ID: "36", MapName_lang: "Deadmines", InstanceType: "1" },
      { ID: "189", MapName_lang: "Scarlet Monastery", InstanceType: "1" },
      { ID: "2999", MapName_lang: "Ruins of Lordaeron", InstanceType: "1" },
      { ID: "3001", MapName_lang: "The Shaper's Terrace", InstanceType: "1" },
      { ID: "249", MapName_lang: "Onyxia's Lair", InstanceType: "2" },
      { ID: "13", MapName_lang: "Test Dungeon", InstanceType: "1" },
    ],
    encounters: [
      enc(9003, 36, "Test Captain", 6000),
      enc(9001, 36, "Test Brute", 0),
      enc(9002, 36, "Test Cook", 5000),
      enc(9004, 36, "Test Pair", 1000, 1),
      enc(9005, 36, "Season Boss", 500, 198), // another season's difficulty
      enc(9101, 189, "Test Ghost", 0),
      enc(9102, 189, "Test Champion", 2000),
      enc(9103, 189, "Test Herald", 1000),
      enc(9104, 189, "Test Unplaced", 3000),
      enc(9201, 2999, "Test Wolf", 0),
      enc(9202, 2999, "Test Lich", 1000),
      enc(9301, 3001, "Test Raptor", 0),
      enc(9401, 249, "Test Dragon", 0),
      enc(9501, 13, "Test Dummy", 0),
    ],
    itemRows: new Map([
      [7001, { ID: "7001", ClassID: "2", SubclassID: "4" }],
      [7002, { ID: "7002", ClassID: "4", SubclassID: "2" }],
      [7005, { ID: "7005", ClassID: "12", SubclassID: "0" }],
      [7006, { ID: "7006", ClassID: "9", SubclassID: "5" }],
    ]),
    sparseRows: new Map([
      [7001, { ID: "7001", AllowableClass: "-1" }],
      [7002, { ID: "7002", AllowableClass: "32767" }],
      [7005, { ID: "7005", AllowableClass: "0" }],
    ]),
    itemTemplates: new Map<number, SqlRow>([
      [7003, { entry: 7003, class: 4, subclass: 4, AllowableClass: 1 }],
      [7004, { entry: 7004, class: 15, subclass: 0, AllowableClass: -1 }],
    ]),
    creatureTemplates: [
      { Entry: 1, Name: "Test Brute", LootId: 101 },
      { Entry: 2, Name: "Test Captain", LootId: 102 },
      { Entry: 3, Name: "Test Captain", LootId: 103 }, // same name in the open world
      { Entry: 4, Name: "Test Cook", LootId: 0 },
      { Entry: 5, Name: "Test Twin", LootId: 105 }, // summoned: spawned nowhere
      { Entry: 6, Name: "Test Champion", LootId: 106 },
      { Entry: 7, Name: "Test Squire", LootId: 107 },
      { Entry: 8, Name: "Test Wolf", LootId: 108 }, // a Vanilla creature with a Forever boss's name
      { Entry: 9, Name: "Test Ghost", LootId: 109 },
    ],
    creatures: [
      { id: 1, map: 36 },
      { id: 2, map: 36 },
      { id: 3, map: 0 },
      { id: 4, map: 36 },
      { id: 6, map: 189 },
      { id: 7, map: 189 },
      { id: 8, map: 0 },
      { id: 9, map: 189 },
    ],
    creatureLoot: [
      loot(101, 7001, 40),
      loot(101, 7002, 0.5), // below 1 %
      loot(101, 7006, 0.2), // a recipe: any chance
      loot(101, 0, 100, 0, -500), // a reference table: left out
      loot(102, 7001, 12.34),
      loot(102, 7003, 0, 1), // group 1: 100 - 20 shared by the two zero rows
      loot(102, 7004, 0, 1),
      loot(102, 7002, 20, 1),
      loot(102, 7005, -0.3), // a quest drop below 1 %
      loot(103, 7002, 99), // the open-world Test Captain's: not the boss's
      loot(105, 7004, 5),
      loot(106, 7001, 10),
      loot(107, 7001, 30),
      loot(107, 7003, 2),
      loot(108, 7001, 50),
      loot(109, 7002, 0.04, 0), // a 0.04 % item: not a quest item or recipe
      loot(109, 7006, 0.04, 0), // a recipe that rounds to 0.0
    ],
    quests: [
      { entry: 400, ReqItemId1: 7005 },
      { entry: 300, ReqItemId1: 0, ReqItemId2: 7005 },
    ],
    recipeItems: new Map([[7006, new Set([20002, 20001])]]),
  };
}

const { bosses, drops } = buildBosses(input(), { notes, together });
const boss = (id: number) => bosses.find((b) => b.id === id);
const dropsOf = (id: number) => drops.filter((d) => d.bossId === id).map((d) => ({ ...d, bossId: undefined }));

describe("bosses", () => {
  it("takes our dungeons' encounters of the base difficulties, in the client's order", () => {
    expect(bosses.filter((b) => b.dungeonId === "dm").map((b) => [b.position, b.name])).toEqual([
      [1, "Test Brute"],
      [2, "Test Pair"],
      [3, "Test Cook"],
      [4, "Test Captain"],
    ]);
  });

  it("marks the hand-made final and optional bosses", () => {
    expect(boss(9003)).toMatchObject({ final: true, optional: false });
    expect(boss(9002)).toMatchObject({ final: false, optional: true });
    expect(boss(9001)).toMatchObject({ final: false, optional: false });
  });

  it("puts a wing's bosses in their wing, each numbered from 1, with the wing's final", () => {
    const sm = bosses.filter((b) => b.dungeonId === "sm");
    expect(sm.map((b) => [b.wingId, b.position, b.name, b.final])).toEqual([
      ["graveyard", 1, "Test Ghost", true],
      ["armory", 1, "Test Herald", false],
      ["armory", 2, "Test Champion", true],
    ]);
  });

  it("without a hand-made final the client's last boss ends it; raids and unknown maps are left out", () => {
    expect(bosses.filter((b) => b.dungeonId === "lordaeron").map((b) => [b.name, b.final])).toEqual([
      ["Test Wolf", false],
      ["Test Lich", true],
    ]);
    // "The Shaper's Terrace" is our "Shaper's Terrace".
    expect(boss(9301)).toMatchObject({ dungeonId: "shaper", final: true });
    expect(boss(9401)).toBeUndefined();
    expect(boss(9501)).toBeUndefined();
    expect(boss(9005)).toBeUndefined();
  });
});

describe("boss loot", () => {
  it("only the boss's own rows: >= 1 %, plus recipes at any chance, highest first; references left out", () => {
    expect(dropsOf(9001)).toEqual([
      { itemId: 7001, position: 1, chance: 40, classId: 2, subclassId: 4 },
      { itemId: 7006, position: 2, chance: 0.2, classId: 9, subclassId: 5, recipeId: 20001 },
    ]);
  });

  it("the creature spawned in the dungeon, not a namesake elsewhere; groups share what is left of 100 %", () => {
    expect(dropsOf(9003)).toEqual([
      { itemId: 7003, position: 1, chance: 40, classId: 4, subclassId: 4, classes: 1 },
      { itemId: 7004, position: 2, chance: 40, classId: 15, subclassId: 0 },
      { itemId: 7002, position: 3, chance: 20, classId: 4, subclassId: 2 },
      { itemId: 7001, position: 4, chance: 12.3, classId: 2, subclassId: 4 },
      // A quest drop: kept under 1 %, with the (lowest) quest that asks for it.
      { itemId: 7005, position: 5, chance: 0.3, classId: 12, subclassId: 0, questId: 300 },
    ]);
  });

  it("a summoned boss (spawned nowhere) and creatures fought together; the best chance per item", () => {
    expect(dropsOf(9004)).toEqual([{ itemId: 7004, position: 1, chance: 5, classId: 15, subclassId: 0 }]);
    expect(dropsOf(9102)).toEqual([
      { itemId: 7001, position: 1, chance: 30, classId: 2, subclassId: 4 },
      { itemId: 7003, position: 2, chance: 2, classId: 4, subclassId: 4, classes: 1 },
    ]);
  });

  it("no loot for a boss without a loot table, nor for Forever's own dungeons", () => {
    expect(dropsOf(9002)).toEqual([]);
    expect(dropsOf(9201)).toEqual([]);
  });

  it("a tiny recipe chance stays at 0.1 %; other tiny drops go", () => {
    expect(dropsOf(9101)).toEqual([
      { itemId: 7006, position: 1, chance: 0.1, classId: 9, subclassId: 5, recipeId: 20001 },
    ]);
  });

  it("ownDrops: quest chances are negative, zero rows outside a group never drop", () => {
    expect(ownDrops([loot(1, 5, -50), loot(1, 6, 0), loot(1, 7, 0, 2), loot(1, 8, 70, 2)])).toEqual([
      { item: 5, chance: 50, quest: true },
      { item: 6, chance: 0, quest: false },
      { item: 7, chance: 30, quest: false },
      { item: 8, chance: 70, quest: false },
    ]);
  });
});
