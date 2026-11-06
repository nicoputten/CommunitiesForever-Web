import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import { merge } from "@/core/merge";
import type { Dataset } from "@/core/model";
import { normalize } from "@/core/normalize";
import { isRareRecipe, learnRecipes, type LearnInput } from "@/core/recipes/learned";

// WEB-90: the diff of learned recipes, the baseline rule, rare finds, and reading CF-38's fields.

const LINES: Record<number, number> = { 1: 197, 2: 197, 3: 197, 10: 185, 11: 185 };
const base = (over: Partial<LearnInput>): LearnInput => ({
  uploaded: {},
  stored: new Map(),
  scannedBefore: true,
  scannedProfessions: new Set(),
  skillLineOf: (r) => LINES[r],
  ...over,
});

describe("learnRecipes", () => {
  it("the character's first scan is all baseline", () => {
    const r = learnRecipes(base({ uploaded: { 1: 101, 2: 0 }, scannedBefore: false }));
    expect(r.added).toEqual([
      { recipe: 1, item: 101, skillLine: 197, baseline: true },
      { recipe: 2, item: null, skillLine: 197, baseline: true },
    ]);
    expect(r.removed).toEqual([]);
  });

  it("a new recipe of a known profession is learned; vanished ones go", () => {
    const r = learnRecipes(
      base({
        uploaded: { 1: 101, 3: 103 },
        stored: new Map([
          [1, 197],
          [2, 197],
        ]),
      }),
    );
    expect(r.added).toEqual([{ recipe: 3, item: 103, skillLine: 197, baseline: false }]);
    expect(r.removed).toEqual([2]);
  });

  it("the first recipes of a profession the character had none of are its baseline, unless it was scanned", () => {
    const stored = new Map<number, number | undefined>([[1, 197]]);
    expect(learnRecipes(base({ uploaded: { 1: 101, 10: 110 }, stored })).added).toEqual([
      { recipe: 10, item: 110, skillLine: 185, baseline: true },
    ]);
    const scanned = new Set([185]);
    expect(learnRecipes(base({ uploaded: { 1: 101, 10: 110 }, stored, scannedProfessions: scanned })).added).toEqual([
      { recipe: 10, item: 110, skillLine: 185, baseline: false },
    ]);
  });

  it("a recipe of an unknown profession (Forever's own) counts once the character has a baseline", () => {
    const r = learnRecipes(base({ uploaded: { 1: 101, 1229504: 279972 }, stored: new Map([[1, 197]]) }));
    expect(r.added).toEqual([{ recipe: 1229504, item: 279972, baseline: false }]);
  });

  it("the same set again changes nothing", () => {
    const r = learnRecipes(base({ uploaded: { 1: 101 }, stored: new Map([[1, 197]]) }));
    expect(r).toEqual({ added: [], removed: [] });
  });
});

describe("isRareRecipe", () => {
  it("only when every source is a drop or rep", () => {
    expect(isRareRecipe([{ kind: "drop", isRare: true }])).toBe(true);
    expect(
      isRareRecipe([
        { kind: "rep", isRare: true },
        { kind: "drop", isRare: true },
      ]),
    ).toBe(true);
    expect(
      isRareRecipe([
        { kind: "drop", isRare: true },
        { kind: "vendor_limited", isRare: false },
      ]),
    ).toBe(false);
    expect(isRareRecipe([{ kind: "trainer", isRare: false }])).toBe(false);
    expect(isRareRecipe([])).toBe(false);
  });
});

describe("normalize (addon CF-38)", () => {
  const read = (char: string) =>
    normalize(
      parseLua(
        `return { schemaVersion = 2, self = { battleTag = "Ada#1001", chars = { G = { name = "Ada Example", ${char} } } } }`,
      ),
    ).characters.G!;

  it("reads recipe -> item pairs, the scan time, recipe lines and the profession fields", () => {
    const c = read(`recipes = { [3915] = 4344, [1229504] = 279972, [7421] = 0, ["x"] = 1, [5] = -2, [6] = "7" },
      recipesAt = 1700000000, recipeLines = { [3915] = 197, [9] = "no" },
      professions = { [197] = { name = "Tailoring", rank = 75, max = 150, link = "trade:Player-1-0A:3273:197",
        linkType = "long", spec = 0, scannedAt = 1699999999 }, [185] = { name = "Cooking", rank = 1, max = 75, linkType = "odd" } }`);
    expect(c.recipes).toEqual({ 3915: 4344, 1229504: 279972, 7421: 0 });
    expect(c.recipesAt).toBe(1700000000);
    expect(c.recipeLines).toEqual({ 3915: 197 });
    expect(c.professions["197"]).toEqual({
      name: "Tailoring",
      rank: 75,
      max: 150,
      link: "trade:Player-1-0A:3273:197",
      linkType: "long",
      spec: "0",
      scannedAt: 1699999999,
    });
    expect(c.professions["185"]).toEqual({ name: "Cooking", rank: 1, max: 75 });
  });

  it("keeps a long link whole, and drops one too long to be real rather than cut it", () => {
    const long = `trade:${"A".repeat(3000)}`;
    expect(read(`professions = { [197] = { link = "${long}" } }`).professions["197"]!.link).toBe(long);
    expect(read(`professions = { [197] = { link = "trade:${"A".repeat(5000)}" } }`).professions["197"]).toEqual({});
    // A wrapped link (not what CF-38 writes) loses its escapes like every string (rule 2).
    expect(
      read(`professions = { [197] = { link = "|cffffd000|Htrade:x|h[Tailoring]|h|r" } }`).professions["197"]!.link,
    ).toBe("[Tailoring]");
  });

  it("older addons send none of it: undefined, never an empty set", () => {
    const c = read(`professions = { [197] = { name = "Tailoring", rank = 75, max = 150 } }`);
    expect(c.recipes).toBeUndefined();
    expect(c.recipesAt).toBeUndefined();
    expect(c.recipeLines).toBeUndefined();
    expect(read(`recipes = {}`).recipes).toEqual({});
  });
});

describe("merge (CF-38 copies)", () => {
  // Nico's file and Ada's, each with a copy of Mira: the record by updatedAt, the recipes by recipesAt.
  const file = (who: string, mira: string): Dataset =>
    normalize(
      parseLua(`return { schemaVersion = 2, self = { battleTag = "${who}", version = 1 },
        people = { ["Mia#1003"] = { version = 1, chars = { M = { name = "Mira Example", ${mira} } } } } }`),
    );
  const newerRecord = file("Nico#1000", "updatedAt = 300, level = 30, recipes = { [1] = 101 }, recipesAt = 100");
  const newerRecipes = file(
    "Ada#1001",
    "updatedAt = 200, level = 29, recipes = { [1] = 101, [2] = 102 }, recipesAt = 250",
  );
  const noRecipes = file("Ada#1001", "updatedAt = 400, level = 31");

  it("takes the recipes from the newest scan, the rest from the newest record, in either order", () => {
    for (const m of [merge(newerRecord, newerRecipes), merge(newerRecipes, newerRecord)]) {
      expect(m.characters.M).toMatchObject({ level: 30, updatedAt: 300, recipes: { 1: 101, 2: 102 }, recipesAt: 250 });
    }
  });

  it("a newer copy without recipes (an older addon's relay) keeps the recipes", () => {
    for (const m of [merge(newerRecord, noRecipes), merge(noRecipes, newerRecord)]) {
      expect(m.characters.M).toMatchObject({ level: 31, recipes: { 1: 101 }, recipesAt: 100 });
    }
  });
});
