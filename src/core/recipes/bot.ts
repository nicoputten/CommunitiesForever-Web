// What the Discord bot gets about recipes (WEB-93, recipes handoff Part D, board RC08; docs/BOT-API.md "Recipes"):
// the `recipeFinds` event and the `/craft` look-ups. Pure: the database rows come in as arguments. Names only, never
// a BattleTag, never gold (handoff "Decisions"). The bot formats; the site decides what is a rare find.
import { professionInfo } from "../gamedata/professions";
import { professionSlug } from "../views/rosterQuery";
import { type Difficulty, difficulty } from "./skill";

/**
 * The game's item quality colours (the client's ITEM_QUALITY_COLORS, warcraft.wiki.gg "Quality"): 0 poor .. 6
 * artifact. Discord's colour bar takes the best item's (RC08).
 */
export const QUALITY_COLORS: readonly string[] = [
  "#9d9d9d",
  "#ffffff",
  "#1eff00",
  "#0070dd",
  "#a335ee",
  "#ff8000",
  "#e6cc80",
];

export function qualityColor(quality: number | null | undefined): string {
  return QUALITY_COLORS[quality ?? 1] ?? QUALITY_COLORS[1]!;
}

export interface BotItem {
  id: number;
  name: string;
  quality: number;
  qualityColor: string;
  /** The public icon (WEB-91), as a path on the site: `/api/item-icons/<name>.jpg`. */
  iconPath?: string;
}

export interface BotSource {
  kind: string;
  place?: string;
  npc?: string;
  quest?: string;
  faction?: string;
  rank?: string;
}

/** A recipe's rows as the server reads them. */
export interface RecipeRow {
  id: number;
  name: string | null;
  skillLineId: number | null;
  createdItemId: number | null;
  orange: number | null;
  yellow: number | null;
  green: number | null;
  grey: number | null;
}

export interface ItemRow {
  id: number;
  name: string | null;
  quality: number | null;
  iconName: string | null;
}

export interface SourceRow {
  kind: string;
  place: string | null;
  npc: string | null;
  quest: string | null;
  faction: string | null;
  rank: string | null;
}

export function iconPath(iconName: string | null | undefined): string | undefined {
  return iconName ? `/api/item-icons/${encodeURIComponent(iconName)}.jpg` : undefined;
}

/** The recipe's drawer on its profession page (handoff C4): `/professions/<slug>?recipe=<id>`. */
export function recipeUrl(skillLine: number | null | undefined, recipeId: number): string | undefined {
  if (skillLine === null || skillLine === undefined || professionInfo(skillLine) === undefined) return undefined;
  return `/professions/${professionSlug(String(skillLine))}?recipe=${recipeId}`;
}

/** The profession's name (src/core/gamedata/professions.ts). */
export function professionName(skillLine: number | null | undefined): string | undefined {
  return skillLine === null || skillLine === undefined ? undefined : professionInfo(skillLine)?.name;
}

/** What the recipe makes, for the bot: the item, else the recipe itself (an enchant) under the recipe's name. */
export function botItem(recipe: RecipeRow, item: ItemRow | undefined): BotItem | undefined {
  const name = item?.name ?? recipe.name;
  if (name === null || name === undefined) return undefined;
  const quality = item?.quality ?? 1;
  const out: BotItem = { id: item?.id ?? 0, name, quality, qualityColor: qualityColor(quality) };
  const path = iconPath(item?.iconName);
  if (path !== undefined) out.iconPath = path;
  return out;
}

export function botSource(s: SourceRow): BotSource {
  const out: BotSource = { kind: s.kind };
  for (const key of ["place", "npc", "quest", "faction", "rank"] as const) {
    const v = s[key];
    if (v !== null) out[key] = v;
  }
  return out;
}

/** A crafter's colour for a recipe (RC08's dots), from their skill in its profession. */
export function crafterDifficulty(recipe: RecipeRow, skill: number | undefined): Difficulty | undefined {
  if (recipe.orange === null || recipe.yellow === null || recipe.green === null || recipe.grey === null) {
    return undefined;
  }
  return difficulty(skill, { orange: recipe.orange, yellow: recipe.yellow, green: recipe.green, grey: recipe.grey });
}

/** The best (highest) quality's colour of a post with several finds (RC08: the colour bar). */
export function bestColor(items: readonly { quality: number }[]): string {
  return qualityColor(Math.max(1, ...items.map((i) => i.quality)));
}

export interface CraftableName {
  name: string;
  value: string;
}

/**
 * `/craft`'s autocomplete: what recipes make, matching `q` (any part, no case), names starting with it first, then
 * what someone can make, then by name; each name once (the recipe with crafters, else the first). At most 25.
 */
export function craftableNames(
  rows: readonly { recipeId: number; name: string; crafters: number }[],
  q: string,
  limit = 25,
): CraftableName[] {
  const wanted = q.trim().toLowerCase();
  const byName = new Map<string, { recipeId: number; name: string; crafters: number }>();
  for (const r of rows) {
    const key = r.name.toLowerCase();
    if (wanted !== "" && !key.includes(wanted)) continue;
    const was = byName.get(key);
    if (was === undefined || r.crafters > was.crafters || (r.crafters === was.crafters && r.recipeId < was.recipeId)) {
      byName.set(key, r);
    }
  }
  return [...byName.values()]
    .sort(
      (a, b) =>
        Number(b.name.toLowerCase().startsWith(wanted)) - Number(a.name.toLowerCase().startsWith(wanted)) ||
        Number(b.crafters > 0) - Number(a.crafters > 0) ||
        a.name.localeCompare(b.name, "en"),
    )
    .slice(0, limit)
    .map((r) => ({ name: r.name.slice(0, 100), value: String(r.recipeId) }));
}
