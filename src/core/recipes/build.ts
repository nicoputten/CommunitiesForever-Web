// The item and recipe database (WEB-90): built from the game client's own tables and cmangos classic-db, once per
// game patch by scripts/import-items.ts. Pure: every table comes in as rows. docs/SOURCE-DATA.md "Item database".
//
// Sources (rule 10):
// - Blizzard's client data of the Forever build (wago.tools DB2 CSV exports, product `wowf`): SkillLineAbility
//   (which spells are recipes of which profession, the thresholds), SpellEffect (the created item), SpellReagents,
//   SpellName and Spell (names, Equip/Use texts), SpellMisc and SpellDuration (a spell's duration), SpellRadius,
//   SpellAuraOptions and SpellTargetRestrictions (the numbers Use texts name, WEB-95: ./spellText.ts), ItemSparse (name, quality, levels, bind, slot, stack), Item (class,
//   subclass, icon), ItemModifiedAppearance and ItemAppearance (the icon of items without one in Item), ItemSubClass
//   (type names), ItemXItemEffect and ItemEffect (an item's spells; which recipe a
//   recipe item teaches), ManifestInterfaceData (icon file names), Faction and Map (names), DungeonEncounter (WEB-96: the
//   bosses, ./bosses.ts); Lock, CreatureType, UiMapAssignment and AreaTable (WEB-98: where to get a reagent,
//   ./reagentSources.ts, which names its sources).
// - The Classic Era client (same export): its SkillLineAbility tells Forever's own recipes apart, and its learn-spell
//   effects (SpellEffect 36) map cmangos' trainer and recipe-item spells, which Forever's client no longer has, to the
//   recipe they teach.
// - cmangos classic-db (GPL-3.0, https://github.com/cmangos/classic-db): where each recipe is learned (trainers,
//   vendors, loot, quests) and the tooltip numbers ItemSparse no longer carries as flat values (armor, stats,
//   resistances, durability, weapon damage), as of Vanilla 1.12.
// The skill to learn a recipe (orange): the recipe item's RequiredSkillRank (ItemSparse, else cmangos) or the trainer's
// reqskillvalue (cmangos), the lowest of its sources, never above yellow; without one, SkillLineAbility's
// MinSkillLineRank (often 1).
// Spell effect numbers (wowdev.wiki "Spell" effects / warcraft.wiki.gg): 24 create item, 36 learn spell, 53 enchant
// item. Item spell triggers (warcraft.wiki.gg "ItemSpellTriggerType"): 0 use, 1 equip, 2 chance on hit.
// Reputation standings (the game's FACTION_STANDING_LABEL1..8): 0 Hated .. 7 Exalted.
import { float, int } from "./csv";
import { n, s, type SqlRow } from "./sqlDump";
import { type BossDropRecord, type BossRecord, buildBosses } from "./bosses";
import { buildReagentSources, type ReagentSourceRecord } from "./reagentSources";
import { greenThreshold } from "./skill";
import { type SpellEffectInfo, type SpellInfo, type SpellLookup, spellText } from "./spellText";

export const DB2_TABLES = [
  "ItemSparse",
  "Item",
  "ItemModifiedAppearance",
  "ItemAppearance",
  "ItemSubClass",
  "SkillLineAbility",
  "SpellEffect",
  "SpellReagents",
  "SpellName",
  "Spell",
  "SpellMisc",
  "SpellDuration",
  "SpellRadius",
  "SpellAuraOptions",
  "SpellTargetRestrictions",
  "ItemXItemEffect",
  "ItemEffect",
  "ManifestInterfaceData",
  "Faction",
  "Map",
  "DungeonEncounter",
  // WEB-98: where to get a reagent (./reagentSources.ts).
  "Lock",
  "CreatureType",
  "UiMapAssignment",
  "AreaTable",
] as const;
export type Db2Table = (typeof DB2_TABLES)[number];

export const CMANGOS_TABLES = [
  "item_template",
  "npc_trainer",
  "npc_trainer_template",
  "npc_vendor",
  "npc_vendor_template",
  "creature_template",
  "creature",
  "creature_loot_template",
  "reference_loot_template",
  "gameobject_template",
  "gameobject",
  "gameobject_loot_template",
  "item_loot_template",
  "quest_template",
  "skinning_loot_template",
] as const;
export type CmangosTable = (typeof CMANGOS_TABLES)[number];

type Rows = Record<string, string>[];

export interface ImportInput {
  db2: Partial<Record<Db2Table, Rows>>;
  /** The Classic Era client: its SkillLineAbility and its SpellEffect rows with Effect 36 (learn spell). */
  era: { abilities: Rows; learn: Rows };
  cmangos: Partial<Record<CmangosTable, SqlRow[]>>;
}

/**
 * Skill lines whose recipes the site lists (docs/WOW-FOREVER.md professions; src/core/gamedata/professions.ts):
 * the crafting professions, Cooking and First Aid, and Mining for Smelting. Herbalism, Skinning and Fishing have none.
 */
export const RECIPE_SKILL_LINES: readonly number[] = [171, 164, 333, 202, 165, 197, 185, 129, 186];

const CREATE_ITEM = 24;
const LEARN_SPELL = 36;
const ENCHANT_ITEM = 53;
const RECIPE_CLASS = 9;
const STANDINGS = ["Hated", "Hostile", "Unfriendly", "Neutral", "Friendly", "Honored", "Revered", "Exalted"];
/** More creatures than this drop a recipe: a world drop (no creature or place named). */
const NAMED_DROPS = 3;
/** At most this many vendors or quests are named per recipe. */
const NAMED_OTHERS = 3;

export interface ItemStat {
  /** The client's ItemModType (3 Agility, 4 Strength, 5 Intellect, 6 Spirit, 7 Stamina, ...). */
  type: number;
  value: number;
}

export interface ItemRecord {
  id: number;
  /** Undefined when the client has no ItemSparse row for it (some of Forever's own items). */
  name?: string;
  quality?: number;
  itemLevel?: number;
  requiredLevel?: number;
  /** ItemBonding: 0 none, 1 on pickup, 2 on equip, 3 on use, 4 quest. */
  bonding?: number;
  classId?: number;
  subclassId?: number;
  /** Enum.InventoryType: 0 not equippable, 5 chest, ... */
  inventoryType?: number;
  /** The item type's name (ItemSubClass), e.g. "Cloth", "Bag", "Potions". */
  typeName?: string;
  iconName?: string;
  description?: string;
  maxStack?: number;
  armor?: number;
  durability?: number;
  stats?: ItemStat[];
  /** Holy, fire, nature, frost, shadow, arcane resistance, where not 0. */
  resistances?: Partial<Record<"holy" | "fire" | "nature" | "frost" | "shadow" | "arcane", number>>;
  damage?: { min: number; max: number; school: number };
  /** Weapon speed in milliseconds. */
  speed?: number;
  /** The spells' texts, numbers filled in; a text the import can't fill is left out. */
  equip?: string[];
  use?: string[];
  chanceOnHit?: string[];
}

export interface RecipeRecord {
  /** The recipe's spell ID: what `GetAllRecipeIDs` returns. */
  id: number;
  name?: string;
  skillLineId: number;
  createdItemId?: number;
  orange: number;
  yellow: number;
  green: number;
  grey: number;
  /** For grouping (item type): the slot of gear, an enchant's slot, else the item type's name. */
  category?: string;
  /** False for a Classic Era recipe nothing teaches any more (removed or unobtainable); left out of lists. */
  obtainable: boolean;
  /** A recipe of Forever's own (not in the Classic Era client); where it is learned is not known yet. */
  foreverOnly: boolean;
}

export interface ReagentRecord {
  recipeId: number;
  itemId: number;
  count: number;
}

export type SourceKind = "trainer" | "vendor" | "vendor_limited" | "drop" | "rep" | "quest";

export interface SourceRecord {
  recipeId: number;
  kind: SourceKind;
  /** The dungeon or raid of a drop, when all its creatures are in one. */
  place?: string;
  /** The creature, object or vendor, when there are only a few. */
  npc?: string;
  quest?: string;
  faction?: string;
  /** The standing a rep recipe needs, e.g. "Honored". */
  rank?: string;
  /** Drop and rep: the "rare find" kinds (handoff Decisions). */
  isRare: boolean;
}

export interface ItemDatabase {
  items: ItemRecord[];
  recipes: RecipeRecord[];
  reagents: ReagentRecord[];
  sources: SourceRecord[];
  /** WEB-96: dungeon bosses in the client's order, and each boss's own loot (./bosses.ts). */
  bosses: BossRecord[];
  bossDrops: BossDropRecord[];
  /** WEB-98: where to get each reagent (./reagentSources.ts); the import always builds it, older dumps lack it. */
  reagentSources?: ReagentSourceRecord[];
}

/** Enum.InventoryType names as the game's tooltip shows them (GlobalStrings INVTYPE_*), for gear categories. */
const SLOT_NAMES: Readonly<Record<number, string>> = {
  1: "Head",
  2: "Neck",
  3: "Shoulder",
  4: "Shirt",
  5: "Chest",
  6: "Waist",
  7: "Legs",
  8: "Feet",
  9: "Wrist",
  10: "Hands",
  11: "Finger",
  12: "Trinket",
  13: "One-Hand",
  14: "Off Hand",
  15: "Ranged",
  16: "Back",
  17: "Two-Hand",
  18: "Bag",
  19: "Tabard",
  20: "Chest",
  21: "Main Hand",
  22: "Off Hand",
  23: "Held In Off-hand",
  24: "Projectile",
  25: "Thrown",
  26: "Ranged",
  28: "Relic",
};

function group<T>(rows: readonly T[], key: (r: T) => number | undefined): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (k === undefined) continue;
    const list = out.get(k);
    if (list === undefined) out.set(k, [r]);
    else list.push(r);
  }
  return out;
}

function byId(rows: Rows | undefined, key = "ID"): Map<number, Record<string, string>> {
  const out = new Map<number, Record<string, string>>();
  for (const r of rows ?? []) {
    const id = int(r, key);
    if (id !== undefined && !out.has(id)) out.set(id, r);
  }
  return out;
}

function text(v: string | undefined): string | undefined {
  return v !== undefined && v !== "" ? v : undefined;
}

/** Rows by a key, the base difficulty's (DifficultyID 0) first. */
function byBase(rows: Rows | undefined, key: string): Map<number, Record<string, string>> {
  const out = new Map<number, Record<string, string>>();
  for (const r of rows ?? []) {
    const id = int(r, key);
    if (id === undefined) continue;
    if (!out.has(id) || ((int(r, "DifficultyID") ?? 0) === 0 && (int(out.get(id), "DifficultyID") ?? 0) !== 0)) {
      out.set(id, r);
    }
  }
  return out;
}

/** What a spell's description reads (./spellText.ts), from the client's spell tables. */
export function spellLookup(db2: ImportInput["db2"], effects: Map<number, Record<string, string>[]>): SpellLookup {
  const spells = byId(db2.Spell);
  const names = byId(db2.SpellName);
  const misc = byBase(db2.SpellMisc, "SpellID");
  const durations = byId(db2.SpellDuration);
  const radii = byId(db2.SpellRadius);
  const auraOptions = byBase(db2.SpellAuraOptions, "SpellID");
  const targets = byBase(db2.SpellTargetRestrictions, "SpellID");
  const cache = new Map<number, SpellInfo | undefined>();
  const positive = (v: number | undefined) => (v !== undefined && v > 0 ? v : undefined);
  return (id) => {
    if (cache.has(id)) return cache.get(id);
    const spell = spells.get(id);
    const name = text(names.get(id)?.Name_lang);
    let info: SpellInfo | undefined;
    if (spell !== undefined || name !== undefined) {
      const fxs: (SpellEffectInfo | undefined)[] = [];
      const base = new Set<number>();
      for (const fx of effects.get(id) ?? []) {
        const index = int(fx, "EffectIndex");
        if (index === undefined || index < 0 || index > 2) continue;
        // The base difficulty's effect wins.
        const isBase = (int(fx, "DifficultyID") ?? 0) === 0;
        if (base.has(index) && !isBase) continue;
        if (isBase) base.add(index);
        const e: SpellEffectInfo = { points: float(fx, "EffectBasePointsF") };
        const variance = positive(float(fx, "Variance"));
        if (variance !== undefined) e.variance = variance;
        const period = positive(int(fx, "EffectAuraPeriod"));
        if (period !== undefined) e.period = period;
        const radius = positive(float(radii.get(int(fx, "EffectRadiusIndex_0") ?? -1), "Radius"));
        if (radius !== undefined) e.radius = radius;
        const miscValue = int(fx, "EffectMiscValue_0");
        if (miscValue !== undefined) e.misc = miscValue;
        const chain = positive(int(fx, "EffectChainTargets"));
        if (chain !== undefined) e.chainTargets = chain;
        fxs[index] = e;
      }
      const m = misc.get(id);
      const aura = auraOptions.get(id);
      info = {
        name,
        description: text(spell?.Description_lang),
        effects: fxs,
        duration: positive(int(durations.get(int(m, "DurationIndex") ?? -1), "Duration")),
        procChance: positive(int(aura, "ProcChance")),
        procCharges: positive(int(aura, "ProcCharges")),
        procCooldown: positive(int(aura, "ProcCategoryRecovery")),
        stacks: positive(int(aura, "CumulativeAura")),
        maxTargets: positive(int(targets.get(id), "MaxTargets")),
      };
    }
    cache.set(id, info);
    return info;
  };
}

export function buildItemDatabase(input: ImportInput): ItemDatabase {
  const db2 = input.db2;
  const cm = input.cmangos;

  // --- recipes: SkillLineAbility rows of the recipe professions whose spell creates or enchants an item ---
  const effects = group(db2.SpellEffect ?? [], (r) => int(r, "SpellID"));
  const effectsOf = (spell: number) => effects.get(spell) ?? [];
  const lines = new Set(RECIPE_SKILL_LINES);
  const abilities = new Map<number, Record<string, string>>();
  for (const r of db2.SkillLineAbility ?? []) {
    const spell = int(r, "Spell");
    const line = int(r, "SkillLine");
    if (spell === undefined || line === undefined || !lines.has(line) || abilities.has(spell)) continue;
    const makes = effectsOf(spell).some((e) => {
      const kind = int(e, "Effect");
      return kind === CREATE_ITEM || kind === ENCHANT_ITEM;
    });
    if (makes) abilities.set(spell, r);
  }
  const eraSpells = new Set<number>();
  for (const r of input.era.abilities) {
    const spell = int(r, "Spell");
    if (spell !== undefined) eraSpells.add(spell);
  }

  // Which recipe a spell teaches: the recipe itself, or what its learn effect (Era's or Forever's) teaches.
  const learns = new Map<number, Set<number>>();
  for (const e of [...input.era.learn, ...(db2.SpellEffect ?? [])]) {
    if (int(e, "Effect") !== LEARN_SPELL) continue;
    const spell = int(e, "SpellID");
    const target = int(e, "EffectTriggerSpell");
    if (spell === undefined || target === undefined) continue;
    (learns.get(spell) ?? learns.set(spell, new Set()).get(spell)!).add(target);
  }
  const taught = (spell: number | undefined): number[] => {
    if (spell === undefined || spell <= 0) return [];
    if (abilities.has(spell)) return [spell];
    return [...(learns.get(spell) ?? [])].filter((t) => abilities.has(t));
  };

  // --- items' spells (Forever client) ---
  const itemEffects = byId(db2.ItemEffect);
  const spellsOfItem = new Map<number, Record<string, string>[]>();
  for (const r of db2.ItemXItemEffect ?? []) {
    const item = int(r, "ItemID");
    const effect = itemEffects.get(int(r, "ItemEffectID") ?? -1);
    if (item === undefined || effect === undefined) continue;
    (spellsOfItem.get(item) ?? spellsOfItem.set(item, []).get(item)!).push(effect);
  }

  // Recipe items (patterns, plans, formulas) -> the recipes they teach: the Forever client's item spells, else
  // cmangos' item_template spells through Era's learn effects.
  const itemTemplates = new Map<number, SqlRow>();
  for (const r of cm.item_template ?? []) {
    const id = n(r, "entry");
    if (id !== undefined) itemTemplates.set(id, r);
  }
  const recipeItems = new Map<number, Set<number>>();
  const teach = (item: number, spell: number | undefined) => {
    for (const t of taught(spell)) (recipeItems.get(item) ?? recipeItems.set(item, new Set()).get(item)!).add(t);
  };
  for (const [item, list] of spellsOfItem) for (const e of list) teach(item, int(e, "SpellID"));
  for (const [item, r] of itemTemplates) {
    if (n(r, "class") !== RECIPE_CLASS) continue;
    for (let i = 1; i <= 5; i++) teach(item, n(r, `spellid_${i}`));
  }

  // The skill each source needs; the lowest becomes the recipe's orange.
  const needs = new Map<number, number>();
  const need = (recipe: number, skill: number | undefined) => {
    if (skill === undefined || skill <= 0) return;
    const was = needs.get(recipe);
    if (was === undefined || skill < was) needs.set(recipe, skill);
  };
  const sparseRows = byId(db2.ItemSparse);
  const itemNeed = (item: number) =>
    int(sparseRows.get(item), "RequiredSkillRank") || n(itemTemplates.get(item), "RequiredSkillRank");
  const sources = new Map<number, SourceRecord[]>();
  const add = (recipeId: number, source: Omit<SourceRecord, "recipeId">, skill?: number) => {
    need(recipeId, skill);
    const list = sources.get(recipeId) ?? sources.set(recipeId, []).get(recipeId)!;
    const record = compact({ recipeId, ...source });
    const key = JSON.stringify(record);
    if (!list.some((x) => JSON.stringify(x) === key)) list.push(record);
  };

  // Trainers: cmangos' trainer spells, and recipes learned with the profession itself (AcquireMethod 1).
  for (const r of [...(cm.npc_trainer ?? []), ...(cm.npc_trainer_template ?? [])]) {
    for (const t of taught(n(r, "spell"))) add(t, { kind: "trainer", isRare: false }, n(r, "reqskillvalue"));
  }
  for (const [spell, r] of abilities) if (int(r, "AcquireMethod") === 1) add(spell, { kind: "trainer", isRare: false });

  // Names of cmangos creatures, objects and the maps they stand on.
  const creatureNames = new Map<number, string>();
  const lootOwners = new Map<number, number[]>();
  const vendorTemplateUsers = new Map<number, number[]>();
  for (const r of cm.creature_template ?? []) {
    const entry = n(r, "Entry");
    if (entry === undefined) continue;
    creatureNames.set(entry, s(r, "Name") ?? "");
    const loot = n(r, "LootId");
    if (loot !== undefined && loot > 0) (lootOwners.get(loot) ?? lootOwners.set(loot, []).get(loot)!).push(entry);
    const vt = n(r, "VendorTemplateId");
    if (vt !== undefined && vt > 0) {
      (vendorTemplateUsers.get(vt) ?? vendorTemplateUsers.set(vt, []).get(vt)!).push(entry);
    }
  }
  const creatureMaps = new Map<number, Set<number>>();
  for (const r of cm.creature ?? []) {
    const id = n(r, "id");
    const map = n(r, "map");
    if (id !== undefined && map !== undefined)
      (creatureMaps.get(id) ?? creatureMaps.set(id, new Set()).get(id)!).add(map);
  }
  const objectNames = new Map<number, string>();
  const objectLoot = new Map<number, number[]>();
  for (const r of cm.gameobject_template ?? []) {
    const entry = n(r, "entry");
    if (entry === undefined) continue;
    objectNames.set(entry, s(r, "name") ?? "");
    // Chests (type 3) keep their loot id in data1.
    const loot = n(r, "type") === 3 ? n(r, "data1") : undefined;
    if (loot !== undefined && loot > 0) (objectLoot.get(loot) ?? objectLoot.set(loot, []).get(loot)!).push(entry);
  }
  const objectMaps = new Map<number, Set<number>>();
  for (const r of cm.gameobject ?? []) {
    const id = n(r, "id");
    const map = n(r, "map");
    if (id !== undefined && map !== undefined) (objectMaps.get(id) ?? objectMaps.set(id, new Set()).get(id)!).add(map);
  }
  const instances = new Map<number, string>();
  for (const r of db2.Map ?? []) {
    const id = int(r, "ID");
    const name = text(r.MapName_lang);
    if (id !== undefined && name !== undefined && (int(r, "InstanceType") ?? 0) > 0) instances.set(id, name);
  }

  // Vendors: rep (the item needs a standing), limited stock, or plain.
  const factions = byId(db2.Faction);
  const vendors = new Map<number, { npc: number; limited: boolean }[]>();
  const sells = (item: number | undefined, npc: number, limited: boolean) => {
    if (item === undefined || !recipeItems.has(item)) return;
    (vendors.get(item) ?? vendors.set(item, []).get(item)!).push({ npc, limited });
  };
  for (const r of cm.npc_vendor ?? []) sells(n(r, "item"), n(r, "entry") ?? 0, (n(r, "maxcount") ?? 0) > 0);
  for (const r of cm.npc_vendor_template ?? []) {
    for (const npc of vendorTemplateUsers.get(n(r, "entry") ?? -1) ?? []) {
      sells(n(r, "item"), npc, (n(r, "maxcount") ?? 0) > 0);
    }
  }
  for (const [item, list] of vendors) {
    const template = itemTemplates.get(item);
    const factionId = n(template, "RequiredReputationFaction") ?? 0;
    const npcs = [...new Set(list.map((v) => creatureNames.get(v.npc)).filter((x) => x !== undefined && x !== ""))];
    const npc = npcs.length >= 1 && npcs.length <= NAMED_OTHERS ? npcs.join(", ") : undefined;
    for (const recipe of recipeItems.get(item)!) {
      if (factionId > 0) {
        add(
          recipe,
          {
            kind: "rep",
            npc,
            faction: text(factions.get(factionId)?.Name_lang),
            rank: STANDINGS[n(template, "RequiredReputationRank") ?? -1],
            isRare: true,
          },
          itemNeed(item),
        );
      } else {
        add(
          recipe,
          { kind: list.some((v) => v.limited) ? "vendor_limited" : "vendor", npc, isRare: false },
          itemNeed(item),
        );
      }
    }
  }

  // Drops: the recipe item in a creature's, chest's or container's loot, directly or through reference tables.
  const references = group(cm.reference_loot_template ?? [], (r) => n(r, "entry"));
  const lootTables: [CmangosTable, "creature" | "object" | "item"][] = [
    ["creature_loot_template", "creature"],
    ["gameobject_loot_template", "object"],
    ["item_loot_template", "item"],
  ];
  const dropsOf = new Map<number, { kind: "creature" | "object" | "item"; owner: number }[]>();
  const reach = (ref: number, seen: Set<number>, hit: (item: number) => void) => {
    if (seen.has(ref)) return;
    seen.add(ref);
    for (const r of references.get(ref) ?? []) {
      const m = n(r, "mincountOrRef") ?? 1;
      if (m < 0) reach(-m, seen, hit);
      else hit(n(r, "item") ?? 0);
    }
  };
  const refItems = new Map<number, Set<number>>();
  const itemsOfRef = (ref: number): Set<number> => {
    let set = refItems.get(ref);
    if (set === undefined) {
      set = new Set();
      const into = set;
      reach(ref, new Set(), (item) => into.add(item));
      refItems.set(ref, set);
    }
    return set;
  };
  for (const [table, kind] of lootTables) {
    for (const r of cm[table] ?? []) {
      const entry = n(r, "entry");
      if (entry === undefined) continue;
      const m = n(r, "mincountOrRef") ?? 1;
      const items = m < 0 ? itemsOfRef(-m) : new Set([n(r, "item") ?? 0]);
      for (const item of items) {
        if (!recipeItems.has(item)) continue;
        const owners =
          kind === "creature"
            ? (lootOwners.get(entry) ?? [entry])
            : kind === "object"
              ? (objectLoot.get(entry) ?? [])
              : [entry];
        for (const owner of owners) (dropsOf.get(item) ?? dropsOf.set(item, []).get(item)!).push({ kind, owner });
      }
    }
  }
  for (const [item, list] of dropsOf) {
    const unique = [...new Map(list.map((d) => [`${d.kind}:${d.owner}`, d])).values()];
    const maps = new Set<number>();
    for (const d of unique) {
      const on =
        d.kind === "creature" ? creatureMaps.get(d.owner) : d.kind === "object" ? objectMaps.get(d.owner) : undefined;
      for (const m of on ?? []) maps.add(m);
    }
    const inside = [...maps].map((m) => instances.get(m));
    const place = inside.length === 1 && inside[0] !== undefined ? inside[0] : undefined;
    const named = unique.length <= NAMED_DROPS;
    for (const recipe of recipeItems.get(item)!) {
      if (!named) {
        add(recipe, { kind: "drop", place, isRare: true }, itemNeed(item));
        continue;
      }
      for (const d of unique) {
        const name =
          d.kind === "creature"
            ? creatureNames.get(d.owner)
            : d.kind === "object"
              ? objectNames.get(d.owner)
              : undefined;
        add(recipe, { kind: "drop", place, npc: text(name), isRare: true }, itemNeed(item));
      }
    }
  }

  // Quests: a recipe item among the rewards, or a reward spell that teaches the recipe.
  const quests = new Map<number, Set<string>>();
  for (const q of cm.quest_template ?? []) {
    const title = s(q, "Title") ?? "";
    const found = new Set<number>();
    for (const k of ["RewItemId1", "RewItemId2", "RewItemId3", "RewItemId4"].concat(
      [1, 2, 3, 4, 5, 6].map((i) => `RewChoiceItemId${i}`),
    )) {
      const item = n(q, k) ?? 0;
      for (const recipe of recipeItems.get(item) ?? []) need(recipe, itemNeed(item));
    }
    for (const k of ["RewItemId1", "RewItemId2", "RewItemId3", "RewItemId4"].concat(
      [1, 2, 3, 4, 5, 6].map((i) => `RewChoiceItemId${i}`),
    )) {
      for (const recipe of recipeItems.get(n(q, k) ?? 0) ?? []) found.add(recipe);
    }
    for (const k of ["RewSpell", "RewSpellCast"]) for (const recipe of taught(n(q, k))) found.add(recipe);
    for (const recipe of found) (quests.get(recipe) ?? quests.set(recipe, new Set()).get(recipe)!).add(title);
  }
  for (const [recipe, titles] of quests) {
    const named = titles.size <= NAMED_OTHERS ? [...titles].filter((t) => t !== "") : [];
    if (named.length === 0) add(recipe, { kind: "quest", isRare: false });
    for (const quest of named) add(recipe, { kind: "quest", quest, isRare: false });
  }

  // --- items: what recipes make and use ---
  const spellNames = byId(db2.SpellName);
  const reagentRows = byId(db2.SpellReagents, "SpellID");
  const recipes: RecipeRecord[] = [];
  const reagents: ReagentRecord[] = [];
  const itemIds = new Set<number>();
  for (const [spell, r] of [...abilities].sort((a, b) => a[0] - b[0])) {
    const created = effectsOf(spell)
      .filter((e) => int(e, "Effect") === CREATE_ITEM)
      .map((e) => int(e, "EffectItemType"))
      .find((id) => id !== undefined && id > 0);
    if (created !== undefined) itemIds.add(created);
    const yellow = int(r, "TrivialSkillLineRankLow") ?? 0;
    const grey = int(r, "TrivialSkillLineRankHigh") ?? 0;
    const foreverOnly = !eraSpells.has(spell);
    recipes.push(
      compact({
        id: spell,
        name: text(spellNames.get(spell)?.Name_lang),
        skillLineId: int(r, "SkillLine")!,
        createdItemId: created,
        orange: orangeOf(int(r, "MinSkillLineRank") ?? 0, needs.get(spell), yellow),
        yellow,
        green: greenThreshold(yellow, grey),
        grey,
        obtainable: foreverOnly || (sources.get(spell)?.length ?? 0) > 0,
        foreverOnly,
      }),
    );
    const rr = reagentRows.get(spell);
    for (let i = 0; i < 8; i++) {
      const item = int(rr, `Reagent_${i}`);
      const count = int(rr, `ReagentCount_${i}`);
      if (item === undefined || item <= 0 || count === undefined || count <= 0) continue;
      reagents.push({ recipeId: spell, itemId: item, count });
      itemIds.add(item);
    }
  }

  // --- WEB-96: dungeon bosses and their loot; the dropped items join the items ---
  const { bosses, drops: bossDrops } = buildBosses({
    encounters: db2.DungeonEncounter ?? [],
    maps: db2.Map ?? [],
    itemRows: byId(db2.Item),
    sparseRows,
    itemTemplates,
    creatureTemplates: cm.creature_template ?? [],
    creatures: cm.creature ?? [],
    creatureLoot: cm.creature_loot_template ?? [],
    quests: cm.quest_template ?? [],
    recipeItems,
  });
  for (const d of bossDrops) itemIds.add(d.itemId);
  // A recipe drop's skill and profession, as the recipe drawer shows them: the item's RequiredSkillRank, else orange.
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  for (const d of bossDrops) {
    const recipe = recipeById.get(d.recipeId ?? -1);
    if (recipe === undefined) continue;
    const skill = itemNeed(d.itemId) || recipe.orange;
    if (skill > 0) d.skill = skill;
    d.line = recipe.skillLineId;
  }

  const items = buildItems(
    db2,
    itemTemplates,
    spellsOfItem,
    effects,
    [...itemIds].sort((a, b) => a - b),
  );
  const itemById = new Map(items.map((i) => [i.id, i]));
  for (const recipe of recipes) {
    const category = categoryOf(recipe, itemById.get(recipe.createdItemId ?? -1));
    if (category !== undefined) recipe.category = category;
  }

  const sourceList: SourceRecord[] = [];
  for (const recipe of recipes) for (const src of sources.get(recipe.id) ?? []) sourceList.push(src);

  // --- WEB-98: where to get each reagent ---
  const makers = new Map<number, number[]>();
  for (const r of [...recipes].sort((a, b) => a.orange - b.orange || a.id - b.id)) {
    if (r.createdItemId !== undefined && r.obtainable) {
      (makers.get(r.createdItemId) ?? makers.set(r.createdItemId, []).get(r.createdItemId)!).push(r.id);
    }
  }
  const reagentSources = buildReagentSources({
    reagents: new Set(reagents.map((r) => r.itemId)),
    makers,
    itemLevel: (id) => int(sparseRows.get(id), "ItemLevel") ?? n(itemTemplates.get(id), "ItemLevel"),
    db2,
    cmangos: cm,
  });
  return { items, recipes, reagents, sources: sourceList, bosses, bossDrops, reagentSources };
}

/**
 * Orange: the lowest skill a source needs, at least the client's MinSkillLineRank. cmangos' numbers are Vanilla's: one
 * above the Forever client's yellow (Forever moved the recipe down, e.g. Bolt of Runecloth) is not taken.
 */
export function orangeOf(min: number, need: number | undefined, yellow: number): number {
  if (need === undefined || need <= min || (yellow > 0 && need > yellow)) return min;
  return need;
}

/** The grouping of a recipe: gear by slot, an enchant by the slot in its name, else the item type. */
function categoryOf(recipe: RecipeRecord, item: ItemRecord | undefined): string | undefined {
  if (item === undefined) {
    const m = /^Enchant (.+?) - /.exec(recipe.name ?? "");
    return m !== null ? m[1] : undefined;
  }
  const slot = SLOT_NAMES[item.inventoryType ?? 0];
  if (slot !== undefined && slot !== "Bag" && (item.classId === 2 || item.classId === 4)) return slot;
  return item.typeName;
}

function buildItems(
  db2: ImportInput["db2"],
  templates: Map<number, SqlRow>,
  spellsOfItem: Map<number, Record<string, string>[]>,
  effects: Map<number, Record<string, string>[]>,
  ids: number[],
): ItemRecord[] {
  const sparse = byId(db2.ItemSparse);
  const base = byId(db2.Item);
  const spells = spellLookup(db2, effects);
  const icons = new Map<number, string>();
  for (const r of db2.ManifestInterfaceData ?? []) {
    const id = int(r, "ID");
    const path = (r.FilePath ?? "").toLowerCase().replace(/\//g, "\\");
    const file = (r.FileName ?? "").toLowerCase();
    if (id !== undefined && path === "interface\\icons\\" && file.endsWith(".blp")) icons.set(id, file.slice(0, -4));
  }
  const appearanceIcons = new Map<number, number>();
  for (const r of db2.ItemAppearance ?? []) {
    const id = int(r, "ID");
    const icon = int(r, "DefaultIconFileDataID");
    if (id !== undefined && icon !== undefined && icon > 0) appearanceIcons.set(id, icon);
  }
  const itemIcons = new Map<number, number>();
  for (const r of db2.ItemModifiedAppearance ?? []) {
    const item = int(r, "ItemID");
    const icon = appearanceIcons.get(int(r, "ItemAppearanceID") ?? -1);
    // The default appearance (lowest OrderIndex) first.
    if (item !== undefined && icon !== undefined && (int(r, "OrderIndex") ?? 0) === 0) itemIcons.set(item, icon);
  }
  const subclasses = new Map<string, string>();
  for (const r of db2.ItemSubClass ?? []) {
    const name = text(r.DisplayName_lang);
    if (name !== undefined) subclasses.set(`${r.ClassID}:${r.SubClassID}`, name);
  }
  const out: ItemRecord[] = [];
  for (const id of ids) {
    const sp = sparse.get(id);
    const it = base.get(id);
    const t = templates.get(id);
    if (sp === undefined && it === undefined && t === undefined) {
      out.push({ id });
      continue;
    }
    const classId = int(it, "ClassID") ?? n(t, "class");
    const subclassId = int(it, "SubclassID") ?? n(t, "subclass");
    const record: ItemRecord = {
      id,
      name: text(sp?.Display_lang) ?? s(t, "name"),
      quality: int(sp, "OverallQualityID") ?? n(t, "Quality"),
      itemLevel: int(sp, "ItemLevel") ?? n(t, "ItemLevel"),
      requiredLevel: int(sp, "RequiredLevel") ?? n(t, "RequiredLevel"),
      bonding: int(sp, "Bonding") ?? n(t, "bonding"),
      classId,
      subclassId,
      inventoryType: int(sp, "InventoryType") ?? int(it, "InventoryType") ?? n(t, "InventoryType"),
      typeName: subclasses.get(`${classId}:${subclassId}`),
      iconName: icons.get(int(it, "IconFileDataID") || itemIcons.get(id) || -1),
      description: text(sp?.Description_lang) ?? text(s(t, "description")),
      maxStack: int(sp, "Stackable") ?? n(t, "stackable"),
    };
    if (t !== undefined) {
      const armor = n(t, "armor") ?? 0;
      if (armor > 0) record.armor = armor;
      const durability = n(t, "MaxDurability") ?? 0;
      if (durability > 0) record.durability = durability;
      const stats: ItemStat[] = [];
      for (let i = 1; i <= 10; i++) {
        const value = n(t, `stat_value${i}`) ?? 0;
        if (value !== 0) stats.push({ type: n(t, `stat_type${i}`) ?? 0, value });
      }
      if (stats.length > 0) record.stats = stats;
      const resistances: NonNullable<ItemRecord["resistances"]> = {};
      for (const school of ["holy", "fire", "nature", "frost", "shadow", "arcane"] as const) {
        const v = n(t, `${school}_res`) ?? 0;
        if (v !== 0) resistances[school] = v;
      }
      if (Object.keys(resistances).length > 0) record.resistances = resistances;
      const min = n(t, "dmg_min1") ?? 0;
      const max = n(t, "dmg_max1") ?? 0;
      if (max > 0) record.damage = { min, max, school: n(t, "dmg_type1") ?? 0 };
      const delay = n(t, "delay") ?? 0;
      if (max > 0 && delay > 0) record.speed = delay;
    }
    // The item's spells: the Forever client's, else cmangos' (spellid_N with spelltrigger_N).
    const itemSpells: { spell: number; trigger?: number; cooldown?: number }[] = [];
    for (const e of spellsOfItem.get(id) ?? []) {
      const spell = int(e, "SpellID");
      if (spell !== undefined && spell > 0) {
        itemSpells.push({ spell, trigger: int(e, "TriggerType"), cooldown: int(e, "CoolDownMSec") });
      }
    }
    if (itemSpells.length === 0) {
      for (let i = 1; i <= 5; i++) {
        const spell = n(t, `spellid_${i}`) ?? 0;
        if (spell > 0) {
          itemSpells.push({ spell, trigger: n(t, `spelltrigger_${i}`), cooldown: n(t, `spellcooldown_${i}`) });
        }
      }
    }
    for (const { spell, trigger, cooldown: ms } of itemSpells) {
      let line = spellText(spells(spell), spells);
      if (line === undefined) continue;
      const cooldown = ms ?? -1;
      if (trigger === 0 && cooldown > 0) line += ` (${cooldownText(cooldown)} Cooldown)`;
      const key = trigger === 0 ? "use" : trigger === 1 ? "equip" : trigger === 2 ? "chanceOnHit" : undefined;
      if (key !== undefined) (record[key] ??= []).push(line);
    }
    out.push(compact(record));
  }
  return out;
}

/** "5 Min", "1 Hour", "30 Sec": the game's tooltip cooldown units. */
function cooldownText(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec >= 3600 && sec % 3600 === 0) return `${sec / 3600} ${sec === 3600 ? "Hour" : "Hours"}`;
  if (sec >= 60 && sec % 60 === 0) return `${sec / 60} Min`;
  return `${sec} Sec`;
}

function compact<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}
