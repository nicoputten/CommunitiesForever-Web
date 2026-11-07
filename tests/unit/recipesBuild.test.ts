import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/core/recipes/csv";
import { buildItemDatabase, CMANGOS_TABLES, DB2_TABLES, type ImportInput, orangeOf } from "@/core/recipes/build";
import { readColumns, readRows } from "@/core/recipes/sqlDump";

// WEB-90: the item import, from invented fixtures in the real formats (tests/fixtures/items/README.md).

const DIR = path.join(__dirname, "../fixtures/items");
const csv = (file: string) => parseCsv(readFileSync(path.join(DIR, file), "utf8")).rows;

function input(): ImportInput {
  const db2: ImportInput["db2"] = {};
  for (const t of DB2_TABLES) db2[t] = csv(`forever/${t}.csv`);
  const sql = readFileSync(path.join(DIR, "cmangos.sql"), "utf8");
  const columns = readColumns(sql, CMANGOS_TABLES);
  const cmangos: ImportInput["cmangos"] = {};
  for (const t of CMANGOS_TABLES) cmangos[t] = readRows(sql, t, columns[t] ?? []);
  return { db2, era: { abilities: csv("era/SkillLineAbility.csv"), learn: csv("era/SpellEffect-learn.csv") }, cmangos };
}

const data = buildItemDatabase(input());
const recipe = (id: number) => data.recipes.find((r) => r.id === id);
const item = (id: number) => data.items.find((i) => i.id === id);
const sources = (id: number) =>
  data.sources.filter((s) => s.recipeId === id).map((s) => ({ ...s, recipeId: undefined }));

describe("recipes", () => {
  it("takes the recipe skill lines' spells that make or enchant an item, once each", () => {
    expect(data.recipes.map((r) => r.id)).toEqual([9001, 9002, 9003, 9004, 9005, 9006, 9007, 9008, 9009, 1200001]);
  });

  it("has the four thresholds, green halfway between yellow and grey", () => {
    expect(recipe(9001)).toMatchObject({ skillLineId: 197, orange: 50, yellow: 60, green: 70, grey: 80 });
    expect(recipe(9007)).toMatchObject({ yellow: 95, green: 102, grey: 110 });
  });

  it("orange: the lowest skill a source needs, the Forever client's recipe item first, never above yellow", () => {
    expect(recipe(9001)!.orange).toBe(50); // trainers ask 50 and 55
    expect(recipe(9003)!.orange).toBe(70); // the pattern: Forever 70, cmangos 75
    expect(recipe(9005)!.orange).toBe(65); // cmangos' pattern
    expect(recipe(9004)!.orange).toBe(1); // cmangos says 105, above Forever's yellow 100
    expect(recipe(9002)!.orange).toBe(1);
    expect(orangeOf(1, undefined, 50)).toBe(1);
    expect(orangeOf(10, 5, 50)).toBe(10);
  });

  it("names the created item, the reagents and a category", () => {
    expect(recipe(9001)).toMatchObject({ name: "Test Bolt", createdItemId: 5001, category: "Cloth" });
    expect(recipe(9003)!.category).toBe("Chest");
    expect(recipe(9005)!.category).toBe("Bag");
    expect(recipe(9002)!.category).toBe("Shirt");
    expect(recipe(9009)).toMatchObject({ category: "Bracer" });
    expect(recipe(9009)!.createdItemId).toBeUndefined();
    expect(data.reagents.filter((r) => r.recipeId === 9003)).toEqual([
      { recipeId: 9003, itemId: 5001, count: 4 },
      { recipeId: 9003, itemId: 5002, count: 1 },
    ]);
  });

  it("keeps Forever's own recipes without a source, and marks Era's untaught ones unobtainable", () => {
    expect(recipe(1200001)).toMatchObject({ foreverOnly: true, obtainable: true, createdItemId: 279999 });
    expect(sources(1200001)).toEqual([]);
    expect(recipe(9008)).toMatchObject({ foreverOnly: false, obtainable: false });
    expect(recipe(9001)).toMatchObject({ foreverOnly: false, obtainable: true });
  });
});

describe("sources", () => {
  it("trainers: cmangos' teach spells through Era's learn effects, and recipes learned with the profession", () => {
    expect(sources(9001)).toEqual([{ kind: "trainer", isRare: false }]);
    expect(sources(9002)).toEqual([{ kind: "trainer", isRare: false }]);
  });

  it("a boss drop through a reference table names the boss and the dungeon", () => {
    expect(sources(9003)).toEqual([{ kind: "drop", place: "Test Spire", npc: "Test Boss", isRare: true }]);
  });

  it("a world drop (more than three creatures, nested references) names nobody", () => {
    expect(sources(9007)).toEqual([{ kind: "drop", isRare: true }]);
  });

  it("rep: the vendor, faction and standing", () => {
    expect(sources(9004)).toEqual([
      { kind: "rep", npc: "Test Quartermaster", faction: "Test Brotherhood", rank: "Honored", isRare: true },
    ]);
  });

  it("vendors: limited stock, vendor templates, quests", () => {
    expect(sources(9005)).toEqual([
      { kind: "vendor_limited", npc: "Test Merchant", isRare: false },
      // WEB-96's dungeon boss drops it too.
      { kind: "drop", place: "Deadmines", npc: "Test Deadmines Boss", isRare: true },
    ]);
    expect(sources(9006)).toEqual([
      { kind: "vendor", npc: "Test Peddler", isRare: false },
      { kind: "quest", quest: "A Test Quest", isRare: false },
    ]);
    expect(sources(9009)).toEqual([
      { kind: "trainer", isRare: false },
      { kind: "quest", quest: "Another Test, With a Comma", isRare: false },
    ]);
  });
});

describe("items", () => {
  it("what recipes make and use, and what dungeon bosses drop (WEB-96)", () => {
    expect(data.items.map((i) => i.id)).toEqual([5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 6005, 279999]);
  });

  it("the tooltip: client data first, cmangos' numbers, the Equip and Use texts", () => {
    expect(item(5003)).toEqual({
      id: 5003,
      name: "Test Shirt Item",
      quality: 2,
      itemLevel: 12,
      requiredLevel: 5,
      bonding: 2,
      classId: 4,
      subclassId: 1,
      inventoryType: 4,
      typeName: "Cloth",
      iconName: "inv_shirt_test",
      maxStack: 1,
      armor: 10,
      durability: 30,
      stats: [{ type: 5, value: 3 }],
      equip: ["Increases your test skill by 5."],
      use: ["Restores 120.0 mana and 80 health. (5 Min Cooldown)"],
    });
    expect(item(5004)).toMatchObject({
      stats: [
        { type: 5, value: 12 },
        { type: 6, value: -4 },
      ],
      resistances: { fire: 5 },
    });
    expect(item(5002)!.description).toBe("Made up for tests.");
    // WEB-95: the duration through SpellMisc and SpellDuration.
    expect(item(5008)!.equip).toEqual(["Lasts 30 min."]);
  });

  it("icons through the item's default appearance; Forever's own items without a name", () => {
    expect(item(5005)!.iconName).toBe("inv_gauntlets_test");
    expect(item(279999)).toEqual({
      id: 279999,
      classId: 0,
      subclassId: 8,
      inventoryType: 0,
      typeName: "Other",
      iconName: "inv_banner_test",
    });
  });
});

describe("bosses (WEB-96)", () => {
  it("our dungeons' encounters, the boss's own drops; their items join the items", () => {
    // "Deadmines" is ours; "Test Spire" isn't; another season's encounter is left out. The hand-made final (Edwin
    // VanCleef) isn't listed, so the last boss ends it.
    expect(data.bosses).toEqual([
      { id: 8001, name: "Test Deadmines Boss", dungeonId: "dm", position: 1, final: true, optional: false },
    ]);
    // 25 % kept, 0.5 % left out, a recipe at 0.5 % kept with its skill (cmangos' RequiredSkillRank) and profession.
    expect(data.bossDrops).toEqual([
      { bossId: 8001, itemId: 5003, position: 1, chance: 25, classId: 4, subclassId: 1 },
      {
        bossId: 8001,
        itemId: 6005,
        position: 2,
        chance: 0.5,
        classId: 9,
        subclassId: 2,
        recipeId: 9005,
        skill: 65,
        line: 197,
      },
    ]);
  });
});
