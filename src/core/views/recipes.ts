import { PROFESSIONS, professionInfo, type ClassFile } from "../gamedata";
import { itemQuality, type ItemQuality } from "../gamedata/items";
import type { ItemRecord, SourceKind } from "../recipes/build";
import type { ItemSetBonus, ItemSetPiece } from "../recipes/itemSets";
import { difficulty, type Difficulty, type Thresholds } from "../recipes/skill";
import { OLD_AFTER } from "./age";
import { byLevel, compareText, type CharacterView } from "./characters";
import { itemFallbackName, recipeFallbackName } from "./itemTooltip";
import { coverage, type Coverage } from "./professions";
import { professionSlug } from "./rosterQuery";

// Recipes on the site (WEB-92, handoff Part C): the recipe line on the character page and on each profession card, the
// live search on the Professions page and the profession page with its drawer. Pure: the server reads the item
// database and the derived recipe tables (WEB-90) and passes the rows in.
//
// Counting rules (handoff Decisions, docs/SOURCE-DATA.md "Item database"): every character counts, alts included. Only
// obtainable recipes count in "N of M" and "Nobody has"; a removed one still shows when someone knows it. Forever's
// own recipes count in the totals, but never as "Nobody has" while where they are learned is unknown.

/** Crafting professions, Cooking and First Aid get recipes (handoff Decisions; src/core/gamedata/professions.ts). */
export const RECIPE_PROFESSIONS: readonly number[] = [171, 164, 333, 202, 165, 197, 185, 129];
/** Mining's Smelting counts as recipes only when the scans have some (handoff Decisions). */
export const SMELTING = 186;

export interface RecipeData {
  id: number;
  name?: string | null;
  skillLineId: number | null;
  createdItemId?: number | null;
  orange?: number | null;
  yellow?: number | null;
  green?: number | null;
  grey?: number | null;
  category?: string | null;
  obtainable: boolean;
  foreverOnly: boolean;
}

export interface ItemData {
  id: number;
  name?: string | null;
  quality?: number | null;
  iconName?: string | null;
}

export interface SourceData {
  recipeId: number;
  kind: SourceKind;
  place?: string | null;
  npc?: string | null;
  quest?: string | null;
  faction?: string | null;
  rank?: string | null;
}

export interface ReagentData {
  recipeId: number;
  itemId: number;
  count: number;
}

export interface KnownData {
  guid: string;
  recipeId: number;
}

export interface CharacterProfessionData {
  guid: string;
  skillLineId: number;
  skill?: number | null;
  spec?: string | null;
  scannedAt?: number | null;
}

// --- shared pieces --------------------------------------------------------------------------------------------------

/** "Drop · Blackrock Spire": the kind, then the dim detail. */
export interface SourceView {
  label: string;
  detail?: string;
}

const SOURCE_ORDER: Record<SourceKind, number> = {
  trainer: 0,
  vendor: 1,
  vendor_limited: 2,
  quest: 3,
  rep: 4,
  drop: 5,
};

export function sourceView(s: Omit<SourceData, "recipeId">): SourceView {
  const parts = (...p: (string | null | undefined)[]) => {
    const kept = p.filter((x): x is string => x !== undefined && x !== null && x !== "");
    return kept.length === 0 ? undefined : kept.join(" · ");
  };
  const view = (label: string, detail: string | undefined): SourceView =>
    detail === undefined ? { label } : { label, detail };
  switch (s.kind) {
    case "trainer":
      return { label: "Trainer" };
    case "vendor":
      return view("Vendor", parts(s.faction, s.rank));
    case "vendor_limited":
      return { label: "Vendor", detail: "Limited" };
    case "drop":
      return view("Drop", parts(s.place ?? s.npc));
    case "rep":
      return view("Rep", parts(s.faction, s.rank));
    case "quest":
      return view("Quest", parts(s.quest));
  }
}

/** Every source once, the easiest first (trainer, vendor, quest, rep, drop). */
export function sourceViews(sources: readonly SourceData[]): SourceView[] {
  const seen = new Set<string>();
  const out: SourceView[] = [];
  for (const s of [...sources].sort((a, b) => SOURCE_ORDER[a.kind] - SOURCE_ORDER[b.kind])) {
    const v = sourceView(s);
    const key = `${v.label}|${v.detail ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function recipeThresholds(r: RecipeData): Thresholds | undefined {
  const { orange, yellow, green, grey } = r;
  if (orange == null || yellow == null || green == null || grey == null) return undefined;
  return { orange, yellow, green, grey };
}

/** The name, quality and icon a recipe shows: its item's, else its own; a fallback for Forever's nameless ones. */
export function recipeLook(
  r: RecipeData,
  item: ItemData | undefined,
): { name: string; named: boolean; quality: ItemQuality; icon?: string } {
  const itemName = item?.name ?? undefined;
  const name = itemName ?? r.name ?? undefined;
  const look = {
    name: name ?? (r.createdItemId != null ? itemFallbackName(r.createdItemId) : recipeFallbackName(r.id)),
    named: name !== undefined,
    quality: itemQuality(item?.quality ?? undefined),
  };
  return item?.iconName ? { ...look, icon: item.iconName } : look;
}

export function hasRecipes(skillLine: number): boolean {
  return RECIPE_PROFESSIONS.includes(skillLine) || skillLine === SMELTING;
}

/** The profession page's skill line for a slug ("tailoring", "first-aid"). */
export function recipeSkillLine(slug: string): number | undefined {
  for (const id of [...RECIPE_PROFESSIONS, SMELTING]) if (professionSlug(String(id)) === slug) return id;
  return undefined;
}

// --- character page and profession cards (RC01, RC02) ---------------------------------------------------------------

export type RecipeLine =
  | { kind: "count"; skillLine: string; slug: string; count: number; staleAt?: number; spec?: string }
  | { kind: "notScanned"; skillLine: string; name: string };

/**
 * The recipe line under each of a character's crafting professions (RC01): "86 recipes ›", "as of 21 Oct" when its
 * scan is older than 7 days, "Recipes not scanned" without a scan. Gathering professions and Fishing get none; Mining
 * only when the scan has Smelting recipes.
 */
export function characterRecipeLines(
  c: CharacterView,
  professions: readonly CharacterProfessionData[],
  counts: ReadonlyMap<number, number>,
  now: number,
): Record<string, RecipeLine> {
  const out: Record<string, RecipeLine> = {};
  for (const p of c.professions) {
    const line = Number(p.skillLine);
    const count = counts.get(line) ?? 0;
    if (!RECIPE_PROFESSIONS.includes(line) && !(line === SMELTING && count > 0)) continue;
    const row = professions.find((r) => r.guid === c.guid && r.skillLineId === line);
    const scannedAt = row?.scannedAt ?? undefined;
    if (scannedAt === undefined && count === 0) {
      out[p.skillLine] = { kind: "notScanned", skillLine: p.skillLine, name: p.name };
      continue;
    }
    const view: RecipeLine = { kind: "count", skillLine: p.skillLine, slug: professionSlug(p.skillLine), count };
    if (scannedAt !== undefined && now - scannedAt >= OLD_AFTER) view.staleAt = scannedAt;
    if (row?.spec) view.spec = row.spec;
    out[p.skillLine] = view;
  }
  return out;
}

export interface RecipeTotals {
  /** Obtainable recipes someone in the group knows. */
  known: number;
  /** Obtainable recipes of the profession. */
  total: number;
}

/** "112 of 185 recipes" per skill line (RC02's card line); only lines with recipes in the database. */
export function recipeTotals(
  recipes: readonly RecipeData[],
  known: readonly KnownData[],
  guids: ReadonlySet<string>,
): Record<string, RecipeTotals> {
  const knownIds = new Set(known.filter((k) => guids.has(k.guid)).map((k) => k.recipeId));
  const out: Record<string, RecipeTotals> = {};
  for (const r of recipes) {
    if (r.skillLineId === null || !r.obtainable || !hasRecipes(r.skillLineId)) continue;
    const t = (out[String(r.skillLineId)] ??= { known: 0, total: 0 });
    t.total++;
    if (knownIds.has(r.id)) t.known++;
  }
  return out;
}

// --- the profession page (RC03, RC05, RC06) -------------------------------------------------------------------------

export interface Knower {
  guid: string;
  name: string;
  classFile?: ClassFile;
  /** The recipe's colour for this character now; undefined without thresholds or a skill. */
  difficulty?: Difficulty;
  skill?: number;
  online?: boolean;
}

export interface RecipeRow {
  id: number;
  name: string;
  named: boolean;
  quality: ItemQuality;
  icon?: string;
  itemId?: number;
  /** The item-type group ("Chest", "Bags"). */
  category: string;
  thresholds?: Thresholds;
  knownBy: Knower[];
  sources: SourceView[];
  reagents: { itemId: number; count: number }[];
  obtainable: boolean;
  /** Counts as "Nobody has": obtainable, nobody knows it, and where it's learned is known. */
  nobody: boolean;
}

export interface Crafter {
  guid: string;
  name: string;
  classFile?: ClassFile;
  rank: number;
  max?: number;
  best: boolean;
  /** When this character's recipes were last scanned; undefined: never. */
  scannedAt?: number;
  /** The scan is 7 days old or more ("as of 21 Oct"). */
  stale: boolean;
}

export interface ProfessionRecipesView {
  skillLine: number;
  slug: string;
  name: string;
  status: Coverage;
  crafters: Crafter[];
  total: number;
  known: number;
  nobody: number;
  /** The rows, groups by their best skill, highest first, each by skill (orange), highest first. */
  rows: RecipeRow[];
  types: string[];
  /** Someone has the profession, but nobody ever opened it in game (RC06 "No recipes scanned yet"). */
  notScanned: boolean;
}

export const OTHER_CATEGORY = "Other";

export interface ProfessionRecipesInput {
  skillLine: number;
  characters: readonly CharacterView[];
  recipes: readonly RecipeData[];
  items: ReadonlyMap<number, ItemData>;
  sources: readonly SourceData[];
  reagents: readonly ReagentData[];
  known: readonly KnownData[];
  professions: readonly CharacterProfessionData[];
  /** Characters seen online in the newest data ("Tailoring 300 · online"). */
  online?: ReadonlySet<string>;
  now: number;
}

const QUALITY_RANK: Record<ItemQuality, number> = {
  heirloom: 7,
  artifact: 6,
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
  poor: 0,
};

const orangeOf = (r: RecipeRow) => r.thresholds?.orange ?? -1;

export function professionRecipes(input: ProfessionRecipesInput): ProfessionRecipesView {
  const { skillLine, now } = input;
  const key = String(skillLine);
  const info = professionInfo(skillLine);
  const byGuid = new Map(input.characters.map((c) => [c.guid, c]));
  const profRow = (guid: string) => input.professions.find((p) => p.guid === guid && p.skillLineId === skillLine);

  const crafters: Crafter[] = [];
  for (const c of input.characters) {
    const p = c.professions.find((x) => x.skillLine === key);
    if (p === undefined || c.name === undefined) continue;
    const scannedAt = profRow(c.guid)?.scannedAt ?? undefined;
    const crafter: Crafter = {
      guid: c.guid,
      name: c.name,
      rank: p.rank,
      best: false,
      stale: scannedAt !== undefined && now - scannedAt >= OLD_AFTER,
    };
    if (c.classFile !== undefined) crafter.classFile = c.classFile;
    if (p.max !== undefined) crafter.max = p.max;
    if (scannedAt !== undefined) crafter.scannedAt = scannedAt;
    crafters.push(crafter);
  }
  crafters.sort((a, b) => b.rank - a.rank || byLevel(byGuid.get(a.guid)!, byGuid.get(b.guid)!));
  const best = crafters[0]?.rank;
  for (const c of crafters) c.best = c.rank === best;
  const skillOf = new Map(crafters.map((c) => [c.guid, c.rank]));

  const knowers = new Map<number, string[]>();
  for (const k of input.known) {
    if (!byGuid.has(k.guid)) continue;
    const list = knowers.get(k.recipeId);
    if (list === undefined) knowers.set(k.recipeId, [k.guid]);
    else list.push(k.guid);
  }
  const sourcesOf = group(input.sources, (s) => s.recipeId);
  const reagentsOf = group(input.reagents, (r) => r.recipeId);

  const rows: RecipeRow[] = [];
  for (const r of input.recipes) {
    if (r.skillLineId !== skillLine) continue;
    const guids = knowers.get(r.id) ?? [];
    if (!r.obtainable && guids.length === 0) continue;
    const thresholds = recipeThresholds(r);
    const item = r.createdItemId == null ? undefined : input.items.get(r.createdItemId);
    const look = recipeLook(r, item);
    const knownBy = guids
      .map((guid): Knower => {
        const c = byGuid.get(guid)!;
        const k: Knower = { guid, name: c.name ?? guid };
        if (c.classFile !== undefined) k.classFile = c.classFile;
        const skill = skillOf.get(guid);
        if (skill !== undefined) k.skill = skill;
        const d = thresholds === undefined ? undefined : difficulty(skill, thresholds);
        if (d !== undefined) k.difficulty = d;
        if (input.online?.has(guid)) k.online = true;
        return k;
      })
      .sort((a, b) => (b.skill ?? 0) - (a.skill ?? 0) || compareText(a.name, b.name));
    const sources = sourceViews(sourcesOf.get(r.id) ?? []);
    const row: RecipeRow = {
      id: r.id,
      name: look.name,
      named: look.named,
      quality: look.quality,
      category: r.category ?? OTHER_CATEGORY,
      knownBy,
      sources,
      reagents: (reagentsOf.get(r.id) ?? [])
        .map((g) => ({ itemId: g.itemId, count: g.count }))
        .sort((a, b) => b.count - a.count || a.itemId - b.itemId),
      obtainable: r.obtainable,
      nobody: r.obtainable && knownBy.length === 0 && !(r.foreverOnly && sources.length === 0),
    };
    if (look.icon !== undefined) row.icon = look.icon;
    if (r.createdItemId != null) row.itemId = r.createdItemId;
    if (thresholds !== undefined) row.thresholds = thresholds;
    rows.push(row);
  }

  // Groups by their best skill, highest first; rows by skill, highest first, then the best quality, then by name.
  const groupBest = new Map<string, number>();
  for (const r of rows) groupBest.set(r.category, Math.max(groupBest.get(r.category) ?? -1, orangeOf(r)));
  rows.sort(
    (a, b) =>
      groupBest.get(b.category)! - groupBest.get(a.category)! ||
      compareText(a.category, b.category) ||
      orangeOf(b) - orangeOf(a) ||
      QUALITY_RANK[b.quality] - QUALITY_RANK[a.quality] ||
      compareText(a.name, b.name) ||
      a.id - b.id,
  );

  const obtainable = rows.filter((r) => r.obtainable);
  const anyScanned =
    input.professions.some((p) => p.skillLineId === skillLine && p.scannedAt != null && byGuid.has(p.guid)) ||
    rows.some((r) => r.knownBy.length > 0);

  return {
    skillLine,
    slug: professionSlug(key),
    name: info?.name ?? PROFESSIONS[skillLine]?.name ?? key,
    status: coverage(best),
    crafters,
    total: obtainable.length,
    known: obtainable.filter((r) => r.knownBy.length > 0).length,
    nobody: obtainable.filter((r) => r.nobody).length,
    rows,
    types: [...new Set(rows.map((r) => r.category))],
    notScanned: crafters.length > 0 && !anyScanned,
  };
}

function group<T>(list: readonly T[], key: (t: T) => number): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const t of list) {
    const k = key(t);
    const l = out.get(k);
    if (l === undefined) out.set(k, [t]);
    else l.push(t);
  }
  return out;
}

// --- filters (URL: ?char=&type=&skill=&tab=&q=&recipe=) --------------------------------------------------------------

export type RecipeTab = "all" | "known" | "missing";

/** The skill filter's ranges: the rank caps (src/core/gamedata/professions.ts RANK_CAPS). */
export const SKILL_RANGES = ["1-75", "76-150", "151-225", "226-300"] as const;
export type SkillRange = (typeof SKILL_RANGES)[number];

export function parseSkillRange(value: string | null | undefined): [number, number] | undefined {
  if (value === null || value === undefined || !(SKILL_RANGES as readonly string[]).includes(value)) return undefined;
  const [min, max] = value.split("-").map(Number) as [number, number];
  return [min, max];
}

export interface RecipeFilter {
  tab: RecipeTab;
  /** A character's GUID: the Known tab then means "this character knows it". */
  char?: string;
  type?: string;
  skill?: string;
  /** Recipe IDs that match the search; undefined: no search. */
  matches?: ReadonlySet<number>;
}

/** The tab a page opens on: Known when it came for one character (RC06), else All. */
export function defaultTab(char: string | undefined): RecipeTab {
  return char === undefined ? "all" : "known";
}

export function filterRows(rows: readonly RecipeRow[], f: RecipeFilter): RecipeRow[] {
  const range = parseSkillRange(f.skill);
  return rows.filter((r) => {
    if (f.tab === "known" && !(f.char === undefined ? r.knownBy.length > 0 : r.knownBy.some((k) => k.guid === f.char)))
      return false;
    if (f.tab === "missing" && !r.nobody) return false;
    if (f.type !== undefined && r.category !== f.type) return false;
    if (range !== undefined) {
      const orange = r.thresholds?.orange;
      if (orange === undefined || orange < range[0] || orange > range[1]) return false;
    }
    if (f.matches !== undefined && !f.matches.has(r.id)) return false;
    return true;
  });
}

/** The tab counts: All and Nobody has for the group; Known for the character when one is picked. */
export function tabCounts(
  view: Pick<ProfessionRecipesView, "rows" | "total" | "known" | "nobody">,
  char: string | undefined,
): Record<RecipeTab, number> {
  const known =
    char === undefined
      ? view.known
      : view.rows.filter((r) => r.obtainable && r.knownBy.some((k) => k.guid === char)).length;
  return { all: view.total, known, missing: view.nobody };
}

// --- the live search on the Professions page (RC02) -----------------------------------------------------------------

export interface SearchEntry {
  id: number;
  name: string;
  /** The recipe's own name when it differs from the item's ("Pattern: …" or "Enchant Bracer - …"). */
  recipeName?: string;
  quality: ItemQuality;
  icon?: string;
  itemId?: number;
  skillLine: number;
  slug: string;
  profession: string;
  /** The skill to learn it (orange). */
  skill?: number;
  crafters: { name: string; classFile?: ClassFile; difficulty?: Difficulty }[];
  source?: SourceView;
  nobody: boolean;
}

export function searchEntries(input: Omit<ProfessionRecipesInput, "skillLine" | "online">): SearchEntry[] {
  const out: SearchEntry[] = [];
  const names = new Map(input.recipes.map((r) => [r.id, r.name ?? undefined]));
  for (const line of [...RECIPE_PROFESSIONS, SMELTING]) {
    const view = professionRecipes({ ...input, skillLine: line });
    for (const r of view.rows) {
      const raw = names.get(r.id);
      const e: SearchEntry = {
        id: r.id,
        name: r.name,
        quality: r.quality,
        skillLine: line,
        slug: view.slug,
        profession: view.name,
        crafters: r.knownBy.map((k) => {
          const c: SearchEntry["crafters"][number] = { name: k.name };
          if (k.classFile !== undefined) c.classFile = k.classFile;
          if (k.difficulty !== undefined) c.difficulty = k.difficulty;
          return c;
        }),
        nobody: r.nobody,
      };
      if (raw !== undefined && raw !== r.name) e.recipeName = raw;
      if (r.icon !== undefined) e.icon = r.icon;
      if (r.itemId !== undefined) e.itemId = r.itemId;
      if (r.thresholds !== undefined) e.skill = r.thresholds.orange;
      if (r.sources[0] !== undefined) e.source = r.sources[0];
      out.push(e);
    }
  }
  return out;
}

export const SEARCH_FROM_LETTERS = 2;
export const CAN_CRAFT_MAX = 6;
export const NOBODY_YET_MAX = 3;

/**
 * The search's two groups (RC02): "Can craft" (at most 6) and "Nobody yet" (at most 3), best quality first, then by
 * how well they match (`ranked` is in match order). Forever's own recipes without a known source are in neither
 * unless someone knows them.
 */
export function searchGroups(ranked: readonly SearchEntry[]): { canCraft: SearchEntry[]; nobodyYet: SearchEntry[] } {
  const order = new Map(ranked.map((e, i) => [e.id, i]));
  const sorted = [...ranked].sort(
    (a, b) => QUALITY_RANK[b.quality] - QUALITY_RANK[a.quality] || order.get(a.id)! - order.get(b.id)!,
  );
  return {
    canCraft: sorted.filter((e) => e.crafters.length > 0).slice(0, CAN_CRAFT_MAX),
    nobodyYet: sorted.filter((e) => e.crafters.length === 0 && e.nobody).slice(0, NOBODY_YET_MAX),
  };
}

/** What a tooltip needs of an item, keyed by ID: sent with a page or by `/api/items/<id>`. */
export interface TooltipItem {
  id: number;
  name?: string;
  quality?: number;
  icon?: string;
  data: ItemRecord;
  /** WEB-104: a recipe item's created item, shown under it as in game; undefined for any other item. */
  creates?: TooltipCreated;
  /** WEB-99: the item's set, shown under its own lines as in game; undefined for an item in none. */
  set?: TooltipSet;
}

/** WEB-99: an item set as the tooltip shows it (src/core/recipes/itemSets.ts). */
export interface TooltipSet {
  name: string;
  items: ItemSetPiece[];
  bonuses: ItemSetBonus[];
}

/** What a recipe item (pattern, plan, formula) makes, and what for: the game's tooltip under the recipe's. */
export interface TooltipCreated {
  item: TooltipItem;
  /** The reagents as the recipe drawer lists them (most first), with their names where the item data has one. */
  reagents: { id: number; name?: string; count: number }[];
}
