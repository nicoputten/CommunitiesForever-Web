import { describe, expect, it } from "vitest";
import { recordCharacters } from "@/core/views";
import { itemFallbackName, itemSetView, itemTooltip, reagentsLine } from "@/core/views/itemTooltip";
import {
  characterRecipeLines,
  defaultTab,
  filterRows,
  professionRecipes,
  recipeSkillLine,
  recipeTotals,
  searchEntries,
  searchGroups,
  sourceViews,
  tabCounts,
  type ItemData,
  type KnownData,
  type RecipeData,
  type SourceData,
} from "@/core/views/recipes";
import { D, NOW, sample } from "./sample";

// WEB-92: the recipe screens' view models, with invented recipes (names and numbers from the boards' examples).

const TAILORING = 197;
const recipe = (r: Partial<RecipeData> & { id: number }): RecipeData => ({
  skillLineId: TAILORING,
  obtainable: true,
  foreverOnly: false,
  ...r,
});

const RECIPES: RecipeData[] = [
  recipe({ id: 1, createdItemId: 101, orange: 300, yellow: 315, green: 322, grey: 330, category: "Chest" }),
  recipe({ id: 2, createdItemId: 102, orange: 300, yellow: 315, green: 322, grey: 330, category: "Chest" }),
  recipe({ id: 3, createdItemId: 103, orange: 185, yellow: 195, green: 200, grey: 205, category: "Bags" }),
  recipe({ id: 4, createdItemId: 104, orange: 175, yellow: 180, green: 182, grey: 185, category: "Cloth" }),
  // Forever's own: no name, no source.
  recipe({ id: 5, createdItemId: 279972, orange: 290, yellow: 300, green: 307, grey: 315, foreverOnly: true }),
  // Removed from the game, known by nobody: left out.
  recipe({ id: 6, createdItemId: 106, orange: 100, yellow: 110, green: 115, grey: 120, obtainable: false }),
  // Removed, but Mira knows it: shown, not counted.
  recipe({ id: 7, createdItemId: 107, orange: 50, yellow: 60, green: 65, grey: 70, obtainable: false }),
  recipe({
    id: 8,
    skillLineId: 333,
    name: "Enchant Bracer - Minor Health",
    orange: 1,
    yellow: 70,
    green: 90,
    grey: 110,
  }),
];

const ITEMS = new Map<number, ItemData>(
  [
    { id: 101, name: "Robe of the Archmage", quality: 4, iconName: "inv_chest_cloth_38" },
    { id: 102, name: "Truefaith Vestments", quality: 4 },
    { id: 103, name: "Mageweave Bag", quality: 1 },
    { id: 104, name: "Bolt of Mageweave", quality: 1 },
    { id: 279972 },
    { id: 107, name: "Old Shirt", quality: 1 },
  ].map((i) => [i.id, i]),
);

const SOURCES: SourceData[] = [
  { recipeId: 1, kind: "drop", place: "Blackrock Spire" },
  { recipeId: 2, kind: "drop", place: "Lower Blackrock Spire" },
  { recipeId: 3, kind: "trainer" },
  { recipeId: 3, kind: "vendor_limited" },
  { recipeId: 4, kind: "trainer" },
];

const KNOWN: KnownData[] = [
  { guid: "Player-1-MIRA", recipeId: 1 },
  { guid: "Player-1-MIRA", recipeId: 3 },
  { guid: "Player-1-MIRA", recipeId: 4 },
  { guid: "Player-1-MIRA", recipeId: 5 },
  { guid: "Player-1-MIRA", recipeId: 7 },
  { guid: "Player-1-LIA", recipeId: 3 },
  { guid: "Player-1-VES", recipeId: 3 },
  { guid: "Player-1-VES", recipeId: 4 },
  // Someone no longer in the data counts for nothing.
  { guid: "Player-1-GONE", recipeId: 2 },
];

const characters = recordCharacters(sample(), NOW);

function view(extra: Partial<Parameters<typeof professionRecipes>[0]> = {}) {
  return professionRecipes({
    skillLine: TAILORING,
    characters,
    recipes: RECIPES,
    items: ITEMS,
    sources: SOURCES,
    reagents: [{ recipeId: 1, itemId: 104, count: 12 }],
    known: KNOWN,
    professions: [
      { guid: "Player-1-MIRA", skillLineId: TAILORING, scannedAt: NOW - 2 * D },
      { guid: "Player-1-VES", skillLineId: TAILORING, scannedAt: NOW - 19 * D },
    ],
    now: NOW,
    ...extra,
  });
}

describe("profession page (recipes-page)", () => {
  const v = view();
  const row = (id: number) => v.rows.find((r) => r.id === id)!;

  it("counts obtainable recipes: Forever's own in the total, never as Nobody has without a source", () => {
    expect([v.total, v.known, v.nobody]).toEqual([5, 4, 1]);
    expect(row(2).nobody).toBe(true);
    expect(row(5).nobody).toBe(false);
    expect(v.rows.some((r) => r.id === 6)).toBe(false);
    expect(row(7).obtainable).toBe(false);
  });

  it("names a nameless item by its ID and keeps the item's name and quality otherwise", () => {
    expect(row(5)).toMatchObject({ name: "Item 279972", named: false, quality: "common" });
    expect(row(1)).toMatchObject({ name: "Robe of the Archmage", quality: "epic", icon: "inv_chest_cloth_38" });
    expect(itemFallbackName(279972)).toBe("Item 279972");
  });

  it("groups by item type, the group with the highest skill first, rows by skill", () => {
    expect(v.rows.map((r) => r.id)).toEqual([1, 2, 5, 7, 3, 4]);
    expect(v.rows[2]!.category).toBe("Other");
    expect(v.types).toEqual(["Chest", "Other", "Bags", "Cloth"]);
  });

  it("colours each crafter's dot from their skill against the four thresholds", () => {
    // Mira 300 (sample), Lia 205, Ves 187.
    expect(row(3).knownBy.map((k) => [k.name, k.difficulty])).toEqual([
      ["Mira Sunstrider", "grey"],
      ["Lia Thornwhisper", "grey"],
      ["Ves Doombringer", "orange"],
    ]);
    expect(row(1).knownBy.map((k) => k.difficulty)).toEqual(["orange"]);
  });

  it("lists the easiest source first", () => {
    expect(row(3).sources).toEqual([{ label: "Trainer" }, { label: "Vendor", detail: "Limited" }]);
    expect(row(1).sources).toEqual([{ label: "Drop", detail: "Blackrock Spire" }]);
  });

  it("marks a crafter's scan stale after 7 days", () => {
    const ves = v.crafters.find((c) => c.name === "Ves Doombringer")!;
    expect(ves).toMatchObject({ stale: true, scannedAt: NOW - 19 * D });
    expect(v.crafters.find((c) => c.name === "Mira Sunstrider")!.stale).toBe(false);
    expect(v.crafters[0]).toMatchObject({ name: "Mira Sunstrider", best: true });
  });

  it("filters by tab, character, type, skill and search", () => {
    const ids = (f: Parameters<typeof filterRows>[1]) => filterRows(v.rows, f).map((r) => r.id);
    expect(ids({ tab: "missing" })).toEqual([2]);
    expect(ids({ tab: "known" })).toEqual([1, 5, 7, 3, 4]);
    expect(ids({ tab: "known", char: "Player-1-VES" })).toEqual([3, 4]);
    expect(ids({ tab: "all", type: "Chest" })).toEqual([1, 2]);
    expect(ids({ tab: "all", skill: "151-225" })).toEqual([3, 4]);
    expect(ids({ tab: "all", skill: "nonsense" })).toEqual([1, 2, 5, 7, 3, 4]);
    expect(ids({ tab: "all", matches: new Set([4]) })).toEqual([4]);
    expect(defaultTab("Player-1-VES")).toBe("known");
    expect(defaultTab(undefined)).toBe("all");
  });

  it("counts Known for the picked character (RC06: Known 86 for Ves)", () => {
    expect(tabCounts(v, undefined)).toEqual({ all: 5, known: 4, missing: 1 });
    expect(tabCounts(v, "Player-1-VES")).toEqual({ all: 5, known: 2, missing: 1 });
  });

  it("says when someone has the profession but nobody ever scanned it (RC06)", () => {
    const engineering = professionRecipes({
      ...view(),
      skillLine: 202,
      characters,
      recipes: [recipe({ id: 9, skillLineId: 202 })],
      items: ITEMS,
      sources: [],
      reagents: [],
      known: [],
      professions: [],
      now: NOW,
    });
    expect(engineering).toMatchObject({ notScanned: true, total: 1, name: "Engineering" });
    expect(v.notScanned).toBe(false);
    // WEB-104: a link to a recipe nobody knows (?recipe=9) finds its row to open, scanned or not.
    expect(engineering.rows.find((r) => r.id === 9)).toMatchObject({ id: 9, knownBy: [], nobody: true });
  });

  it("finds a profession page by its slug", () => {
    expect(recipeSkillLine("tailoring")).toBe(197);
    expect(recipeSkillLine("first-aid")).toBe(129);
    expect(recipeSkillLine("herbalism")).toBeUndefined();
    expect(recipeSkillLine("fishing")).toBeUndefined();
  });
});

describe("recipe lines (recipes-character, recipes-search)", () => {
  const ves = characters.find((c) => c.name === "Ves Doombringer")!;

  it("shows a count per crafting profession, 'as of' after 7 days, 'not scanned' without a scan", () => {
    const lines = characterRecipeLines(
      ves,
      [
        { guid: ves.guid, skillLineId: 197, scannedAt: NOW - 19 * D, spec: "Mooncloth" },
        { guid: ves.guid, skillLineId: 185, scannedAt: NOW - D },
      ],
      new Map([
        [197, 86],
        [185, 12],
      ]),
      NOW,
    );
    expect(lines["197"]).toEqual({
      kind: "count",
      skillLine: "197",
      slug: "tailoring",
      count: 86,
      staleAt: NOW - 19 * D,
      spec: "Mooncloth",
    });
    expect(lines["185"]).toEqual({ kind: "count", skillLine: "185", slug: "cooking", count: 12 });
    expect(lines["333"]).toEqual({ kind: "notScanned", skillLine: "333", name: "Enchanting" });
  });

  it("gives gathering professions and Fishing no line", () => {
    const mira = characters.find((c) => c.name === "Mira Sunstrider")!;
    const lines = characterRecipeLines(mira, [], new Map(), NOW);
    expect(Object.keys(lines).sort()).toEqual(["197", "333"]);
  });

  it("counts '112 of 185' from obtainable recipes and characters in the data", () => {
    const totals = recipeTotals(RECIPES, KNOWN, new Set(characters.map((c) => c.guid)));
    expect(totals["197"]).toEqual({ known: 4, total: 5 });
    expect(totals["333"]).toEqual({ known: 0, total: 1 });
  });
});

describe("live search (recipes-search)", () => {
  const entries = searchEntries({
    characters,
    recipes: RECIPES,
    items: ITEMS,
    sources: SOURCES,
    reagents: [],
    known: KNOWN,
    professions: [],
    now: NOW,
  });

  it("knows every recipe with its profession, crafters and source", () => {
    const robe = entries.find((e) => e.id === 1)!;
    expect(robe).toMatchObject({
      name: "Robe of the Archmage",
      profession: "Tailoring",
      slug: "tailoring",
      skill: 300,
    });
    expect(robe.crafters.map((c) => c.name)).toEqual(["Mira Sunstrider"]);
    const enchant = entries.find((e) => e.id === 8)!;
    expect(enchant).toMatchObject({ name: "Enchant Bracer - Minor Health", slug: "enchanting", nobody: true });
  });

  it("splits Can craft (6) and Nobody yet (3), best quality first", () => {
    const groups = searchGroups(entries);
    expect(groups.canCraft[0]!.quality).toBe("epic");
    expect(groups.nobodyYet.map((e) => e.id)).toEqual([2, 8]);
    expect(groups.canCraft.some((e) => e.id === 5)).toBe(true);
    expect(groups.canCraft.length).toBeLessThanOrEqual(6);
  });
});

describe("item set block (WEB-99, board WB99)", () => {
  it("a 3-piece set: the name with 0 of 3, the pieces in order, the bonuses by threshold", () => {
    expect(
      itemSetView({
        name: "Test Trappings",
        items: [
          { id: 1, name: "Test Cowl" },
          { id: 2, name: "Test Mantle" },
          { id: 3, name: "Test Robe" },
        ],
        bonuses: [
          { threshold: 3, text: "Increases damage and healing done by magical spells and effects by up to 12." },
          { threshold: 2, text: "Increases your chance to dodge an attack by 1%." },
        ],
      }),
    ).toEqual({
      title: "Test Trappings (0/3)",
      pieces: ["Test Cowl", "Test Mantle", "Test Robe"],
      bonuses: [
        "(2) Set: Increases your chance to dodge an attack by 1%.",
        "(3) Set: Increases damage and healing done by magical spells and effects by up to 12.",
      ],
    });
  });

  it("an 8-piece set: every piece, nothing worn, four bonuses; a nameless piece reads its fallback name", () => {
    const names = ["Mask", "Mantle", "Robe", "Bracers", "Wraps", "Belt", "Leggings"];
    const view = itemSetView({
      name: "Test Raiment",
      items: [...names.map((n, i) => ({ id: 10 + i, name: `Test ${n}` })), { id: 279972 }],
      bonuses: [2, 4, 6, 8].map((threshold) => ({ threshold, text: `Bonus ${threshold}.` })),
    });
    expect(view.title).toBe("Test Raiment (0/8)");
    expect(view.pieces).toHaveLength(8);
    expect(view.pieces.at(-1)).toBe("Item 279972");
    expect(view.bonuses).toEqual(["(2) Set: Bonus 2.", "(4) Set: Bonus 4.", "(6) Set: Bonus 6.", "(8) Set: Bonus 8."]);
  });

  it("a set without bonuses lists its pieces only", () => {
    expect(
      itemSetView({
        name: "Test Pair",
        items: [
          { id: 1, name: "A" },
          { id: 2, name: "B" },
        ],
        bonuses: [],
      }),
    ).toEqual({
      title: "Test Pair (0/2)",
      pieces: ["A", "B"],
      bonuses: [],
    });
  });
});

describe("item tooltip (recipes-drawer)", () => {
  it("lists the game's lines in order, without a sell price", () => {
    const t = itemTooltip({
      id: 101,
      name: "Robe of the Archmage",
      quality: 4,
      bonding: 2,
      inventoryType: 20,
      typeName: "Cloth",
      armor: 79,
      stats: [
        { type: 5, value: 12 },
        { type: 6, value: 12 },
      ],
      durability: 100,
      requiredLevel: 57,
      equip: ["Increases damage and healing done by magical spells and effects by up to 40."],
      use: ["Restores 375 to 625 mana. (5 Min Cooldown)"],
    });
    expect(t.quality).toBe("epic");
    expect(t.lines.map((l) => (l.right === undefined ? l.text : `${l.text} | ${l.right}`))).toEqual([
      "Binds when equipped",
      "Chest | Cloth",
      "79 Armor",
      "+12 Intellect",
      "+12 Spirit",
      "Durability 100 / 100",
      "Requires Level 57",
      "Equip: Increases damage and healing done by magical spells and effects by up to 40.",
      "Use: Restores 375 to 625 mana. (5 Min Cooldown)",
    ]);
  });

  it("shows a reagent's stack and a weapon's damage and speed", () => {
    expect(itemTooltip({ id: 1, name: "Bolt of Runecloth", quality: 1, classId: 7, maxStack: 20 }).lines).toEqual([
      { text: "Crafting Reagent", tone: "muted" },
      { text: "Max Stack: 20", tone: "plain" },
    ]);
    const sword = itemTooltip({
      id: 2,
      name: "Sword",
      inventoryType: 13,
      typeName: "Sword",
      damage: { min: 45, max: 85, school: 0 },
      speed: 2600,
    });
    expect(sword.lines.slice(1)).toEqual([
      { text: "45 - 85 Damage", tone: "plain", right: "Speed 2.60" },
      { text: "(25.0 damage per second)", tone: "plain" },
    ]);
  });

  it("shows only the fallback name for an item without a name", () => {
    expect(itemTooltip({ id: 279972, armor: 10 })).toEqual({
      id: 279972,
      name: "Item 279972",
      quality: "common",
      named: false,
      lines: [],
    });
  });

  it("lists a recipe's reagents under its created item, as the game does (WEB-104)", () => {
    expect(
      reagentsLine([
        { id: 1, name: "Heavy Leather", count: 12 },
        { id: 2, name: "Fine Thread", count: 2 },
        { id: 3, name: "Gray Dye", count: 1 },
        { id: 279972, count: 3 },
      ]),
    ).toBe("Requires Heavy Leather (12), Fine Thread (2), Gray Dye, Item 279972 (3)");
    expect(reagentsLine([])).toBeUndefined();
  });

  it("names sources", () => {
    expect(
      sourceViews([
        { recipeId: 1, kind: "rep", faction: "Thorium Brotherhood", rank: "Honored" },
        { recipeId: 1, kind: "quest", quest: "A Bit of Help" },
        { recipeId: 1, kind: "drop" },
      ]),
    ).toEqual([
      { label: "Quest", detail: "A Bit of Help" },
      { label: "Rep", detail: "Thorium Brotherhood · Honored" },
      { label: "Drop" },
    ]);
  });
});
