import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { beforeRosters } from "./beforeRosters";
import type { ItemDatabase, RecipeRecord } from "@/core/recipes/build";
import { openDatabase, type Db } from "@/server/db";
import {
  characterProfessions,
  characterRecipes,
  characterRecipeScans,
  itemImport,
  items,
  recipeFinds,
  recipes,
  recipeSources,
} from "@/server/db/schema";
import { writeItemDatabase } from "@/server/itemDb";
import { rebuild, upload } from "@/server/uploads";

// WEB-90 (handoff B4): the item database import and the learned recipes of every upload.

const ADMIN = "Nico#1000";
const META = { build: "1.60.1.70790", era: "1.15.9.70576", cmangos: "abc" };

const r = (id: number, skillLineId: number, over: Partial<RecipeRecord> = {}): RecipeRecord => ({
  id,
  name: `Test Recipe ${id}`,
  skillLineId,
  createdItemId: id + 100,
  orange: 1,
  yellow: 20,
  green: 25,
  grey: 30,
  obtainable: true,
  foreverOnly: false,
  ...over,
});

/** Invented: 1 trainer, 2 boss drop, 3 trainer, 4 rep, 9 drop or limited vendor (Tailoring); 10 Cooking trainer. */
const DATABASE: ItemDatabase = {
  items: [{ id: 101, name: "Test Item 101", quality: 1, iconName: "inv_test" }, { id: 102 }],
  recipes: [r(1, 197), r(2, 197), r(3, 197), r(4, 197), r(9, 197), r(10, 185)],
  reagents: [{ recipeId: 2, itemId: 101, count: 3 }],
  sources: [
    { recipeId: 1, kind: "trainer", isRare: false },
    { recipeId: 2, kind: "drop", place: "Test Spire", npc: "Test Boss", isRare: true },
    { recipeId: 3, kind: "trainer", isRare: false },
    { recipeId: 4, kind: "rep", faction: "Test Brotherhood", rank: "Honored", isRare: true },
    { recipeId: 9, kind: "drop", isRare: true },
    { recipeId: 9, kind: "vendor_limited", isRare: false },
    { recipeId: 10, kind: "trainer", isRare: false },
  ],
};

const lua = (body: string) => new TextEncoder().encode(`return { schemaVersion = 2, ${body} }`);
/** Nico's file: Ves, with `ves` as the rest of his record. */
const file = (version: number, ves: string) =>
  lua(`
    self = { battleTag = "${ADMIN}", displayName = "Nico", version = ${version},
      chars = { V = { name = "Ves Example", classFile = "WARLOCK", level = 40, updatedAt = ${version}, ${ves} } } },
    settings = { clubId = 1, clubName = "Friends" },
  `);
const tailoring = (scannedAt: number) =>
  `professions = { [197] = { name = "Tailoring", rank = 120, max = 150, link = "trade:Player-1-0A:3273:197", linkType = "short", scannedAt = ${scannedAt} } }`;

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = beforeRosters(openDatabase(path.join(dir, "test.sqlite")));
  writeItemDatabase(db, DATABASE, META, 1);
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const known = () =>
  db
    .select()
    .from(characterRecipes)
    .all()
    .map(
      (k) =>
        `${k.guid} ${k.recipeId}${k.itemId !== null ? `>${k.itemId}` : ""} @${k.firstSeenAt}${k.baseline ? " base" : ""}`,
    )
    .sort();
const finds = () =>
  db
    .select()
    .from(recipeFinds)
    .all()
    .map((f) => `${f.uploadId} ${f.guid} ${f.recipeId}${f.postedAt !== null ? " posted" : ""}`);

describe("item database", () => {
  it("writes once; the same data again changes nothing", () => {
    expect(db.select().from(recipes).all()).toHaveLength(6);
    expect(db.select().from(recipeSources).all()).toHaveLength(7);
    expect(db.select().from(itemImport).get()).toMatchObject({ build: META.build, items: 2, recipes: 6 });
    expect(writeItemDatabase(db, DATABASE, META, 2)).toEqual({ changed: false });
    expect(db.select().from(itemImport).get()!.importedAt).toBe(1);
    const next = { ...DATABASE, recipes: DATABASE.recipes.slice(1) };
    expect(writeItemDatabase(db, next, META, 3)).toEqual({ changed: true });
    expect(
      db
        .select()
        .from(recipes)
        .all()
        .map((x) => x.id),
    ).toEqual([2, 3, 4, 9, 10]);
  });
});

describe("learned recipes", () => {
  it("baseline first, then new ones; rare finds only for drops and rep; never on a rebuild", () => {
    // First scan: the baseline.
    upload(db, file(100, `${tailoring(90)}, recipes = { [1] = 101 }, recipesAt = 95`), ADMIN, 1000, ADMIN);
    expect(known()).toEqual(["V 1>101 @95 base"]);
    expect(finds()).toEqual([]);
    expect(db.select().from(characterRecipeScans).all()).toEqual([
      { guid: "V", owner: ADMIN, recipesAt: 95, firstUploadId: 1, uploadId: 1 },
    ]);
    expect(db.select().from(characterProfessions).all()).toEqual([
      {
        guid: "V",
        skillLineId: 197,
        owner: ADMIN,
        name: "Tailoring",
        skill: 120,
        max: 150,
        spec: null,
        link: "trade:Player-1-0A:3273:197",
        linkType: "short",
        scannedAt: 90,
      },
    ]);

    // Learned: a boss drop (rare), a trainer recipe, one with a vendor too (not rare), and one of Forever's own.
    upload(
      db,
      file(
        200,
        `${tailoring(190)}, recipes = { [1] = 101, [2] = 102, [3] = 103, [9] = 109, [1229504] = 279972 }, recipesAt = 195`,
      ),
      ADMIN,
      2000,
      ADMIN,
    );
    expect(known()).toEqual([
      "V 1229504>279972 @195",
      "V 1>101 @95 base",
      "V 2>102 @195",
      "V 3>103 @195",
      "V 9>109 @195",
    ]);
    expect(finds()).toEqual(["2 V 2"]);
    // Forever's own pair is kept, without a name.
    expect(
      db
        .select()
        .from(recipes)
        .all()
        .find((x) => x.id === 1229504),
    ).toMatchObject({
      createdItemId: 279972,
      skillLineId: null,
      origin: "upload",
      foreverOnly: true,
    });
    expect(
      db
        .select()
        .from(items)
        .all()
        .find((x) => x.id === 279972),
    ).toMatchObject({ name: null, origin: "upload" });

    // Cooking's first recipe is its baseline; a dropped recipe goes; the profession's scan time stays the newest.
    upload(
      db,
      file(
        300,
        `professions = { [197] = { name = "Tailoring", rank = 125, max = 150 }, [185] = { name = "Cooking", rank = 1, max = 75 } },
         recipes = { [1] = 101, [2] = 102, [9] = 109, [1229504] = 279972, [10] = 110, [4] = 104 }, recipesAt = 295`,
      ),
      ADMIN,
      3000,
      ADMIN,
    );
    expect(known()).toEqual([
      "V 10>110 @295 base",
      "V 1229504>279972 @195",
      "V 1>101 @95 base",
      "V 2>102 @195",
      "V 4>104 @295",
      "V 9>109 @195",
    ]);
    expect(finds()).toEqual(["2 V 2", "3 V 4"]);
    const professions = db.select().from(characterProfessions).all();
    expect(professions.find((p) => p.skillLineId === 197)).toMatchObject({
      skill: 125,
      link: "trade:Player-1-0A:3273:197",
      scannedAt: 190,
    });
    expect(professions.find((p) => p.skillLineId === 185)).toMatchObject({ skill: 1, scannedAt: null });

    // An addon without recipes (an older one, or a relay): what is stored stays.
    upload(
      db,
      file(400, `professions = { [197] = { name = "Tailoring", rank = 130, max = 150 } }`),
      ADMIN,
      4000,
      ADMIN,
    );
    expect(known()).toHaveLength(6);
    expect(db.select().from(characterProfessions).all()).toHaveLength(1);

    // A rebuild holds the same and writes no find again.
    const before = known();
    rebuild(db, ADMIN);
    expect(known()).toEqual(before);
    expect(finds()).toEqual(["2 V 2", "3 V 4"]);
  });

  it("an import that has one of Forever's own recipes replaces the uploaded row", () => {
    upload(db, file(100, `recipes = { [1] = 101 }`), ADMIN, 1000, ADMIN);
    upload(
      db,
      file(200, `recipes = { [1] = 101, [1229504] = 279972 }, recipeLines = { [1229504] = 197 }`),
      ADMIN,
      2000,
      ADMIN,
    );
    expect(
      db
        .select()
        .from(recipes)
        .all()
        .find((x) => x.id === 1229504),
    ).toMatchObject({ skillLineId: 197, origin: "upload" });
    const withBanner: ItemDatabase = {
      ...DATABASE,
      items: [...DATABASE.items, { id: 279972, name: "Test Banner" }],
      recipes: [...DATABASE.recipes, r(1229504, 197, { createdItemId: 279972, foreverOnly: true })],
    };
    writeItemDatabase(db, withBanner, META, 5);
    expect(
      db
        .select()
        .from(recipes)
        .all()
        .find((x) => x.id === 1229504),
    ).toMatchObject({
      name: "Test Recipe 1229504",
      origin: "import",
    });
    expect(
      db
        .select()
        .from(items)
        .all()
        .find((x) => x.id === 279972),
    ).toMatchObject({ name: "Test Banner", origin: "import" });
    // The character still knows it (Forever's own: not rare, no find).
    expect(known()).toContain("V 1229504>279972 @2000");
    expect(finds()).toEqual([]);
  });

  it("a character that leaves the data takes its rows along", () => {
    upload(db, file(100, `${tailoring(90)}, recipes = { [1] = 101 }`), ADMIN, 1000, ADMIN);
    upload(
      db,
      lua(`self = { battleTag = "${ADMIN}", version = 200, chars = { W = { name = "Wes Example", updatedAt = 200 } } },
        settings = { clubId = 1, clubName = "Friends" }`),
      ADMIN,
      2000,
      ADMIN,
    );
    expect(known()).toEqual([]);
    expect(db.select().from(characterProfessions).all()).toEqual([]);
    expect(db.select().from(characterRecipeScans).all()).toEqual([]);
  });
});
