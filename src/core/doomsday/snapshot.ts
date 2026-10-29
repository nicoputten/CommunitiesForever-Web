// Doomsday for the whole group at one moment (E8; the addon repo's docs/DOOMSDAY.md): what the engine (WEB-58, feats
// WEB-56) gives the screens (WEB-59..61) and the bot's look-up. Facts only: ids, numbers, epoch seconds, flags and the
// catalogue's titles. The screens' views (src/core/views/doomsday.ts) turn them into text. Every part a friend's data
// may lack is optional: a missing value shows nothing, never 0 as if known.

export type Track = "pve" | "pvp";

export interface Points {
  pve: number;
  pvp: number;
}

export interface DoomsdaySnapshot {
  now: number;
  schedule: DoomsdaySchedule;
  /** Today's draw as the board's columns, before per-friend swaps: the 3 PvE dailies, then the Skirmish. */
  todayGoals: GoalRef[];
  /** The Hunt per enemy faction: Horde characters hunt `alliance`, Alliance characters `horde`. */
  hunts: { alliance?: GoalRef; horde?: GoalRef };
  /** This week's draw: the 3 PvE weeklies, then the Weekly bounty. */
  weekGoals: GoalRef[];
  /** Every friend of the community, also those without the addon or without Doomsday data. */
  friends: FriendDoomsday[];
  /** The first friend to finish the 3 PvE dailies today. No points (version B). */
  crown?: { friendKey: string; at: number };
  ladders: { week: TrackLadders; allTime: TrackLadders };
  /** Every feat the site holds (WEB-56), newest first. */
  feats: FeatRecord[];
}

export interface DoomsdaySchedule {
  /** The realm's IANA zone (setting, default Europe/Paris). */
  timeZone: string;
  /** The reset in seconds after realm midnight: 68400 = 19:00. */
  resetSeconds: number;
  /** Doomsday day number n (day 0 started on Thursday 1970-01-01). */
  day: number;
  /** Today's reset, epoch seconds. */
  dayStart: number;
  nextReset: number;
  week: number;
  /** The next Sunday reset, epoch seconds. */
  weekReset: number;
}

export type GoalSlot = "pveDaily" | "hunt" | "skirmish" | "pveWeekly" | "bounty";

export interface GoalRef {
  /** Catalogue id ("d.quests10", "p.loneWolf", "hunt:NightElf:DRUID"); never reused. */
  id: string;
  track: Track;
  slot: GoalSlot;
  /** The catalogue's title; an unknown id gets "A goal from a newer version" and still counts. */
  title: string;
  known: boolean;
}

export type FriendStatus =
  /** Has Doomsday data (`goals` records). */
  | "active"
  /** Has the addon, but no `goals` yet (an addon before CF-56). */
  | "noDoomsday"
  /** Known only through presence. */
  | "noAddon";

export interface FriendDoomsday {
  /** PersonView.key; never shown. */
  friendKey: string;
  /** The display name. */
  name: string;
  status: FriendStatus;
  /** "active" only from here on. */
  today?: FriendDay;
  week?: FriendWeek;
  points?: { today: Points; week: Points; allTime: Points; approx?: { pvp: boolean } };
  streak?: { current: number; best: number };
  /** No PvP point (duels included) and no honorable kill on any character, ever: shown, never ranked on PvP. */
  pvpVirgin: boolean;
  /** 84 Doomsday days, oldest first, ending today: goals done that day (either track); null = no data that day. */
  heatmap?: (number | null)[];
  pvp?: PvpDetails;
  /** The next step of the counted feats (honorKills, duelWins, deaths100, the next pvpRank; WEB-56). */
  featProgress?: FeatProgress[];
}

export interface FriendDay {
  /** In board order: the 3 PvE dailies, the Hunt (one per faction the friend has), the Skirmish. */
  goals: FriendGoal[];
  /** All 3 PvE dailies done: the name is crossed out. */
  finishedAt?: number;
  duels: DuelSlot;
}

export interface FriendWeek {
  /** The 3 PvE weeklies, then the Weekly bounty. */
  goals: FriendGoal[];
}

export interface FriendGoal {
  /** The goal that counts for this friend (after a swap). */
  goal: GoalRef;
  /** The board column it fills: the group's goal id (todayGoals or weekGoals), or "hunt:alliance" / "hunt:horde". */
  columnId: string;
  /** The group's goal it replaced, for this friend only. */
  swappedFrom?: GoalRef;
  doneAt?: number;
  /** When the site can tell; undefined = unknown (nothing shown). */
  progress?: { value: number; target: number; approx?: boolean; /** "Deadmines" (WEB-66). */ detail?: string };
  /** What it is worth: 5 a daily, 15 a weekly. */
  points: number;
}

export interface DuelSlot {
  /** The first duel of the day with each friend; a disputed one counts for neither. */
  first: { friendKey: string; name: string; result: "won" | "lost" | "disputed"; at: number }[];
  /** Friends with Doomsday data not duelled yet today. */
  open: { friendKey: string; name: string }[];
  points: number;
}

export interface TrackLadders {
  pve: LadderRow[];
  /** PvP Virgins are left out; screens list them from `friends`. */
  pvp: LadderRow[];
}

export interface LadderRow {
  friendKey: string;
  name: string;
  /** 1-based; ties broken as DOOMSDAY.md says. */
  place: number;
  points: number;
  approx?: boolean;
  /** This week only: since last week. */
  movement?: { kind: "up" | "down" | "same" | "new"; by?: number };
  /** The split per character. */
  characters: { guid: string; name: string; classFile?: string; points: number; approx?: boolean }[];
}

export interface PvpDetails {
  week: { kills: number; solo: number; skulls: number; approx?: boolean };
  /** This week, most first. */
  byZone: { zone: string; kills: number }[];
  characters: {
    guid: string;
    name: string;
    classFile?: string;
    faction?: "Horde" | "Alliance";
    /** Undefined from an addon before CF-52 (no `pvp`). */
    rank?: number;
    highestRank?: number;
    /** Lifetime honorable kills ("No rank yet · 12 kills", WEB-66). */
    hk?: number;
  }[];
  duels: {
    won: number;
    lost: number;
    /** Head-to-head against each friend, all time. */
    vs: { friendKey: string; name: string; won: number; lost: number }[];
    elo?: { rating: number; change: number; place: number };
  };
  battlegrounds: { name: string; won: number; lost: number; kills: number; points: number }[];
  /** Battleground names with a first win. */
  firstWins: string[];
}

export interface FeatRecord {
  id: string;
  /** WEB-56 kind (honorKills, pvpRank, firstEpic, ...); an unknown kind still shows. */
  kind: string;
  friendKey: string;
  /** `level`: the character's level at that feat, when known ("+4 new characters: Frida Snowmantle 41"). */
  character: { guid: string; name: string; classFile?: string; level?: number };
  at: number;
  /** "Stone Guard, a.k.a. Mailbox Menace", "First epic: Robes of the Exalted". */
  title: string;
  /** "chest · item level 66", "Fishing 300". */
  detail?: string;
  /** A rank feat's rank, for its insignia. */
  rank?: number;
  /** The item name shown in epic purple. */
  epicItem?: string;
  firstInGroup: boolean;
  /** The character had it when its fields first arrived: recorded silently, shown as "before tracking"; `at` is that
   *  upload. Never First in the group. */
  alreadyHad: boolean;
  /** The card image id, when the feat has one. */
  card?: string;
}

/** A feat not reached yet, with how far along (WEB-60 "Your feats"). */
export interface FeatProgress {
  kind: string;
  /** "1,000 honorable kills". */
  title: string;
  character?: { guid: string; name: string; classFile?: string };
  progress?: { value: number; target: number };
}
