import type { Faction } from "../doomsday/rules";

// Pool version 6 (WEB-108): the view models the Mission pool page (WEB-109, boards MP05–MP07) and the Doomsday pages
// (WEB-110, boards DS01–DS02) read. WEB-108 fills them (src/core/doomsday/hunt.ts, src/core/doomsday/missionPool.ts,
// src/server/hunt.ts); the pages only render them. Every name here is display text from game data (never a
// BattleTag), every census number carries the census it came from. Types only, plus a few constants.

// --- the census (Everloot, CC BY-SA 4.0) ----------------------------------------------------------------------

/** Where every shown census number links, with its date (BRIEF 1.4). */
export const CENSUS_URL = "https://everloot.app/census";
export const CENSUS_LICENCE = "CC BY-SA 4.0";

/** The census the weights come from: Everloot's population counts (window: active in the last 7 days). */
export interface CensusInfo {
  /** When the site stored it (unix seconds). */
  at: number;
  /** Everloot's "data as of" (unix seconds); for an import, the import's time. */
  asOf: number;
  /** The window the counts cover (unix seconds), when Everloot names it: "active 4–10 Nov". */
  from?: number;
  to?: number;
  /** Characters and installs the census holds: "16,400 characters from 13 installs". */
  characters?: number;
  installs?: number;
  /** "everloot": the daily fetch; "import": the owner's manual JSON import. */
  source: "everloot" | "import";
  /** Everloot rounds counts to this (5): "numbers rounded to 5". */
  roundTo?: number;
  /** True when the last fetch failed and these are the last stored counts. */
  stale: boolean;
  url: typeof CENSUS_URL;
  licence: typeof CENSUS_LICENCE;
}

// --- Hunt targets ---------------------------------------------------------------------------------------------

/** A Hunt target: a race and class of the hunted faction, by game ids (ChrRaces / ChrClasses). */
export interface HuntTarget {
  /** "4:3": raceId:classId, unique over both factions (Skyborne has a race id per faction). */
  key: string;
  /** The faction the target belongs to (Horde hunts Alliance targets). */
  faction: Faction;
  raceId: number;
  classId: number;
  /** The race token ("NightElf", "Scourge", "Skyborne") and class token ("HUNTER"), as the addon writes them. */
  raceToken: string;
  classFile: string;
  /** "Night Elf", "Hunter", "Night Elf Hunter". */
  race: string;
  className: string;
  name: string;
}

/** In the draw (gold border), skipped (under 30 seen, dashed), off (the owner switched it off). */
export type HuntTargetState = "on" | "skipped" | "off";

/** One cell of the Hunt targets grid (MP06): a valid target with its census. */
export interface HuntTargetCell extends HuntTarget {
  /** Census count; undefined when Everloot has no count for it (unrecorded, never zero). */
  count?: number;
  /** count / census characters (0..1). */
  share?: number;
  /** Its weight / the faction's total weight in the draw (0..1): "x% of draws"; 0 when not in the draw. */
  drawShare: number;
  state: HuntTargetState;
  /** Under 1% of the census (p.rareQuarry, f.huntRare). */
  rare: boolean;
  /** Blue border: a race or race+class Forever added to Vanilla's list (Dwarf Shaman, Undead Paladin, Skyborne ...). */
  forever: boolean;
  /** Red ring: today's target. */
  today: boolean;
  /** The last day it was the quarry, before today. */
  lastHunted?: number;
  /** Of the friends who had it as their quarry, the share that bagged it (0..1); undefined if never drawn. */
  donePct?: number;
}

/** The Hunt targets box (MP06): one tab per hunted faction. */
export interface HuntTargetsView {
  census?: CensusInfo;
  /** Keyed by the hunted faction: Alliance = "Horde hunts · Alliance targets (28)". */
  factions: Record<Faction, HuntFactionTargets>;
}

export interface HuntFactionTargets {
  /** The faction that hunts these targets. */
  hunter: Faction;
  /** Rows: races in list order, each with its valid classes (9 columns; a class not listed is "—"). */
  races: { raceId: number; race: string; forever: boolean; cells: HuntTargetCell[] }[];
  /** Valid targets (28), and how many are in the draw now. */
  total: number;
  inDraw: number;
}

/** A day's Hunt per hunted faction (the calendar line, the 7-day strip, tomorrow's quarry). */
export interface HuntDay {
  n: number;
  /** Alliance = the target Horde characters hunt. */
  targets: Partial<Record<Faction, HuntTarget>>;
  /** Pinned in the day editor, per hunted faction. */
  pinned: Partial<Record<Faction, boolean>>;
  locked: boolean;
}

/** Today's quarry card (MP05 / DS01): one hunted faction. */
export interface QuarryView {
  n: number;
  target: HuntTarget;
  /** Points of the Hunt (+5 PvP). */
  points: number;
  /** "235 seen this week": the census count, with the census it came from. */
  seen?: number;
  census?: CensusInfo;
  /** "9% done today": friends who bagged it today / friends who hunt that faction (0..1). */
  doneToday?: number;
}

// --- Hunt kills and per-friend data (DS01, DS02) ---------------------------------------------------------------

/** One Hunt kill from an upload's feed (`hunts[]`, CF-118): the victim's race and class, when and where. */
export interface HuntKill {
  /** Person key (never shown). */
  owner: string;
  guid: string;
  /** The Doomsday day. */
  day: number;
  /** Unix seconds; undefined from an older addon. */
  at?: number;
  zone?: string;
  /** The victim as a target (ids when the addon sent them, else from the tokens). */
  target?: HuntTarget;
  /** It was that day's quarry for the killer's faction. */
  quarry: boolean;
}

/** "Grom · ⌖ 20:14 Ashenvale" in "The Hunt today" (DS01), or the board's Hunt cell (DS02). */
export interface HuntTodayFriend {
  owner: string;
  /** The first quarry kill today; undefined: "—". */
  kill?: HuntKill;
}

/** The Hunt today box (DS01): "1 of 12 bagged one". */
export interface HuntTodayView {
  n: number;
  /** Today's quarry per hunted faction. */
  quarry: Partial<Record<Faction, QuarryView>>;
  /** Tomorrow's quarry per hunted faction. */
  tomorrow: Partial<Record<Faction, HuntTarget>>;
  /** Friends with a quarry today, bagged first (by time), then the others. */
  friends: HuntTodayFriend[];
  bagged: number;
  total: number;
}

/** A trophy cell (DS02 "Hunt trophies"): one target of the other faction. */
export interface TrophyCell extends HuntTarget {
  /** How often the friend killed it (any day, quarry or not); 0 = "not yet". */
  count: number;
  /** The last day they killed it. */
  last?: number;
  /** Census count this week; undefined when unrecorded. */
  seen?: number;
  /** Blue ring: seen fewer than 60 this week. */
  scarce: boolean;
}

export interface TrophiesView {
  owner: string;
  /** The faction the friend hunts (the other faction's targets); a friend of both factions gets the Horde's view. */
  hunted: Faction;
  races: { raceId: number; race: string; cells: TrophyCell[] }[];
  /** "6 of 28 · 9 quarries": distinct targets killed, valid targets, quarry kills ever. */
  distinct: number;
  total: number;
  quarries: number;
  /** "Rarest: <target> (N seen this week)": the killed target with the lowest census count. */
  rarest?: { target: HuntTarget; seen: number };
  census?: CensusInfo;
}

/** "Hunt · this week" (DS02): friends ranked by days with the quarry bagged. */
export interface HuntWeekRow {
  owner: string;
  days: number;
}

// --- Hunt feats ------------------------------------------------------------------------------------------------

export type HuntFeatId = "f.huntFirst" | "f.hunt10" | "f.huntClasses" | "f.huntAll" | "f.huntRare" | "f.huntWeek";

/** A Hunt feat's progress for one friend (DS02 Feats tab: "a / b" and a bar while unfinished). */
export interface HuntFeatProgress {
  id: HuntFeatId;
  /** "First quarry", "Quarry ×10", "Every class", "Big game", "Rare quarry", "Hunter’s week". */
  name: string;
  /** "Bag your first Hunt target" ... */
  text: string;
  value: number;
  target: number;
  done: boolean;
  /** When it was reached (unix seconds, the kill's time; the day's start when the kill has no time). */
  at?: number;
  /** The kill that reached it ("Grom bagged a Skyborne Druid · Rare quarry"). */
  kill?: HuntKill;
}

/** Everything the Doomsday pages show of one friend's Hunt. */
export interface FriendHuntView {
  owner: string;
  /** The factions the friend hunts (by their characters' factions). */
  hunts: Faction[];
  todayDone: boolean;
  todayKill?: HuntKill;
  /** Quarry kills (bagged), newest first. */
  bagged: HuntKill[];
  trophies: TrophiesView;
  /** Days this week with the quarry bagged. */
  weekDays: number;
  feats: HuntFeatProgress[];
}

// --- the Mission pool page (MP05, MP07) -------------------------------------------------------------------------

/** Daily PvE themes (CF-118 `theme`); labels in THEME_LABEL (src/core/doomsday/rules.ts). */
export type Theme = "questing" | "loot" | "social" | "professions" | "exploration" | "combat";

/** A theme card (MP05 2.3): the six PvE themes, then Skirmish, Weekly, Bounty (the Duel pool shows under Skirmish). */
export interface ThemeCardView {
  id: Theme | "skirmish" | "duel" | "weekly" | "bounty";
  label: string;
  /** "Daily PvE", "PvP", "Weekly". */
  kind: "Daily PvE" | "PvP" | "Weekly";
  /** Missions in the pool (on and off). */
  count: number;
  off: number;
  /** "64 came up · 71% done". */
  cameUp: number;
  donePct?: number;
  /** "50 new": missions new in pool version 6 (Skirmish while new). */
  fresh: number;
  /** Mission ids in pool order. */
  missions: string[];
}

/** A recipe tile (MP05 2.1): Daily PvE, The Hunt, Daily PvP, Weekly, Bounty, Off. */
export interface RecipeTileView {
  id: "pve" | "hunt" | "pvp" | "weekly" | "bounty" | "off";
  label: string;
  /** Slots per day or week ("3 a day", "1 a week"); 0 for Off. */
  perPeriod: number;
  period: "day" | "week";
  /** Missions (or Hunt targets in the draw) in the pool. */
  pool: number;
  /** Back every ~N days: pool ÷ slots per day (weeks: × 7). */
  backEveryDays?: number;
  /** Orange: a weekly slot whose missions come back within ~6 weeks (Bounty today); never a daily one. */
  soon: boolean;
}

/** A day tile of the calendar (MP05 2.2), 6 lines: 3 PvE, the Hunt, Skirmish, Duel. */
export interface DayRecipeView {
  n: number;
  pve: string[];
  hunt: HuntDay;
  skirmish?: string;
  duel?: string;
  locked: boolean;
  changed: boolean;
}
