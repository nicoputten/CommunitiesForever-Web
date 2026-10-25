import { DUNGEONS, MAX_LEVEL, type DungeonInfo } from "../gamedata";
import type { Dataset } from "../model";
import { DAY } from "./age";
import {
  byLevel,
  compareDesc,
  compareText,
  peopleViews,
  recordCharacters,
  type CharacterView,
  type PersonView,
  type Role,
} from "./characters";

// The roster (boards `roster-cards`, `roster-table`): people with their characters, filtered and sorted; the level
// spread with dungeon bands; quick answers. Only characters with a record: a stub has no level, class or professions.
// The level spread and quick answers always cover the whole group; the filter narrows the lists.

export interface RosterFilter {
  classFiles?: readonly string[];
  roles?: readonly Role[];
  minLevel?: number;
  maxLevel?: number;
  /** Characters with this profession (skill line ID). */
  profession?: string;
  /** Characters played in the last N days. */
  playedWithinDays?: number;
  /** Only this person's characters (person key). */
  person?: string;
}

export type RosterSort = "lastPlayed" | "level" | "name" | "ilvl" | "class" | "role" | "player";

export interface RosterFriend {
  person: PersonView;
  /** Filtered and sorted. */
  characters: CharacterView[];
}

export interface DungeonBand {
  dungeon: Pick<DungeonInfo, "id" | "name" | "typicalLevels">;
  /** Characters whose level is in the typical range, by level. */
  fits: CharacterView[];
}

export interface LevelSpread {
  /** Every character with a level, lowest first (the dots on the 1–60 track). */
  characters: CharacterView[];
  /**
   * Dungeons (not raids) where at least two characters fit, by level range (decided by Nico, 2026-10-25). The ranges
   * are typical, not limits: label them so.
   */
  bands: DungeonBand[];
  /** The band with the most fits ("fits Scarlet Monastery (26–45) with ..."); ties: the narrower range. */
  best?: DungeonBand;
}

export interface QuickAnswers {
  healers: CharacterView[];
  tanks: CharacterView[];
  level30to40: CharacterView[];
  level60: CharacterView[];
}

export interface Roster {
  /** People who run the addon, the uploader first; only those with a character left after the filter. */
  friends: RosterFriend[];
  /** Friends without the addon ("Sanne has no addon yet"), by name. */
  noAddon: PersonView[];
  /** Every filtered character in one sorted list (the table). */
  characters: CharacterView[];
  /** "6 friends · 10 characters": everyone known, and every character with a record (unfiltered). */
  counts: { people: number; characters: number };
  spread: LevelSpread;
  quickAnswers: QuickAnswers;
}

function matches(c: CharacterView, filter: RosterFilter, now: number): boolean {
  if (filter.person !== undefined && c.owner !== filter.person) return false;
  if (filter.classFiles !== undefined && (c.classFile === undefined || !filter.classFiles.includes(c.classFile))) {
    return false;
  }
  if (filter.roles !== undefined && (c.role === undefined || !filter.roles.includes(c.role))) return false;
  if (filter.minLevel !== undefined && (c.level === undefined || c.level < filter.minLevel)) return false;
  if (filter.maxLevel !== undefined && (c.level === undefined || c.level > filter.maxLevel)) return false;
  if (filter.profession !== undefined && !c.professions.some((p) => p.skillLine === filter.profession)) return false;
  if (
    filter.playedWithinDays !== undefined &&
    (c.lastPlayed === undefined || now - c.lastPlayed > filter.playedWithinDays * DAY)
  ) {
    return false;
  }
  return true;
}

const ROLE_ORDER: Record<Role, number> = { tank: 0, heal: 1, dps: 2 };
const roleRank = (c: CharacterView) => (c.role !== undefined ? ROLE_ORDER[c.role] : 3);

function sorter(sort: RosterSort): (a: CharacterView, b: CharacterView) => number {
  const key = (a: CharacterView, b: CharacterView): number => {
    switch (sort) {
      case "lastPlayed":
        return compareDesc(a.lastPlayed, b.lastPlayed);
      case "level":
        return compareDesc(a.level, b.level);
      case "name":
        return compareText(a.name, b.name);
      case "ilvl":
        return compareDesc(a.ilvl, b.ilvl);
      case "class":
        return compareText(a.className, b.className);
      case "role":
        return roleRank(a) - roleRank(b);
      case "player":
        return compareText(a.ownerName, b.ownerName);
    }
  };
  return (a, b) => key(a, b) || byLevel(a, b);
}

/** Characters whose level is within a range. */
function inRange(characters: readonly CharacterView[], min: number, max: number): CharacterView[] {
  return characters.filter((c) => c.level !== undefined && c.level >= min && c.level <= max).sort(byLevel);
}

const width = (b: DungeonBand) => b.dungeon.typicalLevels.max - b.dungeon.typicalLevels.min;

export function levelSpread(characters: readonly CharacterView[]): LevelSpread {
  const bands: DungeonBand[] = [];
  for (const d of DUNGEONS) {
    if (d.kind !== "dungeon") continue;
    const fits = inRange(characters, d.typicalLevels.min, d.typicalLevels.max);
    if (fits.length >= 2) bands.push({ dungeon: { id: d.id, name: d.name, typicalLevels: d.typicalLevels }, fits });
  }
  bands.sort(
    (a, b) =>
      a.dungeon.typicalLevels.min - b.dungeon.typicalLevels.min ||
      a.dungeon.typicalLevels.max - b.dungeon.typicalLevels.max ||
      compareText(a.dungeon.name, b.dungeon.name),
  );
  let best: DungeonBand | undefined;
  for (const band of bands) {
    if (best === undefined || band.fits.length > best.fits.length) best = band;
    else if (band.fits.length === best.fits.length && width(band) < width(best)) best = band;
  }
  const spread: LevelSpread = {
    characters: characters
      .filter((c) => c.level !== undefined)
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || compareText(a.name, b.name) || compareText(a.guid, b.guid)),
    bands,
  };
  if (best !== undefined) spread.best = best;
  return spread;
}

export function quickAnswers(characters: readonly CharacterView[]): QuickAnswers {
  return {
    healers: characters.filter((c) => c.role === "heal").sort(byLevel),
    tanks: characters.filter((c) => c.role === "tank").sort(byLevel),
    level30to40: inRange(characters, 30, 40),
    level60: inRange(characters, MAX_LEVEL, MAX_LEVEL),
  };
}

export function roster(d: Dataset, now: number, options: { filter?: RosterFilter; sort?: RosterSort } = {}): Roster {
  const filter = options.filter ?? {};
  const compare = sorter(options.sort ?? "lastPlayed");
  const people = peopleViews(d, now);
  const all = recordCharacters(d, now);
  const shown = all.filter((c) => matches(c, filter, now)).sort(compare);

  const friends: RosterFriend[] = [];
  for (const person of people) {
    if (!person.hasAddon) continue;
    const characters = shown.filter((c) => c.owner === person.key);
    if (characters.length > 0) friends.push({ person, characters });
  }
  return {
    friends,
    noAddon: people
      .filter((p) => !p.hasAddon && !p.isUploader)
      .sort((a, b) => compareText(a.displayName, b.displayName) || compareText(a.key, b.key)),
    characters: shown,
    counts: { people: people.length, characters: all.length },
    spread: levelSpread(all),
    quickAnswers: quickAnswers(all),
  };
}
