import { describe, expect, it } from "vitest";
import { recordCharacters } from "@/core/views";
import {
  creatureTypePlural,
  levelRange,
  reagentSourceLines,
  type CraftedInfo,
  type ReagentSourceData,
} from "@/core/views/reagentSources";
import { professionRecipes, type RecipeData } from "@/core/views/recipes";
import { NOW, sample } from "./sample";

// WEB-98: where to get a reagent (board reagent-sources), with invented rows. The order Nico confirmed: a vendor
// without a stock limit, crafted by someone in the group, gathered, a limited vendor, crafted by nobody, a drop.

const row = (r: Omit<ReagentSourceData, "itemId" | "position"> & { position?: number }): ReagentSourceData => ({
  itemId: 1,
  position: 1,
  ...r,
});

const crafted =
  (known: boolean) =>
  (recipeId: number): CraftedInfo | undefined =>
    recipeId === 404 ? undefined : { name: "Cured Heavy Hide", profession: "Leatherworking", skill: 150, known };

describe("reagentSourceLines", () => {
  const all: ReagentSourceData[] = [
    row({ kind: "drop", name: "Shadowmaw Panther", chance: 6 }),
    row({ kind: "drop", name: "Elder Shadowmaw Panther", chance: 4, position: 2 }),
    row({ kind: "vendor_limited", name: "Hammon Karwn", zone: "Arathi Highlands" }),
    row({ kind: "skinning", creatureType: "Beast", minLevel: 30, maxLevel: 45 }),
    row({ kind: "crafted", recipeId: 7 }),
    row({ kind: "vendor", name: "Tharynn Bouden", zone: "Elwynn Forest" }),
    row({ kind: "vendor", name: "Second Vendor", zone: "Duskwood", position: 2 }),
    row({ kind: "herbalism", name: "Kingsblood" }),
    row({ kind: "mining", name: "Iron Deposit" }),
  ];

  it("best first, at most 3: vendor, crafted by someone, gathered", () => {
    expect(reagentSourceLines(all, crafted(true))).toEqual([
      { kind: "vendor", npc: "Tharynn Bouden", zone: "Elwynn Forest", limited: false },
      {
        kind: "crafted",
        recipeId: 7,
        name: "Cured Heavy Hide",
        profession: "Leatherworking",
        skill: 150,
        known: true,
      },
      { kind: "skinning", creatureType: "Beast", minLevel: 30, maxLevel: 45 },
    ]);
  });

  it("crafted by nobody goes after a limited vendor, before a drop", () => {
    const rows = all.filter((r) => r.kind !== "vendor" && r.kind !== "herbalism" && r.kind !== "mining");
    expect(reagentSourceLines(rows, crafted(false)).map((l) => l.kind)).toEqual(["skinning", "vendor", "crafted"]);
    expect(reagentSourceLines(rows, crafted(false))[1]).toEqual({
      kind: "vendor",
      npc: "Hammon Karwn",
      zone: "Arathi Highlands",
      limited: true,
    });
  });

  it("gathered in order skinning, herbalism, mining; a drop names up to 2 creatures with their chance", () => {
    const gathered = all.filter((r) => ["herbalism", "mining", "drop"].includes(r.kind));
    expect(reagentSourceLines(gathered, crafted(true))).toEqual([
      { kind: "herbalism", nodes: ["Kingsblood"] },
      { kind: "mining", nodes: ["Iron Deposit"] },
      {
        kind: "drop",
        creatures: [
          { name: "Shadowmaw Panther", chance: 6 },
          { name: "Elder Shadowmaw Panther", chance: 4 },
        ],
      },
    ]);
  });

  it("none: no lines (the drawer says No known source); a recipe the site doesn't list is left out", () => {
    expect(reagentSourceLines([], crafted(true))).toEqual([]);
    expect(reagentSourceLines([row({ kind: "crafted", recipeId: 404 })], crafted(true))).toEqual([]);
  });

  it("words: plural creature types and level ranges", () => {
    expect(creatureTypePlural("Beast")).toBe("beasts");
    expect(creatureTypePlural("Dragonkin")).toBe("dragonkin");
    expect(creatureTypePlural("Undead")).toBe("undead");
    expect(levelRange(30, 45)).toBe("level 30–45");
    expect(levelRange(12, 12)).toBe("level 12");
    expect(levelRange(undefined, undefined)).toBeUndefined();
  });
});

describe("profession page (WEB-98)", () => {
  const characters = recordCharacters(sample(), NOW);
  const recipe = (r: Partial<RecipeData> & { id: number }): RecipeData => ({
    skillLineId: 197,
    obtainable: true,
    foreverOnly: false,
    orange: 1,
    yellow: 10,
    green: 15,
    grey: 20,
    ...r,
  });
  const input = {
    skillLine: 197,
    characters,
    // A Tailoring robe; its bolt is Tailoring's own; its bar is Mining's (Smelting), its ore gathered.
    recipes: [
      recipe({ id: 1, createdItemId: 101 }),
      recipe({ id: 2, createdItemId: 102, orange: 250 }),
      recipe({ id: 3, skillLineId: 186, createdItemId: 103, orange: 125 }),
    ],
    items: new Map([
      [101, { id: 101, name: "Robe" }],
      [102, { id: 102, name: "Bolt" }],
      [103, { id: 103, name: "Iron Bar" }],
      [104, { id: 104, name: "Iron Ore" }],
    ]),
    sources: [],
    reagents: [
      { recipeId: 1, itemId: 102, count: 4 },
      { recipeId: 1, itemId: 103, count: 2 },
      { recipeId: 1, itemId: 105, count: 1 },
      { recipeId: 3, itemId: 104, count: 1 },
    ],
    known: [{ guid: "Player-1-MIRA", recipeId: 2 }],
    professions: [],
    now: NOW,
  };

  it("lists each reagent's sources once the import has them; none: an empty list", () => {
    const v = professionRecipes({
      ...input,
      reagentSources: [
        { itemId: 102, kind: "crafted", position: 1, recipeId: 2 },
        { itemId: 103, kind: "crafted", position: 1, recipeId: 3 },
        { itemId: 104, kind: "mining", position: 1, name: "Iron Deposit" },
      ],
    });
    const robe = v.rows.find((r) => r.id === 1)!;
    expect(robe.reagents).toEqual([
      {
        itemId: 102,
        count: 4,
        sources: [{ kind: "crafted", recipeId: 2, name: "Bolt", profession: "Tailoring", skill: 250, known: true }],
      },
      {
        itemId: 103,
        count: 2,
        sources: [{ kind: "crafted", recipeId: 3, name: "Iron Bar", profession: "Mining", skill: 125, known: false }],
      },
      { itemId: 105, count: 1, sources: [] },
    ]);
    // The drill-in: Mining's recipe is linked (with its own reagent's source); Tailoring's own bolt is a row already.
    expect(v.linked.map((l) => [l.id, l.profession, l.skillLine])).toEqual([[3, "Mining", 186]]);
    expect(v.linked[0]!.reagents[0]!.sources).toEqual([{ kind: "mining", nodes: ["Iron Deposit"] }]);
  });

  it("without reagent sources from the import, no source lines and no linked recipes", () => {
    const v = professionRecipes(input);
    expect(v.rows.find((r) => r.id === 1)!.reagents[0]).toEqual({ itemId: 102, count: 4 });
    expect(v.linked).toEqual([]);
  });
});
