import { sameBattleTag } from "../access";
import { classInfo, PROFESSIONS, type ClassFile } from "../gamedata";
import { itemQuality, type ItemQuality } from "../gamedata/items";
import { chanceText, lootTypeText, RECIPE_CLASS, RECIPE_LINES, type LootDrop } from "../loot";
import { itemFallbackName } from "./itemTooltip";
import { compareDesc, compareText, type CharacterView } from "./characters";
import { professionSlug } from "./rosterQuery";
import { UNKNOWN_CHARACTER } from "./text";

// The dungeon page's Bosses & loot (WEB-102, board DL04): every boss open, in the client's order, with its own drops
// (the item import, WEB-96: >= 1 % plus its quest items and recipes, highest chance first), at most LOOT_SHOWN before
// "Show N more"; "Usable by [character]" dims or hides what that class can never use (src/core/loot.ts; the switch is
// the page's, so the drop keeps the fields the rule reads); a recipe nobody in the group knows says so, with who has
// the profession. Pure: the bosses, the group's characters, their known recipes and professions come in.

/** Drops per boss before "Show N more" (counted after the Usable switch). */
export const LOOT_SHOWN = 6;

export interface DropInput extends LootDrop {
  itemId: number;
  chance: number;
  recipeId?: number;
  /** A recipe drop: the skill to learn it and its profession's skill line (WEB-96's follow-up). */
  skill?: number;
  line?: number;
  name: string | null;
  quality: number | null;
  iconName: string | null;
  /** The item database's inventory type, for the type line; undefined when it has no tooltip data. */
  inventoryType?: number;
}

export interface BossInput {
  id: number;
  name: string;
  final: boolean;
  optional: boolean;
  wingId?: string;
  drops: readonly DropInput[];
}

export interface RecipeLearner {
  guid: string;
  name: string;
  colorToken?: string;
  /** "Cooking 150". */
  skill: string;
}

export interface LootRow {
  itemId: number;
  name: string;
  quality: ItemQuality;
  icon?: string;
  /** "Two-Hand · Mace", "Quest item", "Recipe · Cooking". */
  type: string;
  /** "77%", "<1%". */
  chance: string;
  /** The usable rule's fields (src/core/loot.ts), applied on the page for the picked character. */
  drop: LootDrop;
  /** A quest-only drop: the Quest tag. */
  quest: boolean;
  /**
   * A recipe drop: its drawer, "Requires Cooking (75)", and the "Nobody knows it" tag with who could learn it (has the
   * profession at the skill it needs, or any skill when the data doesn't say).
   */
  recipe?: { href?: string; requires?: string; known: boolean; canLearn: RecipeLearner[] };
}

export interface BossSection {
  id: number;
  /** 1, 2, 3 in the client's order. */
  n: number;
  name: string;
  optional: boolean;
  /** The jump list's target. */
  anchor: string;
  rows: LootRow[];
}

export interface LootCharacter {
  guid: string;
  name: string;
  classFile?: ClassFile;
  colorToken?: string;
}

export interface BossesLoot {
  bosses: BossSection[];
  /** Your characters for "Usable by", most recently played first; the first is the default. */
  characters: LootCharacter[];
}

export interface KnownRecipe {
  guid: string;
  recipeId: number;
}

export interface CharacterSkill {
  guid: string;
  skillLineId: number;
  skill?: number | null;
}

export interface BossesLootInput {
  bosses: readonly BossInput[];
  /** The group's characters (recordCharacters). */
  characters: readonly CharacterView[];
  viewer: string;
  known: readonly KnownRecipe[];
  professions: readonly CharacterSkill[];
}

const recipeLine = (drop: DropInput) => drop.line ?? RECIPE_LINES[drop.subclassId ?? -1];

function learners(drop: DropInput, input: BossesLootInput, byGuid: Map<string, CharacterView>): RecipeLearner[] {
  const line = recipeLine(drop);
  if (line === undefined) return [];
  const profession = PROFESSIONS[line]?.name ?? "";
  return input.professions
    .filter((p) => p.skillLineId === line && byGuid.has(p.guid))
    .filter((p) => drop.skill === undefined || (p.skill ?? 0) >= drop.skill)
    .map((p) => {
      const c = byGuid.get(p.guid)!;
      const l: RecipeLearner = {
        guid: p.guid,
        name: c.name ?? UNKNOWN_CHARACTER,
        skill: p.skill == null ? profession : `${profession} ${p.skill}`,
      };
      const token = classInfo(c.classFile)?.textToken;
      if (token !== undefined) l.colorToken = token;
      return { l, skill: p.skill ?? 0 };
    })
    .sort((a, b) => b.skill - a.skill || compareText(a.l.name, b.l.name))
    .map((x) => x.l);
}

function lootRow(drop: DropInput, input: BossesLootInput, byGuid: Map<string, CharacterView>): LootRow {
  const rule: LootDrop = {};
  if (drop.classId !== undefined) rule.classId = drop.classId;
  if (drop.subclassId !== undefined) rule.subclassId = drop.subclassId;
  if (drop.classes !== undefined) rule.classes = drop.classes;
  if (drop.questId !== undefined) rule.questId = drop.questId;
  const row: LootRow = {
    itemId: drop.itemId,
    name: drop.name ?? itemFallbackName(drop.itemId),
    quality: itemQuality(drop.quality ?? undefined),
    type: lootTypeText(drop, drop.inventoryType),
    chance: chanceText(drop.chance),
    drop: rule,
    quest: drop.questId !== undefined,
  };
  if (drop.iconName !== null) row.icon = drop.iconName;
  if (drop.classId === RECIPE_CLASS || drop.recipeId !== undefined) {
    const line = recipeLine(drop);
    const known =
      drop.recipeId !== undefined && input.known.some((k) => k.recipeId === drop.recipeId && byGuid.has(k.guid));
    row.recipe = { known, canLearn: known ? [] : learners(drop, input, byGuid) };
    const profession = line === undefined ? undefined : PROFESSIONS[line]?.name;
    if (profession !== undefined && drop.skill !== undefined)
      row.recipe.requires = `Requires ${profession} (${drop.skill})`;
    if (line !== undefined && drop.recipeId !== undefined)
      row.recipe.href = `/professions/${encodeURIComponent(professionSlug(String(line)))}?recipe=${drop.recipeId}`;
  }
  return row;
}

/** The Bosses & loot box of a dungeon page; no bosses before the first item import with bosses (WEB-96). */
export function bossesLoot(input: BossesLootInput): BossesLoot {
  const byGuid = new Map(input.characters.filter((c) => c.hasRecord).map((c) => [c.guid, c]));
  const bosses = input.bosses.map((b, i) => ({
    id: b.id,
    n: i + 1,
    name: b.name,
    optional: b.optional,
    anchor: `boss-${b.id}`,
    rows: b.drops.map((d) => lootRow(d, input, byGuid)),
  }));
  const characters = input.characters
    .filter((c) => c.hasRecord && c.owner !== undefined && sameBattleTag(c.owner, input.viewer))
    .sort(
      (a, b) =>
        compareDesc(a.lastPlayed ?? a.updatedAt, b.lastPlayed ?? b.updatedAt) ||
        compareText(a.name, b.name) ||
        compareText(a.guid, b.guid),
    )
    .map((c) => {
      const v: LootCharacter = { guid: c.guid, name: c.name ?? UNKNOWN_CHARACTER };
      if (c.classFile !== undefined) v.classFile = c.classFile;
      const token = classInfo(c.classFile)?.textToken;
      if (token !== undefined) v.colorToken = token;
      return v;
    });
  return { bosses, characters };
}
