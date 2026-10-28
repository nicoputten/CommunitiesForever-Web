import type { FeedDay } from "../feed";

// The weekly recap's input and output (WEB-41; the catalogue, rotation and examples: the bot repo's `bot-recap`
// board). The server (WEB-41c) gathers a week's facts into a `Week`; the cards, the rotation and the texts are pure
// functions of it and of the `History` of earlier recaps, so a re-run gives the same recap.

/** A character as the recap sees it, at one moment (the start or the end of the week). */
export interface RecapChar {
  guid: string;
  /** Person key of the owner. */
  owner: string;
  /** The full character name (never split, CLAUDE.md rule 3). */
  name: string;
  classFile?: string;
  /** "Undead", "Troll", … */
  race?: string;
  faction?: string;
  level?: number;
  ilvl?: number;
  /** Primary and secondary professions with their rank and current cap. */
  professions: { name: string; rank: number; max: number }[];
  /** Main talent tree ("Frost"). */
  spec?: string;
  /** tank, heal or dps. */
  role?: string;
  /** Quest IDs in the quest log. */
  quests: string[];
}

export interface RecapFriend {
  /** Person key. */
  key: string;
  /** Display name (never a BattleTag). */
  name: string;
  /** "Share my activity" on (CF-22): only then does the feed tell what they did. */
  shares: boolean;
}

export interface WeekSighting {
  guid: string;
  zone: string;
  seenAt: number;
}

export interface Week {
  /** 1 for the first recap after launch (Nico, 2026-10-27). */
  number: number;
  /** Unix seconds, `[start, end)`. */
  start: number;
  end: number;
  /** The site name from the data ("Doombringers"): "<site> of the week", "First <site> in …". */
  siteName: string;
  friends: RecapFriend[];
  /** The characters at the start of the week (the previous recap's snapshot; empty in week 1) and at its end. */
  before: Record<string, RecapChar>;
  after: Record<string, RecapChar>;
  /** The feed days of the week, of friends who share. */
  days: { day: number; guid: string; owner: string; entry: FeedDay }[];
  /** Sightings of the week. */
  sightings: WeekSighting[];
  /** Zones anyone was ever seen in before the week. */
  zonesBefore: string[];
  /** Zones on the map ("31 of 39"). */
  totalZones: number;
  /** The latest sighting of each character, ever (Ghost town). */
  lastSeen: Record<string, WeekSighting>;
  /** Sightings four weeks earlier, the same weekday window (On this week last month). */
  monthAgo: WeekSighting[];
  /** Per friend: their last activity before the week, Unix seconds (The Comeback). */
  lastActiveBefore: Record<string, number>;
}

/** One earlier recap, as much as the next ones need. */
export interface PastWeek {
  number: number;
  /** Rotating card ids shown (cooldown). */
  cards: string[];
  /** The award card id and its winner. */
  award?: { card: string; friend: string };
  headline?: string;
  challenge?: string;
  /** Each card's main value that week, for scores relative to earlier weeks. */
  values: Record<string, number>;
  /** Levels gained per friend (Hall of fame, Season stats). */
  levelsByFriend: Record<string, number>;
  /** A prediction made that week (Prediction check, four weeks later). */
  prediction?: { guid: string; name: string; level: number; weeks: number };
  /** Totals of week 1 (Then vs now). */
  totals?: { characters: number; levelSum: number; at60: number };
}

/** Where each phrasing cycle stands (a phrasing comes back only after all of its card's phrasings were used). */
export type Cycles = Record<string, { order: number[]; next: number }>;

export interface History {
  weeks: PastWeek[];
  cycles: Cycles;
}

export type Slot = "award" | "stat" | "progress" | "social" | "fun";

/** What a card found in the week: its score, the facts its texts use and the friends it is about. */
export interface Candidate {
  score: number;
  /** The card's main value (for scores relative to earlier weeks). */
  value: number;
  facts: Record<string, string | number>;
  friends: string[];
}

export interface CardDef {
  /** Catalogue id: A1 … F13. */
  id: string;
  slot: Slot;
  /** Board name ("The Grinder"). */
  name: string;
  find: (week: Week, history: History) => Candidate | undefined;
}

/** A recap card as posted: its texts filled in. */
export interface RecapCard {
  id: string;
  slot: Slot;
  name: string;
  title: string;
  text: string;
  facts: Record<string, string | number>;
  friends: string[];
}

export interface Recap {
  week: number;
  start: number;
  end: number;
  quiet: boolean;
  headline: { id: string; text: string };
  numbers: { levels: number; friendsPlayed: number; runs: number; newCharacters: number };
  award?: RecapCard;
  cards: RecapCard[];
  challenge: { id: string; text: string };
  closing: string;
  /** What the next recaps need from this one; stored with it (WEB-41c). */
  past: PastWeek;
  cycles: Cycles;
}
