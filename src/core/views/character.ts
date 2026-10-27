import { DUNGEONS, MAX_LEVEL, MAX_TREE_POINTS, talentPointsAt, type DungeonInfo } from "../gamedata";
import type { Dataset } from "../model";
import { own } from "../people";
import {
  byLevel,
  characterView,
  compareText,
  personView,
  recordCharacters,
  shownCharacters,
  type CharacterView,
  type PersonView,
} from "./characters";

// The character detail page (board `character`).

export interface TalentBar {
  name?: string;
  points: number;
  /** points / 31, at most 1: bars are out of 31, the deepest a tree goes. */
  fill: number;
  main: boolean;
}

export interface DungeonFit {
  dungeon: Pick<DungeonInfo, "id" | "name" | "typicalLevels">;
  /** Other friends' characters in the range (not the owner's own alts, any data age), by level. */
  with: CharacterView[];
}

export interface CharacterPage {
  character: CharacterView;
  /** The owner; undefined for a GUID nobody owns. */
  person?: PersonView;
  /** "N levels to 60"; 0 at 60, undefined without a level. */
  levelsToMax?: number;
  talents: {
    /** level − 9; undefined without a level. */
    available?: number;
    /** Points in the trees the addon recorded. */
    spent: number;
    /** One bar per tree, in game order. */
    trees: TalentBar[];
    /** From mainTree, an index into the trees. */
    mainTreeName?: string;
    maxTreePoints: number;
  };
  /**
   * The dungeon to suggest: of the dungeons (not raids) whose typical range holds the character's level, the one
   * with the most of the group in range too; ties: the narrower range (decided by Nico, 2026-10-25).
   * Undefined when nobody else fits any of them.
   */
  dungeonFit?: DungeonFit;
  /** Others last seen in the same zone text ("Lia is here too"), newest sighting first. */
  sameZone: CharacterView[];
  /** The owner's other characters, by level. */
  otherCharacters: CharacterView[];
}

function talents(c: CharacterView, mainTree: number | undefined): CharacterPage["talents"] {
  const trees: TalentBar[] = c.talents.map((t) => {
    const points = t.points ?? 0;
    const bar: TalentBar = { points, fill: Math.min(1, points / MAX_TREE_POINTS), main: false };
    if (t.name !== undefined) bar.name = t.name;
    return bar;
  });
  const result: CharacterPage["talents"] = {
    spent: trees.reduce((sum, t) => sum + t.points, 0),
    trees,
    maxTreePoints: MAX_TREE_POINTS,
  };
  if (c.level !== undefined) result.available = talentPointsAt(c.level);
  if (c.mainTreeName !== undefined) result.mainTreeName = c.mainTreeName;
  const main = mainTree !== undefined ? trees[mainTree - 1] : undefined;
  if (main !== undefined) main.main = true;
  return result;
}

function dungeonFit(c: CharacterView, group: readonly CharacterView[]): DungeonFit | undefined {
  const level = c.level;
  if (level === undefined) return undefined;
  const others = group.filter((o) => o.guid !== c.guid && (c.owner === undefined || o.owner !== c.owner));
  let best: DungeonFit | undefined;
  for (const d of DUNGEONS) {
    const { min, max } = d.typicalLevels;
    if (d.kind !== "dungeon" || level < min || level > max) continue;
    const fit = others.filter((o) => o.level !== undefined && o.level >= min && o.level <= max).sort(byLevel);
    if (fit.length === 0) continue;
    const candidate: DungeonFit = { dungeon: { id: d.id, name: d.name, typicalLevels: d.typicalLevels }, with: fit };
    if (best === undefined || fit.length > best.with.length) best = candidate;
    else if (fit.length === best.with.length && max - min < width(best)) best = candidate;
  }
  return best;
}

const width = (f: DungeonFit) => f.dungeon.typicalLevels.max - f.dungeon.typicalLevels.min;

/** The page of one character by GUID; undefined for a GUID without a record. */
export function characterPage(d: Dataset, guid: string, now: number): CharacterPage | undefined {
  const record = own(d.characters, guid);
  if (record === undefined || !record.hasRecord) return undefined;
  const character = characterView(d, record, now);
  const owner = own(d.people, record.owner);
  const group = recordCharacters(d, now);

  const zone = character.sighting?.zoneText;
  const sameZone =
    zone === undefined
      ? []
      : shownCharacters(d, now)
          .filter((o) => o.guid !== guid && o.sighting?.zoneText === zone)
          .sort(
            (a, b) =>
              (b.sighting?.seenAt ?? 0) - (a.sighting?.seenAt ?? 0) ||
              compareText(a.name, b.name) ||
              compareText(a.guid, b.guid),
          );

  const page: CharacterPage = {
    character,
    talents: talents(character, record.mainTree),
    sameZone,
    otherCharacters:
      record.owner === undefined ? [] : group.filter((o) => o.owner === record.owner && o.guid !== guid).sort(byLevel),
  };
  if (owner !== undefined) page.person = personView(d, owner, now);
  if (character.level !== undefined) page.levelsToMax = Math.max(0, MAX_LEVEL - character.level);
  const fit = dungeonFit(character, group);
  if (fit !== undefined) page.dungeonFit = fit;
  return page;
}

/** What a "here too" line calls a character: its full name, or whose it is for a friend without the addon. */
function hereName(c: CharacterView): string {
  if (c.name !== undefined) return c.name;
  return c.ownerName === undefined ? "Someone" : `${c.ownerName}'s character`;
}

/**
 * "Lia Thornwhisper is here too" / "A and B are here too" / "A, B and C are here too" / "A, B and 2 others are here
 * too" (decided with Nico for WEB-23); undefined when nobody else is.
 */
export function hereToo(sameZone: readonly CharacterView[]): string | undefined {
  const names = sameZone.map(hereName);
  const [a, b, c] = names;
  if (a === undefined) return undefined;
  if (b === undefined) return `${a} is here too`;
  if (names.length === 2) return `${a} and ${b} are here too`;
  if (names.length === 3) return `${a}, ${b} and ${c} are here too`;
  return `${a}, ${b} and ${names.length - 2} others are here too`;
}
