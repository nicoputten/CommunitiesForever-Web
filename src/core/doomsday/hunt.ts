import type { ClassFile } from "../gamedata/classes";
import type { Faction } from "../gamedata/races";

// The Hunt from pool version 6 (WEB-110; the pool-6 contract of addon CF-118 and site WEB-108..110): targets are a race
// id and a class id (ChrRaces / ChrClasses, as UnitRace's and UnitClass's third values give them), keyed by the
// HUNTED faction: Horde characters hunt `Alliance` targets. Facts only; src/core/views/doomsdayHunt.ts turns them into
// text. Pure: no I/O.

/** A Hunt target: race id + class id. */
export interface HuntTarget {
  race: number;
  class: number;
}

/** Today's or tomorrow's quarry per hunted faction. */
export type HuntPair = Partial<Record<Faction, HuntTarget>>;

/** One bagged quarry: a friend killed the day's target (the addon's `hunts` entry, or the Hunt goal done). */
export interface HuntKill {
  /** Doomsday day number. */
  day: number;
  /** Epoch seconds. */
  at: number;
  /** The zone text of the kill (addon CF-118); undefined from older addons. */
  zone?: string;
  race: number;
  class: number;
}

/**
 * Everloot's census (https://everloot.app/census, CC BY-SA 4.0): characters seen active in the last 7 days by race and
 * class (WEB-108 fetches and stores it). A sample of the realm, a weight, never a guarantee.
 */
export interface HuntCensus {
  /** When the counts were taken (epoch seconds): the end of the 7-day window. */
  at: number;
  /** Characters in the sample. */
  characters: number;
  /** Seen this week per target, keyed `targetKey`. A target missing here is unknown, never 0. */
  counts: Readonly<Record<string, number>>;
}

/** Everloot's census page, linked wherever a census number shows. */
export const CENSUS_URL = "https://everloot.app/census";

/** "4:3": a target's key in census counts and the schedule's `rare` list (pool-6 contract). */
export function targetKey(t: HuntTarget): string {
  return `${t.race}:${t.class}`;
}

/** The faction a target belongs to: the one Horde or Alliance characters hunt. */
export function huntedBy(hunted: Faction): Faction {
  return hunted === "Alliance" ? "Horde" : "Alliance";
}

/**
 * Class ids by classFile. Source: the client's ChrClasses table (warcraft.wiki.gg "ClassId",
 * https://warcraft.wiki.gg/wiki/ClassId), as the pool-6 contract lists them.
 */
export const CLASS_IDS: Readonly<Record<ClassFile, number>> = {
  WARRIOR: 1,
  PALADIN: 2,
  HUNTER: 3,
  ROGUE: 4,
  PRIEST: 5,
  SHAMAN: 7,
  MAGE: 8,
  WARLOCK: 9,
  DRUID: 11,
};

/** The classFile of a class id; undefined for an unknown one. */
export function classFileOf(id: number): ClassFile | undefined {
  return (Object.keys(CLASS_IDS) as ClassFile[]).find((c) => CLASS_IDS[c] === id);
}

/** The trophy grid's columns: the 9 classes in the game's order (boards DS02HuntMore, MP06Hunt). */
export const HUNT_CLASSES: readonly number[] = [1, 2, 3, 4, 5, 7, 8, 9, 11];

/**
 * Race ids by UnitRace's token (its second value; "Scourge" is the Undead's). Source: the client's ChrRaces table
 * (warcraft.wiki.gg "RaceId", https://warcraft.wiki.gg/wiki/RaceId), as src/core/gamedata/races.ts lists them. The
 * Skyborne tokens are not known yet (the addon's probe records them, CF-118): their kills come with ids.
 */
export const RACE_IDS: Readonly<Record<string, number>> = {
  Human: 1,
  Orc: 2,
  Dwarf: 3,
  NightElf: 4,
  Scourge: 5,
  Tauren: 6,
  Gnome: 7,
  Troll: 8,
};

/** A target from the tokens the rules' combinations use ("NightElf", "HUNTER"); undefined when one is unknown. */
export function targetOfTokens(race: string, classFile: string): HuntTarget | undefined {
  const r = RACE_IDS[race];
  const c = (CLASS_IDS as Record<string, number>)[classFile];
  return r === undefined || c === undefined ? undefined : { race: r, class: c };
}

/**
 * The valid Hunt targets of each hunted faction from pool version 6: every playable race and class of that faction,
 * Skyborne and Forever's own combinations included, 28 each. Source: the game files of build 1.60.1.70862 via Everloot
 * `class_races`, as the pool-6 contract (addon CF-118) lists them; docs/WOW-FOREVER.md "Races".
 */
export const HUNT_TARGETS: Readonly<Record<Faction, readonly { race: number; classes: readonly number[] }[]>> = {
  Alliance: [
    { race: 1, classes: [1, 2, 3, 4, 5, 8, 9] },
    { race: 3, classes: [1, 2, 3, 4, 5, 7] },
    { race: 4, classes: [1, 3, 4, 5, 11] },
    { race: 7, classes: [1, 4, 5, 8, 9] },
    { race: 95, classes: [1, 3, 4, 8, 11] },
  ],
  Horde: [
    { race: 2, classes: [1, 3, 4, 7, 8, 9] },
    { race: 5, classes: [1, 2, 4, 5, 8, 9] },
    { race: 6, classes: [1, 3, 7, 11] },
    { race: 8, classes: [1, 3, 4, 5, 7, 8, 9] },
    { race: 96, classes: [1, 3, 4, 7, 11] },
  ],
};

/** Every valid target of a hunted faction, in list order. */
export function huntTargets(hunted: Faction): HuntTarget[] {
  return HUNT_TARGETS[hunted].flatMap((r) => r.classes.map((c) => ({ race: r.race, class: c })));
}

/** Whether a target is one of the hunted faction's valid targets. */
export function isHuntTarget(hunted: Faction, t: HuntTarget): boolean {
  return HUNT_TARGETS[hunted].some((r) => r.race === t.race && r.classes.includes(t.class));
}

/** The faction whose targets a race belongs to; undefined for an unknown race. */
export function factionOfRace(race: number): Faction | undefined {
  return (["Alliance", "Horde"] as const).find((f) => HUNT_TARGETS[f].some((r) => r.race === race));
}
