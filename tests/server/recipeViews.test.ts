import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { beforeRosters } from "./beforeRosters";
import type { ItemDatabase } from "@/core/recipes/build";
import { openDatabase, type Db } from "@/server/db";
import { writeItemDatabase } from "@/server/itemDb";
import {
  characterRecipeRows,
  recipeRows,
  recipeTotalRows,
  tooltipItems,
  withCreated,
  withSets,
} from "@/server/recipeViews";
import { upload } from "@/server/uploads";

// WEB-92: what the recipe pages read (src/server/recipeViews.ts), on invented data.

const ADMIN = "Nico#1000";
const DATABASE: ItemDatabase = {
  bosses: [{ id: 9001, name: "Test Boss", dungeonId: "dm", position: 1, final: true, optional: false }],
  // WEB-104: the item import's only record of which recipe a recipe item teaches.
  bossDrops: [{ bossId: 9001, itemId: 201, position: 1, chance: 5, classId: 9, subclassId: 2, recipeId: 1 }],
  // WEB-99: the hood is a piece of a set; the robe is in none.
  sets: [
    {
      id: 77,
      name: "Test Regalia",
      items: [{ id: 106, name: "Test Hood" }, { id: 107, name: "Test Gloves" }, { id: 108 }],
      bonuses: [{ threshold: 2, text: "+10 Armor." }],
    },
  ],
  items: [
    { id: 101, name: "Test Robe", quality: 4, iconName: "inv_test", armor: 50 },
    { id: 102, name: "Test Bolt", quality: 1, classId: 7, maxStack: 20 },
    { id: 103, name: "Test Stew", quality: 1 },
    {
      id: 201,
      name: "Pattern: Test Robe",
      quality: 2,
      classId: 9,
      subclassId: 2,
      use: ["Teaches you how to sew a Test Robe."],
    },
    { id: 202, name: "Pattern: Test Bolt", quality: 1, classId: 9, subclassId: 2 },
    { id: 106, name: "Test Hood", quality: 3, setId: 77 },
  ],
  recipes: [
    {
      id: 1,
      skillLineId: 197,
      createdItemId: 101,
      orange: 300,
      yellow: 315,
      green: 322,
      grey: 330,
      obtainable: true,
      foreverOnly: false,
      category: "Chest",
    },
    {
      id: 2,
      skillLineId: 197,
      createdItemId: 102,
      orange: 250,
      yellow: 255,
      green: 257,
      grey: 260,
      obtainable: true,
      foreverOnly: false,
      category: "Cloth",
    },
    {
      id: 3,
      skillLineId: 185,
      createdItemId: 103,
      orange: 1,
      yellow: 20,
      green: 25,
      grey: 30,
      obtainable: true,
      foreverOnly: false,
      category: "Food",
    },
    // Fishing has no recipes on the site.
    { id: 4, skillLineId: 356, obtainable: true, foreverOnly: false, orange: 1, yellow: 1, green: 1, grey: 1 },
  ],
  reagents: [{ recipeId: 1, itemId: 102, count: 12 }],
  sources: [{ recipeId: 1, kind: "drop", place: "Test Spire", isRare: true }],
};

const file = new TextEncoder().encode(`return { schemaVersion = 2,
  self = { battleTag = "${ADMIN}", displayName = "Nico", version = 100,
    chars = { V = { name = "Ves Example", classFile = "WARLOCK", level = 60, updatedAt = 100,
      professions = { [197] = { name = "Tailoring", rank = 300, max = 300, scannedAt = 90, spec = "Mooncloth" },
        [185] = { name = "Cooking", rank = 75, max = 150 } },
      recipes = { [1] = 101, [3] = 103, [1229504] = 279972 }, recipesAt = 95 } } },
  settings = { clubId = 1, clubName = "Friends" } }`);

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = beforeRosters(openDatabase(path.join(dir, "test.sqlite")));
  writeItemDatabase(db, DATABASE, { build: "b", era: "e", cmangos: "c" }, 1);
  upload(db, file, ADMIN, 1000, ADMIN);
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("recipe views", () => {
  it("reads one profession's recipes with their items, reagents, sources and knowers", () => {
    const rows = recipeRows(db, 197);
    expect(rows.recipes.map((r) => r.id).sort()).toEqual([1, 2]);
    expect([...rows.items.keys()].sort()).toEqual([101, 102]);
    expect(rows.reagents).toEqual([{ recipeId: 1, itemId: 102, count: 12 }]);
    expect(rows.sources.map((s) => s.place)).toEqual(["Test Spire"]);
    expect(rows.known).toEqual([{ guid: "V", recipeId: 1 }]);
    expect(rows.professions).toEqual([{ guid: "V", skillLineId: 197, skill: 300, spec: "Mooncloth", scannedAt: 90 }]);
  });

  it("reads every recipe profession for the search, never Fishing", () => {
    expect(
      recipeRows(db)
        .recipes.map((r) => r.id)
        .sort((a, b) => a - b),
    ).toEqual([1, 2, 3]);
  });

  it("counts a character's recipes per skill line; an upload-only recipe without a line counts nowhere", () => {
    const { professions, counts } = characterRecipeRows(db, "V");
    expect([...counts]).toEqual(
      expect.arrayContaining([
        [197, 1],
        [185, 1],
      ]),
    );
    expect(counts.size).toBe(2);
    expect(professions.find((p) => p.skillLineId === 185)?.scannedAt).toBeNull();
    expect(recipeTotalRows(db).known).toHaveLength(3);
  });

  it("gives an item's tooltip data, also for Forever's nameless one", () => {
    expect(tooltipItems(db, [101, 279972, 999])).toEqual([
      { id: 101, name: "Test Robe", quality: 4, icon: "inv_test", data: DATABASE.items[0] },
      { id: 279972, data: { id: 279972 } },
    ]);
  });

  it("gives a recipe item the item its recipe makes and the reagents (WEB-104)", () => {
    const robe = { id: 101, name: "Test Robe", quality: 4, icon: "inv_test", data: DATABASE.items[0] };
    // Which recipe it teaches from its boss drop.
    expect(tooltipItems(db, [201])[0]).toEqual({
      id: 201,
      name: "Pattern: Test Robe",
      quality: 2,
      data: DATABASE.items[3],
      creates: { item: robe, reagents: [{ id: 102, name: "Test Bolt", count: 12 }] },
    });
    // A recipe item no boss drops: nothing to add, unless the caller knows its recipe.
    expect(tooltipItems(db, [202])[0]!.creates).toBeUndefined();
    const [bolt] = withCreated(db, tooltipItems(db, [202]), new Map([[202, 2]]));
    expect(bolt!.creates).toEqual({
      item: { id: 102, name: "Test Bolt", quality: 1, data: DATABASE.items[1] },
      reagents: [],
    });
    // Any other item stays as it is.
    expect(withCreated(db, tooltipItems(db, [101]))[0]!.creates).toBeUndefined();
  });

  it("gives a set item its set; none for an item in no set or a set the database lacks (WEB-99)", () => {
    expect(tooltipItems(db, [106])[0]!.set).toEqual({
      name: "Test Regalia",
      items: [{ id: 106, name: "Test Hood" }, { id: 107, name: "Test Gloves" }, { id: 108 }],
      bonuses: [{ threshold: 2, text: "+10 Armor." }],
    });
    expect(tooltipItems(db, [101])[0]!.set).toBeUndefined();
    expect(withSets(db, [{ id: 5, data: { id: 5, setId: 999 } }])[0]!.set).toBeUndefined();
  });
});
