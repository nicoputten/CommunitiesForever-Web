import { MAX_LEVEL, RUNNABLE_DUNGEONS, type RunnableDungeon } from "../gamedata";
import type { Dataset } from "../model";
import { levelFit } from "../levelFit";
import { slotRole, type SlotRole } from "../runs";
import { DAY } from "./age";
import {
  byLevel,
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
  /** Part of the character's name, the owner's name or BattleTag, case-insensitive (WEB-21). */
  search?: string;
}

/**
 * `profession`: the skill in the filter's profession, or the best profession rank without one (WEB-21, Nico
 * 2026-10-26).
 */
export type RosterSort =
  | "lastPlayed"
  | "level"
  | "name"
  | "ilvl"
  | "class"
  | "role"
  | "player"
  | "profession"
  /** The main talent tree (roster-table, WEB-22). */
  | "talents"
  /** The zone the character was last seen in (roster-table, WEB-22). */
  | "seen";

export type SortDir = "asc" | "desc";

export interface RosterFriend {
  person: PersonView;
  /** Filtered and sorted. */
  characters: CharacterView[];
  /** All of the person's characters with a record, before the filter ("1 of 3 characters"). */
  total: number;
}

export interface DungeonBand {
  /** A dungeon or a wing that is one (Scarlet Monastery's, WEB-32). */
  dungeon: RunnableDungeon;
  /** Characters whose level is in the typical range (`levelFit` kind `fits`), by level. */
  fits: CharacterView[];
  /** WEB-45: tank and healer when none of `fits` plays it ("no healer in range"). */
  missing: SlotRole[];
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

/** Case-insensitive, accents count as their base letter ("lia" finds "Lía"). */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en");
}

function matches(c: CharacterView, filter: RosterFilter, now: number, battleTags: Map<string, string>): boolean {
  if (filter.person !== undefined && c.owner !== filter.person) return false;
  const search = filter.search === undefined ? "" : fold(filter.search.trim());
  if (search !== "") {
    const owner = c.owner === undefined ? undefined : battleTags.get(c.owner);
    if (![c.name, c.ownerName, owner].some((t) => t !== undefined && fold(t).includes(search))) return false;
  }
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

/** The skill the profession sort uses: in `skillLine`, or the best rank of any profession. */
function skill(c: CharacterView, skillLine: string | undefined): number | undefined {
  const ranks = c.professions.filter((p) => skillLine === undefined || p.skillLine === skillLine).map((p) => p.rank);
  return ranks.length === 0 ? undefined : Math.max(...ranks);
}

/** Each sort's value; missing values always sort last, in both directions. */
function sortValue(c: CharacterView, sort: RosterSort, profession: string | undefined): number | string | undefined {
  switch (sort) {
    case "lastPlayed":
      return c.lastPlayed;
    case "level":
      return c.level;
    case "name":
      return c.name;
    case "ilvl":
      return c.ilvl;
    case "class":
      // Race · class (roster-table): by class, then race.
      return c.className === undefined ? undefined : `${c.className}\u0000${c.raceName ?? ""}`;
    case "role":
      return c.role === undefined ? undefined : ROLE_ORDER[c.role];
    case "player":
      return c.ownerName;
    case "profession":
      return skill(c, profession);
    case "talents":
      return c.mainTreeName;
    case "seen":
      return c.sighting?.zoneText;
  }
}

/** Numbers and times high first; text, role and class A–Z (WEB-22, Nico 2026-10-26). */
export function defaultSortDir(sort: RosterSort): SortDir {
  return sort === "lastPlayed" || sort === "level" || sort === "ilvl" || sort === "profession" ? "desc" : "asc";
}

function sorter(sort: RosterSort, dir: SortDir, profession?: string): (a: CharacterView, b: CharacterView) => number {
  const key = (a: CharacterView, b: CharacterView): number => {
    const x = sortValue(a, sort, profession);
    const y = sortValue(b, sort, profession);
    if (x === y) return 0;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    const asc = typeof x === "number" && typeof y === "number" ? x - y : compareText(String(x), String(y));
    return dir === "asc" ? asc : -asc;
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
  for (const d of RUNNABLE_DUNGEONS) {
    // Only who fits: we recommend, never restrict (DESIGN.md §8, Nico 2026-10-28).
    const { min, max } = d.typicalLevels;
    const fits = characters.filter((c) => levelFit(c.level, min, max).kind === "fits").sort(byLevel);
    if (fits.length < 2) continue;
    const missing = (["tank", "healer"] as const).filter((role) => !fits.some((c) => slotRole(c.role) === role));
    bands.push({ dungeon: d, fits, missing });
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

export function roster(
  d: Dataset,
  now: number,
  options: { filter?: RosterFilter; sort?: RosterSort; dir?: SortDir } = {},
): Roster {
  const filter = options.filter ?? {};
  const sort = options.sort ?? "lastPlayed";
  const compare = sorter(sort, options.dir ?? defaultSortDir(sort), filter.profession);
  const people = peopleViews(d, now);
  const battleTags = new Map(people.flatMap((p) => (p.battleTag === undefined ? [] : [[p.key, p.battleTag]])));
  const all = recordCharacters(d, now);
  const shown = all.filter((c) => matches(c, filter, now, battleTags)).sort(compare);

  const friends: RosterFriend[] = [];
  for (const person of people) {
    if (!person.hasAddon) continue;
    const characters = shown.filter((c) => c.owner === person.key);
    const total = all.filter((c) => c.owner === person.key).length;
    if (characters.length > 0) friends.push({ person, characters, total });
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
