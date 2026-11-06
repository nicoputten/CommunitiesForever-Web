import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
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
      professions = { [197] = { name = "Tailoring", rank = 75, max = 150, link = "|cffffd000|Htrade:x|h[Tailoring]|h|r",
        linkType = "long", spec = 0, scannedAt = 1699999999 }, [185] = { name = "Cooking", rank = 1, max = 75, linkType = "odd" } }`);
    expect(c.recipes).toEqual({ 3915: 4344, 1229504: 279972, 7421: 0 });
    expect(c.recipesAt).toBe(1700000000);
    expect(c.recipeLines).toEqual({ 3915: 197 });
    expect(c.professions["197"]).toEqual({
      name: "Tailoring",
      rank: 75,
      max: 150,
      link: "[Tailoring]",
      linkType: "long",
      spec: "0",
      scannedAt: 1699999999,
    });
    expect(c.professions["185"]).toEqual({ name: "Cooking", rank: 1, max: 75 });
  });

  it("older addons send none of it: undefined, never an empty set", () => {
    const c = read(`professions = { [197] = { name = "Tailoring", rank = 75, max = 150 } }`);
    expect(c.recipes).toBeUndefined();
    expect(c.recipesAt).toBeUndefined();
    expect(c.recipeLines).toBeUndefined();
    expect(read(`recipes = {}`).recipes).toEqual({});
  });
});
