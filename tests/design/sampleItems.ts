import type { ItemDatabase, ItemRecord, RecipeRecord, SourceKind } from "@/core/recipes/build";

// The design checks' item database (WEB-92): example recipes and items for the recipe screens, as the boards draw
// them (recipes-page, recipes-drawer: "Recipe names, numbers and sources on the boards are example data"). IDs are
// made up; the numbers are the boards'. Never imported by the site: the seed writes it into the design server's
// database (seed.setup.ts), as `npm run import:items` would. Icons: invented pictures the seed draws (sampleIcons).

interface SampleRecipe {
  id: number;
  line: number;
  /** The item it makes (an ID of ITEMS); none for an enchant. */
  item?: number;
  name?: string;
  skill: [number, number, number, number];
  category: string;
  sources?: { kind: SourceKind; place?: string; faction?: string; rank?: string }[];
  reagents?: [number, number][];
  foreverOnly?: boolean;
}

const TAILORING = 197;
const ENCHANTING = 333;
const COOKING = 185;
const ALCHEMY = 171;
const BLACKSMITHING = 164;
const ENGINEERING = 202;
const LEATHERWORKING = 165;
const FIRST_AID = 129;

const item = (r: ItemRecord): ItemRecord => r;

/** The items, by made-up ID. */
export const ITEMS: ItemRecord[] = [
  item({
    id: 90001,
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
    iconName: "sample_robe_epic",
  }),
  item({
    id: 90002,
    name: "Truefaith Vestments",
    quality: 4,
    bonding: 2,
    inventoryType: 20,
    typeName: "Cloth",
    armor: 79,
    durability: 100,
    requiredLevel: 57,
    iconName: "sample_robe_epic",
  }),
  item({
    id: 90003,
    name: "Mooncloth Robe",
    quality: 3,
    bonding: 2,
    inventoryType: 20,
    typeName: "Cloth",
    armor: 70,
    durability: 80,
    requiredLevel: 56,
    iconName: "sample_robe_rare",
  }),
  item({
    id: 90004,
    name: "Runecloth Robe",
    quality: 2,
    bonding: 2,
    inventoryType: 20,
    typeName: "Cloth",
    armor: 64,
    durability: 80,
    requiredLevel: 55,
    iconName: "sample_robe_green",
  }),
  item({
    id: 90005,
    name: "Flarecore Gloves",
    quality: 3,
    bonding: 2,
    inventoryType: 10,
    typeName: "Cloth",
    armor: 46,
    durability: 35,
    requiredLevel: 60,
    iconName: "sample_gloves",
  }),
  item({
    id: 90006,
    name: "Felcloth Pants",
    quality: 3,
    bonding: 2,
    inventoryType: 7,
    typeName: "Cloth",
    armor: 60,
    durability: 75,
    requiredLevel: 56,
    iconName: "sample_pants",
  }),
  item({ id: 90007, name: "Runecloth Bag", quality: 1, bonding: 0, typeName: "Bag", iconName: "sample_bag" }),
  item({ id: 90008, name: "Mageweave Bag", quality: 1, bonding: 0, typeName: "Bag", iconName: "sample_bag" }),
  item({ id: 90009, name: "Mooncloth", quality: 1, classId: 7, maxStack: 20, iconName: "sample_cloth" }),
  item({ id: 90010, name: "Bolt of Runecloth", quality: 1, classId: 7, maxStack: 20, iconName: "sample_bolt" }),
  item({ id: 90011, name: "Bolt of Mageweave", quality: 1, classId: 7, maxStack: 20, iconName: "sample_bolt" }),
  item({ id: 90012, name: "Essence of Water", quality: 2, classId: 7, maxStack: 10, iconName: "sample_essence" }),
  item({ id: 90013, name: "Rune Thread", quality: 1, classId: 7, maxStack: 20, iconName: "sample_thread" }),
  item({ id: 90014, name: "Felcloth", quality: 2, classId: 7, maxStack: 20, iconName: "sample_cloth" }),
  item({ id: 90015, name: "Runecloth", quality: 1, classId: 7, maxStack: 20, iconName: "sample_cloth" }),
  item({ id: 90016, name: "Mageweave Cloth", quality: 1, classId: 7, maxStack: 20, iconName: "sample_cloth" }),
  item({ id: 90017, name: "Bolt of Silk Cloth", quality: 1, classId: 7, maxStack: 20, iconName: "sample_bolt" }),
  item({ id: 90018, name: "Silk Cloth", quality: 1, classId: 7, maxStack: 20, iconName: "sample_cloth" }),
  item({ id: 90020, name: "Elixir of Fortitude", quality: 1, maxStack: 5, iconName: "sample_potion" }),
  item({ id: 90021, name: "Greater Healing Potion", quality: 1, maxStack: 5, iconName: "sample_potion" }),
  item({ id: 90022, name: "Heavy Grinding Stone", quality: 1, classId: 7, maxStack: 20, iconName: "sample_stone" }),
  item({ id: 90023, name: "Big Iron Bomb", quality: 1, maxStack: 20, iconName: "sample_bomb" }),
  item({ id: 90024, name: "Heavy Armor Kit", quality: 1, maxStack: 10, iconName: "sample_kit" }),
  item({ id: 90025, name: "Heavy Silk Bandage", quality: 1, maxStack: 20, iconName: "sample_bandage" }),
  item({ id: 90026, name: "Spiced Wolf Meat", quality: 1, maxStack: 20, iconName: "sample_food" }),
  item({ id: 90027, name: "Roast Raptor", quality: 1, maxStack: 20, iconName: "sample_food" }),
  // An item of Forever's own the client data has no name for yet (amendment 2): fallback name and icon.
  item({ id: 279972 }),
];

const RECIPES: SampleRecipe[] = [
  {
    id: 91001,
    line: TAILORING,
    item: 90001,
    skill: [300, 315, 322, 330],
    category: "Chest",
    sources: [{ kind: "drop", place: "Blackrock Spire" }],
    reagents: [
      [90010, 12],
      [90009, 4],
      [90012, 2],
      [90013, 1],
    ],
  },
  {
    id: 91002,
    line: TAILORING,
    item: 90002,
    skill: [300, 315, 322, 330],
    category: "Chest",
    sources: [{ kind: "drop", place: "Lower Blackrock Spire" }],
    reagents: [
      [90010, 8],
      [90009, 10],
    ],
  },
  {
    id: 91003,
    line: TAILORING,
    item: 90003,
    skill: [300, 315, 322, 330],
    category: "Chest",
    sources: [{ kind: "rep", faction: "Thorium Brotherhood", rank: "Honored" }],
    reagents: [
      [90010, 4],
      [90009, 4],
    ],
  },
  {
    id: 91004,
    line: TAILORING,
    item: 90004,
    skill: [275, 290, 297, 305],
    category: "Chest",
    sources: [{ kind: "trainer" }],
    reagents: [
      [90010, 4],
      [90013, 1],
    ],
  },
  {
    id: 91005,
    line: TAILORING,
    item: 90005,
    skill: [300, 315, 322, 330],
    category: "Hands",
    sources: [{ kind: "rep", faction: "Thorium Brotherhood", rank: "Honored" }],
    reagents: [[90010, 4]],
  },
  {
    id: 91006,
    line: TAILORING,
    item: 90006,
    skill: [275, 290, 297, 305],
    category: "Legs",
    sources: [{ kind: "drop", place: "Scholomance" }],
    reagents: [
      [90014, 4],
      [90013, 1],
    ],
  },
  {
    id: 91007,
    line: TAILORING,
    item: 90007,
    skill: [260, 275, 282, 290],
    category: "Bags",
    sources: [{ kind: "vendor_limited" }],
    reagents: [
      [90010, 5],
      [90013, 1],
    ],
  },
  {
    id: 91008,
    line: TAILORING,
    item: 90008,
    skill: [185, 195, 200, 205],
    category: "Bags",
    sources: [{ kind: "trainer" }],
    reagents: [[90011, 4]],
  },
  {
    id: 91009,
    line: TAILORING,
    item: 90009,
    skill: [250, 270, 280, 290],
    category: "Cloth",
    sources: [{ kind: "trainer" }],
    reagents: [[90015, 2]],
  },
  {
    id: 91010,
    line: TAILORING,
    item: 90010,
    skill: [250, 255, 257, 260],
    category: "Cloth",
    sources: [{ kind: "trainer" }],
    reagents: [[90015, 5]],
  },
  {
    id: 91011,
    line: TAILORING,
    item: 90011,
    skill: [175, 180, 182, 185],
    category: "Cloth",
    sources: [{ kind: "trainer" }],
    reagents: [[90016, 5]],
  },
  {
    id: 91012,
    line: TAILORING,
    item: 90017,
    skill: [125, 135, 140, 145],
    category: "Cloth",
    sources: [{ kind: "trainer" }],
    reagents: [[90018, 4]],
  },
  // Forever's own (no name yet, no known source): counts in the totals, never as "Nobody has".
  {
    id: 1229504,
    line: TAILORING,
    item: 279972,
    skill: [290, 300, 307, 315],
    category: "Cloth",
    foreverOnly: true,
  },
  {
    id: 92001,
    line: ENCHANTING,
    name: "Enchant Bracer - Lesser Intellect",
    skill: [150, 180, 195, 210],
    category: "Bracer",
    sources: [{ kind: "trainer" }],
  },
  {
    id: 92002,
    line: ENCHANTING,
    name: "Enchant Chest - Greater Health",
    skill: [220, 240, 250, 260],
    category: "Chest",
    sources: [{ kind: "vendor" }],
  },
  {
    id: 93001,
    line: COOKING,
    item: 90026,
    skill: [10, 30, 40, 50],
    category: "Food",
    sources: [{ kind: "trainer" }],
  },
  {
    id: 93002,
    line: COOKING,
    item: 90027,
    skill: [175, 195, 205, 215],
    category: "Food",
    sources: [{ kind: "vendor" }],
  },
  {
    id: 94001,
    line: ALCHEMY,
    item: 90020,
    skill: [175, 195, 205, 215],
    category: "Elixir",
    sources: [{ kind: "trainer" }],
  },
  {
    id: 94002,
    line: ALCHEMY,
    item: 90021,
    skill: [155, 175, 185, 195],
    category: "Potion",
    sources: [{ kind: "trainer" }],
  },
  {
    id: 95001,
    line: BLACKSMITHING,
    item: 90022,
    skill: [100, 115, 122, 130],
    category: "Trade Goods",
    sources: [{ kind: "trainer" }],
  },
  {
    id: 96001,
    line: ENGINEERING,
    item: 90023,
    skill: [190, 195, 205, 215],
    category: "Explosives",
    sources: [{ kind: "trainer" }],
  },
  {
    id: 97001,
    line: LEATHERWORKING,
    item: 90024,
    skill: [150, 170, 180, 190],
    category: "Armor Kit",
    sources: [{ kind: "trainer" }],
  },
  {
    id: 98001,
    line: FIRST_AID,
    item: 90025,
    skill: [180, 210, 220, 230],
    category: "Bandage",
    sources: [{ kind: "trainer" }],
  },
];

export const SAMPLE_ITEM_DATABASE: ItemDatabase = {
  // WEB-96: the dungeon page's boss list comes with WEB-102.
  bosses: [],
  bossDrops: [],
  items: ITEMS,
  recipes: RECIPES.map((r): RecipeRecord => {
    const rec: RecipeRecord = {
      id: r.id,
      skillLineId: r.line,
      orange: r.skill[0],
      yellow: r.skill[1],
      green: r.skill[2],
      grey: r.skill[3],
      category: r.category,
      obtainable: true,
      foreverOnly: r.foreverOnly ?? false,
    };
    if (r.item !== undefined) rec.createdItemId = r.item;
    if (r.name !== undefined) rec.name = r.name;
    return rec;
  }),
  reagents: RECIPES.flatMap((r) => (r.reagents ?? []).map(([itemId, count]) => ({ recipeId: r.id, itemId, count }))),
  sources: RECIPES.flatMap((r) =>
    (r.sources ?? []).map((s) => ({ recipeId: r.id, ...s, isRare: s.kind === "drop" || s.kind === "rep" })),
  ),
};

/** The icon names the sample uses, and the question mark: the seed draws each (sampleIcons in seed.setup.ts). */
export const SAMPLE_ICONS = [
  ...new Set([...ITEMS.flatMap((i) => (i.iconName === undefined ? [] : [i.iconName])), "inv_misc_questionmark"]),
];

/** Who knows which recipe in the design sample (recipe ID -> item ID, CF-38's shape), and when each scanned. */
export const SAMPLE_RECIPES: Record<string, Record<number, number>> = {
  // Mira Sunstrider: Tailoring 300, Enchanting 285
  "Player-1-0000C001": {
    91001: 90001,
    91003: 90003,
    91004: 90004,
    91006: 90006,
    91007: 90007,
    91008: 90008,
    91009: 90009,
    91010: 90010,
    91011: 90011,
    91012: 90017,
    1229504: 279972,
    92001: 0,
    92002: 0,
  },
  // Lia Thornwhisper: Tailoring 205, Cooking 150
  "Player-1-0000E001": { 91008: 90008, 91011: 90011, 91012: 90017, 93001: 90026 },
  // Ves Doombringer: Tailoring 187 (scanned long ago), Enchanting never opened, Cooking 75
  "Player-1-0000A001": { 91008: 90008, 91011: 90011, 91012: 90017, 93001: 90026 },
  // Tok Ironhide: Alchemy 160, First Aid 225
  "Player-1-0000B002": { 94002: 90021, 98001: 90025 },
  // Grom Ashfeller: Blacksmithing 120
  "Player-1-0000A002": { 95001: 90022 },
  // Bob Example: Leatherworking 201
  "Player-1-0000B001": { 97001: 90024 },
};
