// Dungeon bosses and their loot (WEB-96), part of the item import (./build.ts). Pure: every table comes in as rows.
// docs/SOURCE-DATA.md "Item database".
//
// Sources (rule 10):
// - The Forever client's DungeonEncounter (wago.tools, product `wowf`): the bosses, their order (OrderIndex) and IDs.
//   DungeonEncounter.ID is the encounterID the game's ENCOUNTER_END event gives (CommunitiesForever
//   docs/API-FINDINGS.md V35: `3353, Witherfang` in Ruins of Lordaeron), which the addon records as a kill. Only the
//   base difficulties (DifficultyID 0 and 1); the others are Season of Discovery's.
// - The Forever client's Map: the instance's name, matched to our dungeons (src/core/gamedata/dungeons.ts) by name.
// - src/core/gamedata/bosses.ts: final and optional bosses, wings, encounters fought together.
// - cmangos classic-db (GPL-3.0, https://github.com/cmangos/classic-db), as of Vanilla 1.12: the boss's creature
//   (creature_template by name, spawned on the instance's map) and its own loot (creature_loot_template). Reference
//   tables (shared world drops) are left out. Chances: cmangos' ChanceOrQuestChance; negative means a quest drop; 0 in
//   a group shares what the group's other rows leave of 100 % equally (cmangos' loot groups).
// Forever's own dungeons are not in cmangos: their bosses have no loot.
import { BOSS_NOTES, type DungeonBossNotes, ENCOUNTER_CREATURES } from "../gamedata/bosses";
import { DUNGEONS, type DungeonInfo } from "../gamedata/dungeons";
import { int } from "./csv";
import { n, s, type SqlRow } from "./sqlDump";

export interface BossRecord {
  /** DungeonEncounter.ID: the encounterID of ENCOUNTER_END. */
  id: number;
  name: string;
  /** The site's dungeon id (src/core/gamedata/dungeons.ts). */
  dungeonId: string;
  /** The wing's id for Scarlet Monastery and Blackrock Spire. */
  wingId?: string;
  /** 1, 2, ... within the dungeon, or the wing: the client's order. */
  position: number;
  /** Ends the dungeon (or wing): "Cleared" means this boss died. */
  final: boolean;
  /** Doesn't count towards "N of M". */
  optional: boolean;
}

export interface BossDropRecord {
  bossId: number;
  itemId: number;
  /** 1, 2, ...: highest chance first. */
  position: number;
  /** Drop chance in percent, one decimal. */
  chance: number;
  /** Item class and subclass (the Forever client's, else cmangos'). */
  classId?: number;
  subclassId?: number;
  /** AllowableClass bit mask; undefined: every class. */
  classes?: number;
  /** The quest it drops for only (a quest drop). */
  questId?: number;
  /** The recipe (spell ID) a recipe item teaches. */
  recipeId?: number;
}

type Rows = Record<string, string>[];

export interface BossInput {
  encounters: Rows;
  maps: Rows;
  /** The Forever client's Item and ItemSparse rows by item ID. */
  itemRows: Map<number, Record<string, string>>;
  sparseRows: Map<number, Record<string, string>>;
  itemTemplates: Map<number, SqlRow>;
  creatureTemplates: SqlRow[];
  creatures: SqlRow[];
  creatureLoot: SqlRow[];
  quests: SqlRow[];
  /** Recipe items -> the recipes (spell IDs) they teach. */
  recipeItems: Map<number, Set<number>>;
}

export interface BossOptions {
  dungeons?: readonly DungeonInfo[];
  notes?: Readonly<Record<string, DungeonBossNotes>>;
  together?: Readonly<Record<string, readonly string[]>>;
}

/** Drops below this chance are left out, except quest items and recipes. */
export const MIN_CHANCE = 1;
const QUEST_CLASS = 12;
const RECIPE_CLASS = 9;
/**
 * AllowableClass bits of the classes Forever has (bit = 1 << (ClassID - 1); warcraft.wiki.gg "ClassId": 1 Warrior,
 * 2 Paladin, 3 Hunter, 4 Rogue, 5 Priest, 7 Shaman, 8 Mage, 9 Warlock, 11 Druid). A mask with all of them (-1,
 * 32767) is every class.
 */
export const ALL_CLASSES = 1 | 2 | 4 | 8 | 16 | 64 | 128 | 256 | 1024;
/** DungeonEncounter difficulties of the base game (0 none, 1 normal); the others are Season of Discovery's. */
const BASE_DIFFICULTIES = new Set([0, 1]);

/** "The Shaper's Terrace" and "Shaper's Terrace" are one dungeon. */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/^the /, "").trim();
}

export function buildBosses(
  input: BossInput,
  options: BossOptions = {},
): { bosses: BossRecord[]; drops: BossDropRecord[] } {
  const dungeons = (options.dungeons ?? DUNGEONS).filter((d) => d.kind === "dungeon");
  const notes = options.notes ?? BOSS_NOTES;
  const together = options.together ?? ENCOUNTER_CREATURES;

  // Instance maps -> our dungeons, by the map's name.
  const byName = new Map<string, DungeonInfo>();
  for (const d of dungeons) for (const t of [d.name, ...d.zoneTexts]) byName.set(nameKey(t), d);
  const dungeonOfMap = new Map<number, DungeonInfo>();
  for (const r of input.maps) {
    const id = int(r, "ID");
    const name = r.MapName_lang;
    if (id === undefined || name === undefined || (int(r, "InstanceType") ?? 0) !== 1) continue;
    const d = byName.get(nameKey(name));
    if (d !== undefined) dungeonOfMap.set(id, d);
  }

  // Encounters per dungeon in the client's order.
  const perDungeon = new Map<string, { id: number; name: string; order: number }[]>();
  const seen = new Set<number>();
  for (const r of input.encounters) {
    const id = int(r, "ID");
    const map = int(r, "MapID");
    const name = (r.Name_lang ?? "").trim();
    const diff = int(r, "DifficultyID") ?? 0;
    if (id === undefined || map === undefined || name === "" || !BASE_DIFFICULTIES.has(diff) || seen.has(id)) continue;
    const d = dungeonOfMap.get(map);
    if (d === undefined) continue;
    seen.add(id);
    const list = perDungeon.get(d.id) ?? perDungeon.set(d.id, []).get(d.id)!;
    list.push({ id, name, order: int(r, "OrderIndex") ?? 0 });
  }

  const bosses: BossRecord[] = [];
  for (const d of dungeons) {
    const list = perDungeon.get(d.id);
    if (list === undefined) continue;
    list.sort((a, b) => a.order - b.order || a.id - b.id);
    const note = notes[d.id] ?? {};
    const optional = new Set(note.optional ?? []);
    if (note.wings !== undefined) {
      for (const [wingId, names] of Object.entries(note.wings)) {
        const inWing = list.filter((e) => names.includes(e.name));
        if (inWing.length === 0) continue;
        const wingFinal = finalOf(inWing, note.finals?.[wingId]);
        inWing.forEach((e, i) =>
          bosses.push({
            id: e.id,
            name: e.name,
            dungeonId: d.id,
            wingId,
            position: i + 1,
            final: e.name === wingFinal,
            optional: optional.has(e.name),
          }),
        );
      }
      continue;
    }
    const final = finalOf(list, note.final);
    list.forEach((e, i) =>
      bosses.push({
        id: e.id,
        name: e.name,
        dungeonId: d.id,
        position: i + 1,
        final: e.name === final,
        optional: optional.has(e.name),
      }),
    );
  }

  return { bosses, drops: bossDrops(input, bosses, dungeonOfMap, together) };
}

/**
 * The hand-made final when the client lists it; else (Forever's own dungeons, or a boss the client renamed) the last
 * boss the client lists.
 */
function finalOf(list: readonly { name: string }[], named: string | undefined): string {
  return named !== undefined && list.some((e) => e.name === named) ? named : list[list.length - 1]!.name;
}

function bossDrops(
  input: BossInput,
  bosses: BossRecord[],
  dungeonOfMap: Map<number, DungeonInfo>,
  together: Readonly<Record<string, readonly string[]>>,
): BossDropRecord[] {
  // cmangos creatures by name, and the maps each is spawned on.
  const templatesByName = new Map<string, SqlRow[]>();
  for (const r of input.creatureTemplates) {
    const name = s(r, "Name");
    if (name === undefined || name === "") continue;
    (templatesByName.get(name) ?? templatesByName.set(name, []).get(name)!).push(r);
  }
  const spawnedOn = new Map<number, Set<number>>();
  for (const r of input.creatures) {
    const id = n(r, "id");
    const map = n(r, "map");
    if (id !== undefined && map !== undefined) (spawnedOn.get(id) ?? spawnedOn.set(id, new Set()).get(id)!).add(map);
  }
  const mapsOf = new Map<string, number[]>();
  for (const [map, d] of dungeonOfMap) (mapsOf.get(d.id) ?? mapsOf.set(d.id, []).get(d.id)!).push(map);

  const lootByEntry = new Map<number, SqlRow[]>();
  for (const r of input.creatureLoot) {
    const entry = n(r, "entry");
    if (entry !== undefined) (lootByEntry.get(entry) ?? lootByEntry.set(entry, []).get(entry)!).push(r);
  }
  // The quest an item is needed for (the lowest quest ID asking for it).
  const questOf = new Map<number, number>();
  for (const q of input.quests) {
    const quest = n(q, "entry");
    if (quest === undefined) continue;
    for (let i = 1; i <= 4; i++) {
      const item = n(q, `ReqItemId${i}`) ?? 0;
      if (item > 0 && (questOf.get(item) ?? Infinity) > quest) questOf.set(item, quest);
    }
  }

  const out: BossDropRecord[] = [];
  for (const boss of bosses) {
    const maps = new Set(mapsOf.get(boss.dungeonId) ?? []);
    // The boss's creatures: spawned on the instance's map, else (summoned bosses) spawned nowhere.
    const entries = new Set<number>();
    for (const name of new Set([boss.name, ...(together[boss.name] ?? [])])) {
      const templates = templatesByName.get(name) ?? [];
      const here = templates.filter((t) => [...(spawnedOn.get(n(t, "Entry") ?? -1) ?? [])].some((m) => maps.has(m)));
      const chosen = here.length > 0 ? here : templates.filter((t) => !spawnedOn.has(n(t, "Entry") ?? -1));
      for (const t of chosen) {
        const loot = n(t, "LootId") ?? 0;
        if (loot > 0) entries.add(loot);
      }
    }
    const best = new Map<number, { chance: number; quest: boolean }>();
    for (const entry of [...entries].sort((a, b) => a - b)) {
      for (const drop of ownDrops(lootByEntry.get(entry) ?? [])) {
        const was = best.get(drop.item);
        if (was === undefined || drop.chance > was.chance) best.set(drop.item, drop);
      }
    }
    const kept: BossDropRecord[] = [];
    for (const [itemId, { chance, quest }] of best) {
      const item = input.itemRows.get(itemId);
      const template = input.itemTemplates.get(itemId);
      const classId = int(item, "ClassID") ?? n(template, "class");
      const recipe = [...(input.recipeItems.get(itemId) ?? [])].sort((a, b) => a - b)[0];
      const special = quest || classId === QUEST_CLASS || classId === RECIPE_CLASS || recipe !== undefined;
      if (chance < MIN_CHANCE && !special) continue;
      if (chance <= 0) continue;
      const mask = int(input.sparseRows.get(itemId), "AllowableClass") ?? n(template, "AllowableClass");
      const record: BossDropRecord = {
        bossId: boss.id,
        itemId,
        position: 0,
        chance: Math.max(0.1, Math.round(chance * 10) / 10),
      };
      if (classId !== undefined) record.classId = classId;
      const subclassId = int(item, "SubclassID") ?? n(template, "subclass");
      if (subclassId !== undefined) record.subclassId = subclassId;
      if (mask !== undefined && mask > 0 && (mask & ALL_CLASSES) !== ALL_CLASSES) record.classes = mask;
      const questId = quest ? questOf.get(itemId) : undefined;
      if (questId !== undefined) record.questId = questId;
      if (recipe !== undefined) record.recipeId = recipe;
      kept.push(record);
    }
    kept.sort((a, b) => b.chance - a.chance || a.itemId - b.itemId);
    kept.forEach((d, i) => {
      d.position = i + 1;
      out.push(d);
    });
  }
  return out;
}

/** A loot table's own items with their chance in percent (no references). */
export function ownDrops(rows: readonly SqlRow[]): { item: number; chance: number; quest: boolean }[] {
  const own = rows.filter((r) => (n(r, "mincountOrRef") ?? 1) >= 0 && (n(r, "item") ?? 0) > 0);
  // Equal-chance rows of a group share what the group's explicit chances leave.
  const explicit = new Map<number, number>();
  const equal = new Map<number, number>();
  for (const r of own) {
    const group = n(r, "groupid") ?? 0;
    const chance = Math.abs(n(r, "ChanceOrQuestChance") ?? 0);
    if (group === 0) continue;
    if (chance > 0) explicit.set(group, (explicit.get(group) ?? 0) + chance);
    else equal.set(group, (equal.get(group) ?? 0) + 1);
  }
  return own.map((r) => {
    const raw = n(r, "ChanceOrQuestChance") ?? 0;
    const group = n(r, "groupid") ?? 0;
    let chance = Math.abs(raw);
    if (chance === 0 && group > 0) chance = Math.max(0, 100 - (explicit.get(group) ?? 0)) / (equal.get(group) ?? 1);
    return { item: n(r, "item")!, chance: Math.min(100, chance), quest: raw < 0 };
  });
}
