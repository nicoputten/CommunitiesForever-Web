import { MONTH_SHORT, WEEKDAY_SHORT } from "../names";
// Doomsday: the rules of the addon repo's docs/DOOMSDAY.md (WEB-58), the TypeScript copy of the addon's
// src/core/Doomsday.lua (CF-55). Both pass tests/fixtures/doomsday/doomsday-cases.json, the golden cases, unchanged;
// a rule change updates DOOMSDAY.md, the golden file and both copies in the same release. Pure.

export const POOL_VERSION = 1;
/** 19:00 realm time, seconds after midnight. */
export const DEFAULT_RESET = 68400;
export const DAY = 86400;
/** The first Doomsday day (Wednesday 2026-11-04, launch): the draw runs forward from here. */
export const EPOCH = 20761;
export const POINTS = { daily: 5, weekly: 15, duelWin: 3, duelLoss: 1 } as const;
/** The 4th and later kill of one victim name in a day doesn't count. */
export const SAME_VICTIM_LIMIT = 3;

export type Track = "pve" | "pvp";
export type Faction = "Horde" | "Alliance";

/** The realm clock against UTC. */
export interface Schedule {
  /** Seconds east of UTC. */
  offset?: number;
  /** Seconds after realm midnight. */
  reset?: number;
}

// ===== Schedule =====

/** pick(n, salt, count) of DOOMSDAY.md "The draw": an index 1..count, exact in JavaScript numbers. */
export function pick(n: number, salt: number, count: number): number {
  return mod(mod(n * 2654435761 + salt, 4294967296), count) + 1;
}

/** Lua's `%`: the floored modulo, never negative for a positive divisor (JavaScript's `%` keeps the sign). */
function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/** The realm's offset from UTC in seconds, rounded to 15 minutes, from the game clock and the server time. */
export function realmOffset(hour: number, minute: number, serverTime: number): number {
  let diff = hour * 60 + minute - mod(Math.floor(serverTime / 60), 1440);
  if (diff > 720) diff -= 1440;
  else if (diff <= -720) diff += 1440;
  return Math.floor(diff / 15 + 0.5) * 15 * 60;
}

/** The Doomsday day of a server time: named after the realm date it starts on. */
export function dayOf(serverTime: number, s: Schedule = {}): number {
  return Math.floor((serverTime + (s.offset ?? 0) - (s.reset ?? DEFAULT_RESET)) / DAY);
}

/** The week of a day: a week starts on Sunday at the reset (day 3, Sunday 1970-01-04, starts week 1). */
export function weekOf(n: number): number {
  return Math.floor((n + 4) / 7);
}

/** The first day of a week. */
export function weekStart(week: number): number {
  return week * 7 - 4;
}

/** The server time at which day n starts. */
export function dayStart(n: number, s: Schedule = {}): number {
  return n * DAY + (s.reset ?? DEFAULT_RESET) - (s.offset ?? 0);
}

/** Seconds until the next reset. */
export function resetsIn(serverTime: number, s: Schedule = {}): number {
  return dayStart(dayOf(serverTime, s) + 1, s) - serverTime;
}

/** "Tue 28 Oct": the day's name (the realm date it starts on). */
export function dayLabel(n: number): string {
  const d = new Date(n * DAY * 1000);
  return `${WEEKDAY_SHORT[(n + 4) % 7]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/**
 * The part of the day of an hour (Nico, live test 2026-10-29): 05–11 morning, 12–16 afternoon, 17–22 evening, 23–04
 * night.
 */
export function partOfDay(hour: number): string {
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 16) return "afternoon";
  if (hour >= 17 && hour <= 22) return "evening";
  return "night";
}

interface Clock {
  weekday: string;
  hour: number;
  time: string;
  date: string;
}

function clock(at: number, timeZone: string): Clock {
  const p: Record<string, string> = {};
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at * 1000));
  for (const x of parts) p[x.type] = x.value;
  return {
    weekday: WEEKDAY_SHORT.find((w) => w === p.weekday) ?? p.weekday ?? "",
    hour: Number(p.hour),
    time: `${p.hour}:${p.minute}`,
    date: `${p.year}-${p.month}-${p.day}`,
  };
}

/**
 * A Doomsday day by its reset (live test 2026-10-29): the weekday and the part of the day it starts, "Wed evening", and
 * its span "Wed 19:00 → Thu 19:00". In the zone given: the viewer's on the site, the realm's in the bot.
 */
export function doomsdayDay(dayStart: number, nextReset: number, timeZone: string): { name: string; span: string } {
  const a = clock(dayStart, timeZone);
  const b = clock(nextReset, timeZone);
  return { name: `${a.weekday} ${partOfDay(a.hour)}`, span: `${a.weekday} ${a.time} → ${b.weekday} ${b.time}` };
}

/** A clock time within a Doomsday day: "23:13", or with its weekday after midnight, "Thu 00:04". */
export function clockAt(at: number, dayStart: number, timeZone: string): string {
  const c = clock(at, timeZone);
  return c.date === clock(dayStart, timeZone).date ? c.time : `${c.weekday} ${c.time}`;
}

/** "resets Thu 19:00 · in 6 h 51 m". */
export function resetsText(nextReset: number, now: number, timeZone: string): string {
  const c = clock(nextReset, timeZone);
  return `resets ${c.weekday} ${c.time} · in ${duration(nextReset - now)}`;
}

/**
 * "N of M done" (live test 2026-10-29): exactly the goals on the grid, the PvE dailies, the Hunt and the Skirmish,
 * plus the Duel slot, done after its first duel. The Duel slot still never counts for crossing out or the streak.
 */
export function gridCount(goals: readonly { doneAt?: number }[], duels: number): { done: number; total: number } {
  return {
    done: goals.filter((g) => g.doneAt !== undefined).length + (duels > 0 ? 1 : 0),
    total: goals.length + 1,
  };
}

/** "3 h 12 m", "12 m", "0 m". */
export function duration(seconds: number): string {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} m` : `${minutes} m`;
}

// ===== Catalogue =====

export type GoalSlot = "daily" | "weekly" | "skirmish" | "bounty";
type Can =
  | "friendQuestLog"
  | "below60"
  | "below60Dungeon"
  | "below20"
  | "anyProfession"
  | "hasCooking"
  | "hasFirstAid"
  | "hasGathering"
  | "riding"
  | "canBuff"
  | "friends1"
  | "friends3"
  | "idle7"
  | "level30"
  | "altBelow60"
  | "ilvlReadable"
  | "dungeonInRange"
  | "hasProfession"
  | "hasFishing"
  | "hasCraftingProfession"
  | "professionBelow300"
  | "chars2"
  | "chars3"
  | "level20";

export interface Goal {
  id: string;
  slot: GoalSlot;
  /** The draw's category (the 15 of the PvE dailies, the addon's docs/DOOMSDAY-CATALOGUE.md). */
  category?: string;
  /** The pool version it joined; undefined: waits for data. */
  since?: number;
  retired?: boolean;
  /** The catalogue's size (1, 3 or 5), scored from pool version 2 (pointsFor); undefined: the flat value. */
  points?: number;
  text: string;
  /** The short label (at most 10 characters, unique within a slot) for the grid columns and the bot's images. */
  short: string;
  can?: Can;
  fallback?: string[];
}

/**
 * Every goal, in pool order: the addon's `Doomsday.GOALS` (src/core/Doomsday.lua, CF-70), pinned by the golden
 * `pools.catalogue`. Ids are never reused or renamed.
 */
export const GOALS: readonly Goal[] = [
  // quests
  {
    id: "d.quests10",
    slot: "daily",
    category: "quests",
    since: 1,
    points: 3,
    text: "Finish 10 quests",
    short: "10 quests",
  },
  {
    id: "d.quests20",
    slot: "daily",
    category: "quests",
    since: 1,
    points: 5,
    text: "Finish 20 quests",
    short: "20 quests",
  },
  {
    id: "d.zone5",
    slot: "daily",
    category: "quests",
    since: 1,
    points: 3,
    text: "Finish 5 quests in one zone",
    short: "5 in zone",
  },
  {
    id: "d.zones3",
    slot: "daily",
    category: "quests",
    since: 1,
    points: 3,
    text: "Hand in quests in 3 zones",
    short: "3 zones",
  },
  {
    id: "d.shared3",
    slot: "daily",
    category: "quests",
    since: 1,
    points: 3,
    text: "Share 3 quests with a friend",
    short: "3 shared",
    can: "friendQuestLog",
    fallback: ["d.quests10"],
  },
  {
    id: "d.questUp",
    slot: "daily",
    category: "quests",
    points: 3,
    text: "Finish a quest above the character's level",
    short: "Hard quest",
    can: "below60",
    fallback: ["d.quests10"],
  },
  { id: "d.groupQuest", slot: "daily", category: "quests", points: 3, text: "Finish a group quest", short: "Group Q" },
  { id: "d.classQuest", slot: "daily", category: "quests", points: 3, text: "Finish a class quest", short: "Class Q" },
  {
    id: "d.questBurst",
    slot: "daily",
    category: "quests",
    points: 3,
    text: "Hand in 3 quests within 10 minutes",
    short: "Quick 3",
  },
  { id: "d.accept5", slot: "daily", category: "quests", points: 3, text: "Take on 5 new quests", short: "Take 5" },

  // levels
  {
    id: "d.level",
    slot: "daily",
    category: "levels",
    since: 1,
    points: 3,
    text: "Gain a level",
    short: "Level",
    can: "below60",
    fallback: ["d.quests20"],
  },
  {
    id: "d.altLevel",
    slot: "daily",
    category: "levels",
    since: 1,
    points: 3,
    text: "Gain a level on an alt",
    short: "Alt level",
    can: "altBelow60",
    fallback: ["d.quests10"],
  },
  {
    id: "d.ilvl",
    slot: "daily",
    category: "levels",
    since: 1,
    points: 3,
    text: "Raise an item level",
    short: "Item level",
    can: "ilvlReadable",
    fallback: ["d.quests10"],
  },
  {
    id: "d.cleanLevel",
    slot: "daily",
    category: "levels",
    points: 3,
    text: "Gain a level without dying",
    short: "Clean lvl",
    can: "below60",
    fallback: ["d.quests20"],
  },
  {
    id: "d.levels2",
    slot: "daily",
    category: "levels",
    points: 5,
    text: "Gain 2 levels",
    short: "2 levels",
    can: "below60",
    fallback: ["d.quests20"],
  },
  {
    id: "d.dingDungeon",
    slot: "daily",
    category: "levels",
    points: 3,
    text: "Gain a level inside a dungeon",
    short: "Deep ding",
    can: "below60Dungeon",
    fallback: ["d.level"],
  },
  {
    id: "d.dingFriend",
    slot: "daily",
    category: "levels",
    points: 3,
    text: "Gain a level in a group with a friend",
    short: "Duo ding",
    can: "below60",
    fallback: ["d.groupFriend"],
  },
  {
    id: "d.lowbie",
    slot: "daily",
    category: "levels",
    points: 3,
    text: "Gain a level on a character below 20",
    short: "Lowbie",
    can: "below20",
    fallback: ["d.altLevel"],
  },

  // dungeons
  {
    id: "d.dungeon",
    slot: "daily",
    category: "dungeons",
    since: 1,
    points: 5,
    text: "Run a dungeon",
    short: "Dungeon",
    can: "dungeonInRange",
    fallback: ["d.quests10"],
  },
  {
    id: "d.dungeonFriend",
    slot: "daily",
    category: "dungeons",
    since: 1,
    points: 5,
    text: "Run a dungeon with a friend",
    short: "Group run",
    can: "dungeonInRange",
    fallback: ["d.quests10"],
  },
  {
    id: "d.bosses3",
    slot: "daily",
    category: "dungeons",
    since: 1,
    points: 5,
    text: "Defeat 3 dungeon bosses",
    short: "3 bosses",
    can: "dungeonInRange",
    fallback: ["d.quests10"],
  },
  {
    id: "d.dungeonQuest",
    slot: "daily",
    category: "dungeons",
    points: 3,
    text: "Hand in a dungeon quest",
    short: "Dungeon Q",
    can: "dungeonInRange",
    fallback: ["d.quests10"],
  },
  {
    id: "d.cleanRun",
    slot: "daily",
    category: "dungeons",
    points: 5,
    text: "Run a dungeon without dying",
    short: "Clean run",
    can: "dungeonInRange",
    fallback: ["d.quests10"],
  },
  {
    id: "d.speedRun",
    slot: "daily",
    category: "dungeons",
    points: 5,
    text: "Defeat 3 bosses of one dungeon within 45 minutes",
    short: "Speed run",
    can: "dungeonInRange",
    fallback: ["d.quests10"],
  },
  {
    id: "d.newDungeon",
    slot: "daily",
    category: "dungeons",
    points: 5,
    text: "Run a dungeon new to the character",
    short: "Fresh run",
    can: "dungeonInRange",
    fallback: ["d.quests10"],
  },
  {
    id: "d.dungeons2",
    slot: "daily",
    category: "dungeons",
    points: 5,
    text: "Run 2 dungeons",
    short: "2 dungeons",
    can: "dungeonInRange",
    fallback: ["d.quests10"],
  },

  // crafts
  {
    id: "d.skill5",
    slot: "daily",
    category: "crafts",
    since: 1,
    points: 3,
    text: "Earn 5 profession skill points",
    short: "Skills",
    can: "hasProfession",
    fallback: ["d.quests10"],
  },
  {
    id: "d.secondary",
    slot: "daily",
    category: "crafts",
    since: 1,
    points: 3,
    text: "Raise Cooking, First Aid or Fishing",
    short: "Secondary",
  },
  {
    id: "d.craft5",
    slot: "daily",
    category: "crafts",
    points: 3,
    text: "Craft 5 items",
    short: "Craft 5",
    can: "anyProfession",
    fallback: ["d.secondary"],
  },
  {
    id: "d.gather10",
    slot: "daily",
    category: "crafts",
    points: 3,
    text: "Gather 10 herbs, ore or leather",
    short: "Gather 10",
    can: "hasGathering",
    fallback: ["d.skill5"],
  },
  {
    id: "d.newRecipe",
    slot: "daily",
    category: "crafts",
    points: 3,
    text: "Learn a new recipe",
    short: "Recipe",
    can: "anyProfession",
    fallback: ["d.secondary"],
  },
  {
    id: "d.craftGreen",
    slot: "daily",
    category: "crafts",
    points: 3,
    text: "Craft something uncommon or better",
    short: "Fine craft",
    can: "hasCraftingProfession",
    fallback: ["d.craft5"],
  },

  // cooking
  {
    id: "d.cook5",
    slot: "daily",
    category: "cooking",
    points: 3,
    text: "Cook 5 meals",
    short: "Cook 5",
    can: "hasCooking",
    fallback: ["d.secondary"],
  },
  {
    id: "d.cook15",
    slot: "daily",
    category: "cooking",
    points: 5,
    text: "Cook 15 dishes",
    short: "Cook 15",
    can: "hasCooking",
    fallback: ["d.secondary"],
  },
  {
    id: "d.cookSkill5",
    slot: "daily",
    category: "cooking",
    points: 3,
    text: "Raise Cooking by 5 points",
    short: "Cooking +5",
    can: "hasCooking",
    fallback: ["d.secondary"],
  },
  {
    id: "d.cookKinds3",
    slot: "daily",
    category: "cooking",
    points: 3,
    text: "Cook 3 different dishes",
    short: "3 dishes",
    can: "hasCooking",
    fallback: ["d.secondary"],
  },
  {
    id: "d.campfire",
    slot: "daily",
    category: "cooking",
    points: 1,
    text: "Light a campfire",
    short: "Campfire",
    can: "hasCooking",
    fallback: ["d.secondary"],
  },
  {
    id: "d.campfireBuff",
    slot: "daily",
    category: "cooking",
    points: 3,
    text: "Sit at a campfire fed with 3 or more items",
    short: "Cozy fire",
  },
  {
    id: "d.eatOwn",
    slot: "daily",
    category: "cooking",
    points: 3,
    text: "Eat a dish cooked that day",
    short: "Home meal",
    can: "hasCooking",
    fallback: ["d.secondary"],
  },
  {
    id: "d.cookRecipe",
    slot: "daily",
    category: "cooking",
    points: 3,
    text: "Learn a cooking recipe",
    short: "New dish",
    can: "hasCooking",
    fallback: ["d.secondary"],
  },
  {
    id: "d.feedFriend",
    slot: "daily",
    category: "cooking",
    points: 3,
    text: "Give a friend a dish cooked by an own character",
    short: "Feed pal",
    can: "hasCooking",
    fallback: ["d.trade"],
  },

  // fishing
  {
    id: "d.fish20",
    slot: "daily",
    category: "fishing",
    points: 3,
    text: "Catch 20 fish",
    short: "20 fish",
    can: "hasFishing",
    fallback: ["d.secondary"],
  },
  {
    id: "d.fishZones",
    slot: "daily",
    category: "fishing",
    points: 3,
    text: "Fish in 2 zones",
    short: "Fish spots",
    can: "hasFishing",
    fallback: ["d.secondary"],
  },
  {
    id: "d.fish50",
    slot: "daily",
    category: "fishing",
    points: 5,
    text: "Catch 50 fish",
    short: "50 fish",
    can: "hasFishing",
    fallback: ["d.secondary"],
  },
  {
    id: "d.fishSkill5",
    slot: "daily",
    category: "fishing",
    points: 3,
    text: "Raise Fishing by 5 points",
    short: "Fishing +5",
    can: "hasFishing",
    fallback: ["d.secondary"],
  },
  {
    id: "d.fishKinds3",
    slot: "daily",
    category: "fishing",
    points: 3,
    text: "Catch 3 kinds of fish",
    short: "Fish kinds",
    can: "hasFishing",
    fallback: ["d.secondary"],
  },
  {
    id: "d.fishFriend",
    slot: "daily",
    category: "fishing",
    points: 3,
    text: "Fish in a group with a friend",
    short: "Fish buddy",
    can: "hasFishing",
    fallback: ["d.groupFriend"],
  },
  {
    id: "d.fishNight",
    slot: "daily",
    category: "fishing",
    points: 3,
    text: "Fish at night",
    short: "Night fish",
    can: "hasFishing",
    fallback: ["d.secondary"],
  },

  // firstaid
  {
    id: "d.bandage3",
    slot: "daily",
    category: "firstaid",
    points: 3,
    text: "Make 3 bandages",
    short: "Bandages",
    can: "hasFirstAid",
    fallback: ["d.secondary"],
  },
  {
    id: "d.bandageUp",
    slot: "daily",
    category: "firstaid",
    points: 3,
    text: "Use a bandage",
    short: "Bandage up",
    can: "hasFirstAid",
    fallback: ["d.secondary"],
  },
  {
    id: "d.bandage10",
    slot: "daily",
    category: "firstaid",
    points: 3,
    text: "Make 10 bandages",
    short: "10 bandage",
    can: "hasFirstAid",
    fallback: ["d.secondary"],
  },
  {
    id: "d.bandageUse3",
    slot: "daily",
    category: "firstaid",
    points: 3,
    text: "Use 3 bandages",
    short: "Bandage x3",
    can: "hasFirstAid",
    fallback: ["d.secondary"],
  },
  {
    id: "d.bandageFriend",
    slot: "daily",
    category: "firstaid",
    points: 3,
    text: "Bandage a friend",
    short: "Medic",
    can: "hasFirstAid",
    fallback: ["d.groupFriend"],
  },
  {
    id: "d.aidSkill5",
    slot: "daily",
    category: "firstaid",
    points: 3,
    text: "Raise First Aid by 5 points",
    short: "Aid +5",
    can: "hasFirstAid",
    fallback: ["d.secondary"],
  },
  {
    id: "d.bandageKinds2",
    slot: "daily",
    category: "firstaid",
    points: 3,
    text: "Make 2 kinds of bandages",
    short: "2 bandages",
    can: "hasFirstAid",
    fallback: ["d.secondary"],
  },

  // play
  {
    id: "d.chars2",
    slot: "daily",
    category: "play",
    since: 1,
    points: 1,
    text: "Play 2 characters",
    short: "2 chars",
    can: "chars2",
    fallback: ["d.quests10"],
  },
  {
    id: "d.chars3",
    slot: "daily",
    category: "play",
    points: 3,
    text: "Play 3 characters",
    short: "Play 3",
    can: "chars3",
    fallback: ["d.chars2"],
  },
  {
    id: "d.switchUp",
    slot: "daily",
    category: "play",
    points: 3,
    text: "Play a character not played the day before",
    short: "Switch up",
    can: "chars2",
    fallback: ["d.quests10"],
  },
  {
    id: "d.dustOff",
    slot: "daily",
    category: "play",
    points: 3,
    text: "Play a character after a week away",
    short: "Dust off",
    can: "idle7",
    fallback: ["d.chars2"],
  },
  {
    id: "d.earlyBird",
    slot: "daily",
    category: "play",
    points: 3,
    text: "Early bird: play before 09:00",
    short: "Early bird",
  },
  {
    id: "d.nightOwl",
    slot: "daily",
    category: "play",
    points: 3,
    text: "Night owl: play after 23:00",
    short: "Night owl",
  },
  { id: "d.session1h", slot: "daily", category: "play", points: 5, text: "Play a 1-hour session", short: "1h session" },
  {
    id: "d.deathless",
    slot: "daily",
    category: "play",
    points: 5,
    text: "Play an hour without dying",
    short: "No deaths",
  },
  { id: "d.jump100", slot: "daily", category: "play", points: 1, text: "Jump 100 times", short: "100 jumps" },

  // social
  {
    id: "d.groupFriend",
    slot: "daily",
    category: "social",
    points: 3,
    text: "Group up with a friend",
    short: "Group up",
  },
  { id: "d.trade", slot: "daily", category: "social", points: 3, text: "Trade with a friend", short: "Trade" },
  {
    id: "d.questTogether",
    slot: "daily",
    category: "social",
    points: 3,
    text: "Hand in a quest in a group with a friend",
    short: "Duo quest",
  },
  {
    id: "d.chatHello",
    slot: "daily",
    category: "social",
    points: 1,
    text: "Say something in the community chat",
    short: "Chat",
  },
  {
    id: "d.sameZone",
    slot: "daily",
    category: "social",
    points: 3,
    text: "Be in the same zone as a friend",
    short: "Neighbours",
    can: "friends1",
    fallback: ["d.chars2"],
  },
  {
    id: "d.online3",
    slot: "daily",
    category: "social",
    points: 3,
    text: "Be online with 3 friends at once",
    short: "Full house",
    can: "friends3",
    fallback: ["d.groupFriend"],
  },
  {
    id: "d.carry",
    slot: "daily",
    category: "social",
    points: 3,
    text: "Group with a friend 5+ levels lower",
    short: "Carry",
  },
  { id: "d.whisper", slot: "daily", category: "social", points: 1, text: "Whisper a friend", short: "Whisper" },
  { id: "d.wave", slot: "daily", category: "social", points: 1, text: "Wave at a friend", short: "Wave" },
  {
    id: "d.groupPic",
    slot: "daily",
    category: "social",
    points: 1,
    text: "Take a screenshot in a group with a friend",
    short: "Group pic",
  },

  // exploration
  {
    id: "d.discover1",
    slot: "daily",
    category: "exploration",
    points: 3,
    text: "Discover a new place",
    short: "Discover",
  },
  {
    id: "d.discover3",
    slot: "daily",
    category: "exploration",
    points: 3,
    text: "Discover 3 new places",
    short: "Discover 3",
  },
  { id: "d.roam4", slot: "daily", category: "exploration", points: 3, text: "Visit 4 zones", short: "Roam 4" },
  {
    id: "d.newZone",
    slot: "daily",
    category: "exploration",
    points: 3,
    text: "Set foot in a zone new to the character",
    short: "New zone",
  },
  {
    id: "d.places10",
    slot: "daily",
    category: "exploration",
    points: 3,
    text: "Visit 10 places within zones",
    short: "10 places",
  },
  { id: "d.swim", slot: "daily", category: "exploration", points: 3, text: "Swim for 2 minutes", short: "Swim" },
  {
    id: "d.nostalgia",
    slot: "daily",
    category: "exploration",
    points: 3,
    text: "Visit a zone far below the character's level",
    short: "Nostalgia",
    can: "level30",
    fallback: ["d.roam4"],
  },
  {
    id: "d.daredevil",
    slot: "daily",
    category: "exploration",
    points: 3,
    text: "Visit a zone above the character's level",
    short: "Daredevil",
    can: "below60",
    fallback: ["d.roam4"],
  },

  // travel
  { id: "d.flight", slot: "daily", category: "travel", points: 1, text: "Take a flight", short: "Fly" },
  {
    id: "d.newFlight",
    slot: "daily",
    category: "travel",
    points: 3,
    text: "Learn a new flight path",
    short: "New flight",
  },
  { id: "d.hearth", slot: "daily", category: "travel", points: 1, text: "Use the hearthstone", short: "Hearth" },
  { id: "d.bind", slot: "daily", category: "travel", points: 1, text: "Make a new inn home", short: "New home" },
  {
    id: "d.ride",
    slot: "daily",
    category: "travel",
    points: 3,
    text: "Ride a mount for 15 minutes",
    short: "Ride",
    can: "riding",
    fallback: ["d.roam4"],
  },
  { id: "d.crossSea", slot: "daily", category: "travel", points: 3, text: "Cross the sea", short: "Cross sea" },
  {
    id: "d.summoned",
    slot: "daily",
    category: "travel",
    points: 3,
    text: "Get summoned by a friend",
    short: "Summoned",
  },

  // combat
  {
    id: "d.kills30",
    slot: "daily",
    category: "combat",
    points: 3,
    text: "Defeat 30 enemies",
    short: "30 foes",
    can: "below60",
    fallback: ["d.bosses3"],
  },
  {
    id: "d.elite",
    slot: "daily",
    category: "combat",
    points: 3,
    text: "Defeat an elite",
    short: "Elite",
    can: "below60",
    fallback: ["d.bosses3"],
  },
  {
    id: "d.rareMob",
    slot: "daily",
    category: "combat",
    points: 5,
    text: "Defeat a rare enemy",
    short: "Rare hunt",
    can: "below60",
    fallback: ["d.bosses3"],
  },
  {
    id: "d.bigFoe",
    slot: "daily",
    category: "combat",
    points: 3,
    text: "Defeat an enemy 3+ levels higher",
    short: "Big foe",
    can: "below60",
    fallback: ["d.bosses3"],
  },
  {
    id: "d.streak20",
    slot: "daily",
    category: "combat",
    points: 5,
    text: "Defeat 20 enemies without dying",
    short: "Streak 20",
    can: "below60",
    fallback: ["d.bosses3"],
  },
  {
    id: "d.weaponSkill",
    slot: "daily",
    category: "combat",
    points: 3,
    text: "Raise a weapon skill 5 times",
    short: "Weapon +5",
  },
  {
    id: "d.duoHunt",
    slot: "daily",
    category: "combat",
    points: 3,
    text: "Defeat 15 enemies in a group with a friend",
    short: "Duo hunt",
    can: "below60",
    fallback: ["d.dungeonFriend"],
  },

  // loot
  { id: "d.rare", slot: "daily", category: "loot", points: 3, text: "Loot a rare item", short: "Rare loot" },
  { id: "d.green5", slot: "daily", category: "loot", points: 3, text: "Loot 5 uncommon items", short: "5 greens" },
  {
    id: "d.reward",
    slot: "daily",
    category: "loot",
    points: 3,
    text: "Earn an uncommon quest reward",
    short: "Reward",
  },
  {
    id: "d.coins10",
    slot: "daily",
    category: "loot",
    points: 3,
    text: "Loot coins from 10 enemies",
    short: "10 purses",
  },
  { id: "d.equipNew", slot: "daily", category: "loot", points: 3, text: "Wear a new find", short: "New gear" },
  { id: "d.treasure", slot: "daily", category: "loot", points: 3, text: "Open a treasure chest", short: "Treasure" },

  // economy
  { id: "d.vendorSale", slot: "daily", category: "economy", points: 1, text: "Sell to a merchant", short: "Sell" },
  { id: "d.vendorBuy", slot: "daily", category: "economy", points: 1, text: "Buy from a merchant", short: "Shopping" },
  {
    id: "d.auctionPost",
    slot: "daily",
    category: "economy",
    points: 3,
    text: "Put an item up for auction",
    short: "Auction",
  },
  {
    id: "d.auctionBuy",
    slot: "daily",
    category: "economy",
    points: 3,
    text: "Buy at the auction house",
    short: "Bargain",
  },
  {
    id: "d.mailFriend",
    slot: "daily",
    category: "economy",
    points: 1,
    text: "Send mail to a friend",
    short: "Mail pal",
  },
  { id: "d.mailbox", slot: "daily", category: "economy", points: 1, text: "Empty the mailbox", short: "Mailbox" },
  {
    id: "d.profit",
    slot: "daily",
    category: "economy",
    points: 3,
    text: "End a session in profit",
    short: "In profit",
  },

  // care
  { id: "d.repair", slot: "daily", category: "care", points: 1, text: "Repair gear", short: "Repair" },
  {
    id: "d.trainer",
    slot: "daily",
    category: "care",
    points: 3,
    text: "Learn a spell at a trainer",
    short: "Train",
    can: "below60",
    fallback: ["d.repair"],
  },
  { id: "d.wellFed", slot: "daily", category: "care", points: 1, text: "Get Well Fed", short: "Well fed" },
  {
    id: "d.buffFriend",
    slot: "daily",
    category: "care",
    points: 3,
    text: "Buff a friend",
    short: "Buff pal",
    can: "canBuff",
    fallback: ["d.groupFriend"],
  },
  { id: "d.restock", slot: "daily", category: "care", points: 1, text: "Restock food or drink", short: "Restock" },
  { id: "d.bank", slot: "daily", category: "care", points: 1, text: "Visit the bank", short: "Bank" },
  {
    id: "d.tidyBags",
    slot: "daily",
    category: "care",
    points: 1,
    text: "Clear the junk from the bags",
    short: "Tidy bags",
  },
  { id: "d.potion", slot: "daily", category: "care", points: 1, text: "Drink a potion", short: "Potion" },
  {
    id: "d.scrolls10",
    slot: "daily",
    category: "care",
    points: 3,
    text: "Read 10 scrolls on the own character",
    short: "10 scrolls",
  },

  { id: "w.days3", slot: "weekly", since: 1, text: "Play on 3 days", short: "3 days" },
  { id: "w.days5", slot: "weekly", since: 1, text: "Play on 5 days", short: "5 days" },
  {
    id: "w.chars3",
    slot: "weekly",
    since: 1,
    text: "Play 3 different characters",
    short: "3 chars",
    can: "chars3",
    fallback: ["w.days3"],
  },
  {
    id: "w.levels3",
    slot: "weekly",
    since: 1,
    text: "Gain 3 levels",
    short: "3 levels",
    can: "below60",
    fallback: ["w.quests50"],
  },
  {
    id: "w.altLevels2",
    slot: "weekly",
    since: 1,
    text: "Gain 2 levels on an alt",
    short: "Alt 2 lvls",
    can: "altBelow60",
    fallback: ["w.quests50"],
  },
  { id: "w.quests50", slot: "weekly", since: 1, text: "Finish 50 quests", short: "50 quests" },
  { id: "w.zones5", slot: "weekly", since: 1, text: "Hand in quests in 5 zones", short: "5 zones" },
  {
    id: "w.dungeons3",
    slot: "weekly",
    since: 1,
    text: "Run 3 dungeons",
    short: "3 dungeons",
    can: "dungeonInRange",
    fallback: ["w.quests50"],
  },
  {
    id: "w.dungeonsDiff3",
    slot: "weekly",
    since: 1,
    text: "Run 3 different dungeons",
    short: "3 distinct",
    can: "dungeonInRange",
    fallback: ["w.quests50"],
  },
  {
    id: "w.dungeonFriends2",
    slot: "weekly",
    since: 1,
    text: "Run a dungeon with 2 friends",
    short: "Trio run",
    can: "dungeonInRange",
    fallback: ["w.quests50"],
  },
  {
    id: "w.fullClear",
    slot: "weekly",
    since: 1,
    text: "Clear every boss of a dungeon",
    short: "Full clear",
    can: "dungeonInRange",
    fallback: ["w.quests50"],
  },
  {
    id: "w.skill25",
    slot: "weekly",
    since: 1,
    text: "Earn 25 profession skill points",
    short: "25 skill",
    can: "hasProfession",
    fallback: ["w.quests50"],
  },
  {
    id: "w.cap",
    slot: "weekly",
    since: 1,
    text: "Reach a profession cap",
    short: "Skill cap",
    can: "professionBelow300",
    fallback: ["w.skill25", "w.quests50"],
  },
  { id: "w.newProf", slot: "weekly", since: 1, text: "Learn a new profession", short: "New prof" },
  {
    id: "w.ilvl3",
    slot: "weekly",
    since: 1,
    text: "Raise an item level by 3",
    short: "Item lvl+3",
    can: "ilvlReadable",
    fallback: ["w.quests50"],
  },
  { id: "w.friends3", slot: "weekly", text: "Group with 3 different friends", short: "3 friends" },
  { id: "w.rare5", slot: "weekly", text: "Loot 5 rare items", short: "5 rares" },
  { id: "w.session2h", slot: "weekly", text: "Play a 2-hour session", short: "2h session" },
  { id: "w.discover5", slot: "weekly", text: "Discover 5 new places", short: "Discover 5" },
  {
    id: "w.craftTrade",
    slot: "weekly",
    text: "Craft something and trade it",
    short: "Craft gift",
    can: "hasCraftingProfession",
    fallback: ["w.quests50"],
  },

  {
    id: "p.frontLine",
    slot: "skirmish",
    since: 1,
    text: "Front line: 5 kills in the zone of the day",
    short: "Front line",
    can: "level20",
    fallback: ["p.loneWolf"],
  },
  { id: "p.punchUp", slot: "skirmish", text: "Punch up: 2 kills on players 3+ levels above you", short: "Punch up" },
  { id: "p.loneWolf", slot: "skirmish", since: 1, text: "Lone wolf: 3 solo kills", short: "Lone wolf" },
  { id: "p.untouchable", slot: "skirmish", since: 1, text: "Untouchable: 5 kills without dying", short: "Untouched" },
  { id: "p.variety", slot: "skirmish", text: "Variety: kills of 3 different classes", short: "Variety" },
  { id: "p.ranked", slot: "skirmish", text: "Ranked bounty: kill a ranked player", short: "Ranked" },
  // skirmish: emote
  {
    id: "p.flex",
    slot: "skirmish",
    category: "emote",
    points: 1,
    text: "Flex at a player of the other faction",
    short: "Flex",
  },
  {
    id: "p.boo",
    slot: "skirmish",
    category: "emote",
    points: 1,
    text: "Boo a player of the other faction",
    short: "Boo",
  },
  // skirmish: kill
  {
    id: "p.punchUp5",
    slot: "skirmish",
    category: "kill",
    points: 5,
    text: "Kill an enemy player 5+ levels higher",
    short: "Punch up 5",
  },
  {
    id: "p.punchDown5",
    slot: "skirmish",
    category: "kill",
    points: 3,
    text: "Kill an enemy player 5+ levels lower",
    short: "Punch down",
  },

  { id: "b.zone25", slot: "bounty", since: 1, text: "25 kills in the zone of the week", short: "Zone 25" },
  { id: "b.allClasses", slot: "bounty", text: "A kill of every enemy class", short: "Classes" },
  { id: "b.allRaces", slot: "bounty", text: "A kill of every enemy race", short: "Races" },
  { id: "b.ranked5", slot: "bounty", text: "5 kills on ranked players", short: "5 ranked" },
  { id: "b.kills50", slot: "bounty", since: 1, text: "50 counted kills", short: "50 kills" },
  { id: "b.spree10", slot: "bounty", since: 1, text: "A spree of 10", short: "Spree 10" },
  { id: "b.hunt3", slot: "bounty", text: "The Hunt done on 3 days", short: "3 hunts" },
  { id: "b.duels3", slot: "bounty", since: 1, text: "Duels with 3 different friends", short: "3 duels" },
  { id: "b.days5", slot: "bounty", since: 1, text: "Kills on 5 days", short: "Kill days" },
];

const BY_ID = new Map(GOALS.map((g) => [g.id, g]));

/** The Hunt joins with the pool version that verifies victim race and class (CF-54); undefined: not yet. */
export const HUNT_SINCE: number | undefined = undefined;

export function goal(id: string): Goal | undefined {
  return BY_ID.get(id);
}

/** The active goals of a slot in pool order, for a pool version. */
export function pool(slot: GoalSlot, version = POOL_VERSION): string[] {
  return GOALS.filter((g) => g.slot === slot && g.since !== undefined && g.since <= version && !g.retired).map(
    (g) => g.id,
  );
}

// ===== Lists =====

/** Enemy race and class combinations, by the hunting character's faction (race tokens as UnitRace gives them). */
const COMBOS: Record<Faction, [string, string[]][]> = {
  Horde: [
    ["Human", ["WARRIOR", "PALADIN", "ROGUE", "PRIEST", "MAGE", "WARLOCK"]],
    ["Dwarf", ["WARRIOR", "PALADIN", "HUNTER", "ROGUE", "PRIEST"]],
    ["NightElf", ["WARRIOR", "HUNTER", "ROGUE", "PRIEST", "DRUID"]],
    ["Gnome", ["WARRIOR", "ROGUE", "MAGE", "WARLOCK"]],
  ],
  Alliance: [
    ["Orc", ["WARRIOR", "HUNTER", "ROGUE", "SHAMAN", "WARLOCK"]],
    ["Scourge", ["WARRIOR", "ROGUE", "PRIEST", "MAGE", "WARLOCK"]],
    ["Tauren", ["WARRIOR", "HUNTER", "SHAMAN", "DRUID"]],
    ["Troll", ["WARRIOR", "HUNTER", "ROGUE", "PRIEST", "SHAMAN", "MAGE"]],
  ],
};

export interface Combo {
  race: string;
  class: string;
}

/** The combinations a faction hunts, in list order (20 each). */
export function combos(faction: Faction): Combo[] {
  return COMBOS[faction].flatMap(([race, classes]) => classes.map((c) => ({ race, class: c })));
}

/** Zone bands by the level of the friend's highest character (the zone names as the feed stores them). */
export const BANDS: readonly { min: number; max: number; zones: string[] }[] = [
  { min: 20, max: 29, zones: ["Hillsbrad Foothills", "Ashenvale", "Stonetalon Mountains"] },
  {
    min: 30,
    max: 44,
    zones: ["Stranglethorn Vale", "Arathi Highlands", "Desolace", "Dustwallow Marsh", "Alterac Mountains"],
  },
  {
    min: 45,
    max: 54,
    zones: ["Tanaris", "Feralas", "The Hinterlands", "Searing Gorge", "Un'Goro Crater", "Azshara"],
  },
  {
    min: 55,
    max: 60,
    zones: ["Burning Steppes", "Felwood", "Winterspring", "Eastern Plaguelands", "Western Plaguelands", "Silithus"],
  },
];

/** The zone of the day (salt 4) or of the week (salt 5) for a character level; undefined below 20. */
export function zoneFor(n: number, salt: number, level: number | undefined): string | undefined {
  const band = level === undefined ? undefined : BANDS.find((b) => level >= b.min && level <= b.max);
  return band?.zones[pick(n, salt, band.zones.length) - 1];
}

// ===== The draw =====

export const SALT = { hunt: 1, skirmish: 2, bounty: 3, dailies: [11, 12, 13], weeklies: [21, 22, 23] } as const;

function drawOne(list: readonly string[], n: number, salt: number, previous: readonly string[]): string | undefined {
  if (list.length === 0) return undefined;
  let available = list.filter((x) => !previous.includes(x));
  if (available.length === 0) available = [...list];
  return available[pick(n, salt, available.length) - 1];
}

function drawDailies(list: readonly string[], n: number, previous: readonly string[]): string[] {
  const chosen: string[] = [];
  const categories = new Set<string>();
  for (let slot = 0; slot < 3; slot++) {
    const candidates = (skipPrevious: boolean) =>
      list.filter((id) => !categories.has(BY_ID.get(id)!.category!) && !(skipPrevious && previous.includes(id)));
    let c = candidates(true);
    if (c.length === 0) c = candidates(false);
    if (c.length === 0) break;
    const id = c[pick(n, SALT.dailies[slot]!, c.length) - 1]!;
    chosen.push(id);
    categories.add(BY_ID.get(id)!.category!);
  }
  return chosen;
}

function drawWeeklies(list: readonly string[], week: number, previous: readonly string[]): string[] {
  const chosen: string[] = [];
  for (let slot = 0; slot < 3; slot++) {
    let c = list.filter((id) => !chosen.includes(id) && !previous.includes(id));
    if (c.length === 0) c = list.filter((id) => !chosen.includes(id));
    if (c.length === 0) break;
    chosen.push(c[pick(week, SALT.weeklies[slot]!, c.length) - 1]!);
  }
  return chosen;
}

const comboKey = (c: Combo) => `${c.race}:${c.class}`;

function drawHunt(faction: Faction, n: number, previous: Combo | undefined): Combo | undefined {
  const key = drawOne(combos(faction).map(comboKey), n, SALT.hunt, previous ? [comboKey(previous)] : []);
  if (key === undefined) return undefined;
  const [race, cls] = key.split(":") as [string, string];
  return { race, class: cls };
}

export interface DayDraw {
  dailies: string[];
  skirmish?: string;
  /** The combination per hunting faction; undefined until the Hunt is in the pool. */
  hunt?: Record<Faction, Combo | undefined>;
}

export interface WeekDraw {
  weeklies: string[];
  bounty?: string;
}

const dayCache = new Map<string, DayDraw>();
const weekCache = new Map<string, WeekDraw>();

/**
 * The day's draw, the same for everyone (before swaps). Days from EPOCH on never repeat the previous day's goals: the
 * draw runs forward from EPOCH, each day excluding the day before. `hunt` forces the Hunt on (the golden cases test the
 * pool version that will have it).
 */
export function draw(n: number, version = POOL_VERSION, hunt = HUNT_SINCE !== undefined && HUNT_SINCE <= version) {
  const prefix = `${version}${hunt ? "h" : ""}:`;
  const cached = dayCache.get(prefix + n);
  if (cached !== undefined) return cached;
  const dailyPool = pool("daily", version);
  const skirmishPool = pool("skirmish", version);
  const first = n < EPOCH ? n : EPOCH;
  let previous: DayDraw | undefined;
  for (let day = first; day <= n; day++) {
    let result = dayCache.get(prefix + day);
    if (result === undefined) {
      const prev = previous ?? { dailies: [] };
      result = {
        dailies: drawDailies(dailyPool, day, prev.dailies),
        skirmish: drawOne(skirmishPool, day, SALT.skirmish, prev.skirmish !== undefined ? [prev.skirmish] : []),
      };
      if (hunt) {
        result.hunt = {
          Horde: drawHunt("Horde", day, prev.hunt?.Horde),
          Alliance: drawHunt("Alliance", day, prev.hunt?.Alliance),
        };
      }
      dayCache.set(prefix + day, result);
    }
    previous = result;
  }
  return dayCache.get(prefix + n)!;
}

/** The week's draw before swaps. As draw, per week. */
export function drawWeek(week: number, version = POOL_VERSION): WeekDraw {
  const key = `${version}:`;
  const cached = weekCache.get(key + week);
  if (cached !== undefined) return cached;
  const weeklyPool = pool("weekly", version);
  const bountyPool = pool("bounty", version);
  const epochWeek = weekOf(EPOCH);
  const first = week < epochWeek ? week : epochWeek;
  let previous: WeekDraw | undefined;
  for (let w = first; w <= week; w++) {
    let result = weekCache.get(key + w);
    if (result === undefined) {
      const prev = previous ?? { weeklies: [] };
      result = {
        weeklies: drawWeeklies(weeklyPool, w, prev.weeklies),
        bounty: drawOne(bountyPool, w, SALT.bounty, prev.bounty !== undefined ? [prev.bounty] : []),
      };
      weekCache.set(key + w, result);
    }
    previous = result;
  }
  return weekCache.get(key + week)!;
}

// ===== Swaps =====

/** One friend over all their characters. A missing field counts as "can do" (unknown never swaps). */
export interface Situation {
  chars?: number;
  below60?: number;
  /** Characters below 60 other than the highest one. */
  altBelow60?: number;
  highest?: number;
  /** The highest level that played that day. */
  highestToday?: number;
  ilvlReadable?: boolean;
  dungeonInRange?: boolean;
  hasProfession?: boolean;
  hasFishing?: boolean;
  hasCraftingProfession?: boolean;
  professionBelow300?: boolean;
  friendQuestLog?: boolean;
  /** Characters below 20. */
  below20?: number;
  hasCooking?: boolean;
  hasFirstAid?: boolean;
  hasGathering?: boolean;
  riding?: boolean;
  canBuff?: boolean;
  /** Friends online. */
  friends?: number;
  /** Characters not played for 7 days. */
  idle7?: number;
}

const atLeast = (value: number | undefined, n: number) => value === undefined || value >= n;

const CAN: Record<Can, (s: Situation) => boolean> = {
  friendQuestLog: (s) => s.friendQuestLog !== false,
  below60: (s) => s.below60 === undefined || s.below60 > 0,
  below60Dungeon: (s) => (s.below60 === undefined || s.below60 > 0) && s.dungeonInRange !== false,
  below20: (s) => s.below20 === undefined || s.below20 > 0,
  // Any profession, secondary ones included.
  anyProfession: (s) =>
    s.hasProfession !== false || s.hasCooking !== false || s.hasFirstAid !== false || s.hasFishing !== false,
  hasCooking: (s) => s.hasCooking !== false,
  hasFirstAid: (s) => s.hasFirstAid !== false,
  hasGathering: (s) => s.hasGathering !== false,
  riding: (s) => s.riding !== false,
  canBuff: (s) => s.canBuff !== false,
  friends1: (s) => atLeast(s.friends, 1),
  friends3: (s) => atLeast(s.friends, 3),
  idle7: (s) => atLeast(s.idle7, 1),
  level30: (s) => atLeast(s.highest, 30),
  altBelow60: (s) => s.altBelow60 === undefined || s.altBelow60 > 0,
  ilvlReadable: (s) => s.ilvlReadable !== false,
  dungeonInRange: (s) => s.dungeonInRange !== false,
  hasProfession: (s) => s.hasProfession !== false,
  hasFishing: (s) => s.hasFishing !== false,
  hasCraftingProfession: (s) => s.hasCraftingProfession !== false,
  professionBelow300: (s) => s.professionBelow300 !== false,
  chars2: (s) => s.chars === undefined || s.chars >= 2,
  chars3: (s) => s.chars === undefined || s.chars >= 3,
  level20: (s) => {
    const level = s.highestToday ?? s.highest;
    return level === undefined || level >= 20;
  },
};

/** Whether a friend in this situation can do a goal. */
export function canDo(id: string, s: Situation = {}): boolean {
  const g = BY_ID.get(id);
  if (g === undefined) return false;
  return g.can === undefined ? true : CAN[g.can](s);
}

function replacement(id: string, s: Situation, taken: Set<string>, version: number): string | undefined {
  const g = BY_ID.get(id)!;
  for (const f of g.fallback ?? []) if (!taken.has(f) && canDo(f, s)) return f;
  const list = pool(g.slot, version);
  const start = list.lastIndexOf(id) + 1;
  for (let step = 1; step <= list.length; step++) {
    const candidate = list[(start + step - 1) % list.length]!;
    if (!taken.has(candidate) && candidate !== id && canDo(candidate, s)) return candidate;
  }
  return undefined;
}

function swapList(list: readonly string[], s: Situation, swapped: Record<string, string>, version: number) {
  const taken = new Set(list);
  return list.map((id) => {
    if (canDo(id, s)) return id;
    const next = replacement(id, s, taken, version);
    if (next === undefined) return id; // nothing fits: the original stays
    taken.add(next);
    swapped[next] = id;
    return next;
  });
}

export interface FriendSet {
  /** The 3 PvE dailies then the Skirmish (a day), or the 3 PvE weeklies then the Bounty (a week). */
  set: string[];
  /** New id -> the original it replaced. */
  swapped: Record<string, string>;
  /** The zone of the day (from the highest character that played that day, else the highest) or of the week. */
  zone?: string;
}

// ===== The schedule (WEB-78, addon CF-68) =====

/**
 * The site's changed days and weeks (the Mission pool): per day the 3 PvE dailies and the Skirmish, per week the 3 PvE
 * weeklies and the Bounty. Keys are day and week numbers as decimal strings. `v`: the site's time of its last change.
 */
export interface MissionSchedule {
  v: number;
  days?: Record<string, { daily?: string[]; skirmish?: string }>;
  weeks?: Record<string, { weekly?: string[]; bounty?: string }>;
}

/** Days from yesterday to 16 ahead, weeks from last week to 3 ahead: what a schedule may hold. */
export const SCHEDULE_DAYS = { before: 1, after: 16 } as const;
export const SCHEDULE_WEEKS = { before: 1, after: 3 } as const;

const SCHEDULE_ID = /^[A-Za-z0-9.]{1,24}$/;

function isTable(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function scheduleId(x: unknown): string | undefined {
  return typeof x === "string" && SCHEDULE_ID.test(x) ? x : undefined;
}

function scheduleList(x: unknown): string[] | undefined {
  if (!Array.isArray(x) || x.length !== 3) return undefined;
  const ids = x.map(scheduleId);
  if (ids.some((id) => id === undefined) || new Set(ids).size !== 3) return undefined;
  return ids as string[];
}

function scheduleKey(key: string, low: number, high: number): number | undefined {
  if (!/^-?\d+$/.test(key)) return undefined;
  const n = Number(key);
  return n >= low && n <= high ? n : undefined;
}

function checkPart<T extends object>(
  raw: unknown,
  low: number,
  high: number,
  list: string,
  single: string,
): Record<string, T> | undefined | null {
  if (raw === undefined) return undefined;
  if (!isTable(raw)) return null;
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(raw)) {
    const n = scheduleKey(key, low, high);
    if (n === undefined || !isTable(value)) continue;
    const entry: Record<string, unknown> = {};
    const ids = scheduleList(value[list]);
    if (ids !== undefined) entry[list] = ids;
    const id = scheduleId(value[single]);
    if (id !== undefined) entry[single] = id;
    if (Object.keys(entry).length > 0) out[String(n)] = entry as T;
  }
  return out;
}

/**
 * A schedule as received, checked (CF-68 "Check it"): undefined for a broken one; out-of-window days and weeks, broken
 * fields and unknown fields dropped. Ids are only checked for their form here: an id this version doesn't know falls
 * back when used.
 */
export function checkSchedule(raw: unknown, day: number, week: number): MissionSchedule | undefined {
  if (!isTable(raw)) return undefined;
  const v = raw.v;
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) return undefined;
  const days = checkPart<{ daily?: string[]; skirmish?: string }>(
    raw.days,
    day - SCHEDULE_DAYS.before,
    day + SCHEDULE_DAYS.after,
    "daily",
    "skirmish",
  );
  const weeks = checkPart<{ weekly?: string[]; bounty?: string }>(
    raw.weeks,
    week - SCHEDULE_WEEKS.before,
    week + SCHEDULE_WEEKS.after,
    "weekly",
    "bounty",
  );
  if (days === null || weeks === null) return undefined;
  const out: MissionSchedule = { v };
  if (days !== undefined && Object.keys(days).length > 0) out.days = days;
  if (weeks !== undefined && Object.keys(weeks).length > 0) out.weeks = weeks;
  return out;
}

function inPool(ids: readonly string[] | undefined, slot: GoalSlot, version: number): ids is string[] {
  if (ids === undefined) return false;
  const list = pool(slot, version);
  return ids.every((id) => list.includes(id));
}

/**
 * Day n's set before swaps with the schedule (CF-68 "Use it"): a listed slot takes the scheduled mission when this
 * version knows it (a list only when it knows all 3), else the normal draw's. The normal draw's chain never changes.
 */
export function scheduledDraw(n: number, schedule?: MissionSchedule, version = POOL_VERSION): DayDraw {
  const d = draw(n, version);
  const s = schedule?.days?.[String(n)];
  if (s === undefined) return d;
  const out: DayDraw = { ...d, dailies: inPool(s.daily, "daily", version) ? [...s.daily] : d.dailies };
  if (s.skirmish !== undefined && inPool([s.skirmish], "skirmish", version)) out.skirmish = s.skirmish;
  return out;
}

/** Week w's set before swaps with the schedule; as scheduledDraw. */
export function scheduledWeek(week: number, schedule?: MissionSchedule, version = POOL_VERSION): WeekDraw {
  const d = drawWeek(week, version);
  const s = schedule?.weeks?.[String(week)];
  if (s === undefined) return d;
  const out: WeekDraw = { ...d, weeklies: inPool(s.weekly, "weekly", version) ? [...s.weekly] : d.weeklies };
  if (s.bounty !== undefined && inPool([s.bounty], "bounty", version)) out.bounty = s.bounty;
  return out;
}

/** One friend's goals for day n. */
export function goalsForDay(
  n: number,
  s: Situation = {},
  version = POOL_VERSION,
  schedule?: MissionSchedule,
): FriendSet {
  const d = scheduledDraw(n, schedule, version);
  const swapped: Record<string, string> = {};
  const set = swapList(d.dailies, s, swapped, version);
  if (d.skirmish !== undefined) set.push(swapList([d.skirmish], s, swapped, version)[0]!);
  const zone = zoneFor(n, 4, s.highestToday ?? s.highest);
  return zone !== undefined ? { set, swapped, zone } : { set, swapped };
}

/** One friend's goals for a week. */
export function goalsForWeek(
  week: number,
  s: Situation = {},
  version = POOL_VERSION,
  schedule?: MissionSchedule,
): FriendSet {
  const d = scheduledWeek(week, schedule, version);
  const swapped: Record<string, string> = {};
  const set = swapList(d.weeklies, s, swapped, version);
  if (d.bounty !== undefined) set.push(swapList([d.bounty], s, swapped, version)[0]!);
  const zone = zoneFor(week, 5, s.highest);
  return zone !== undefined ? { set, swapped, zone } : { set, swapped };
}

// ===== Kill points =====

export interface Kill {
  t?: number;
  zone?: string;
  name?: string;
  /** -1 a skull. */
  lvl?: number;
  myLvl?: number;
  class?: string;
  race?: string;
  rank?: number;
  solo?: boolean;
  bg?: boolean;
  /** The killer's character (GUID). */
  char?: string;
}

/** Points of one counted kill. */
export function killValue(k: Kill): number {
  let points: number;
  if (k.lvl === -1) points = 3;
  else if (k.lvl === undefined || k.myLvl === undefined) points = 1;
  else {
    const diff = k.lvl - k.myLvl;
    points = diff <= -4 ? 0 : diff >= 3 ? 2 : 1;
  }
  return k.solo === true && points > 0 ? points + 1 : points;
}

export interface ScoredKill {
  kill: Kill;
  day: number;
  track: "pvp" | "bg";
  counted: boolean;
  points: number;
  reason?: "community" | "repeat";
}

/**
 * Scores one friend's kills in time order. Not counted: a victim of the community, the 4th and later kill of the same
 * victim name per track and day. Battleground kills score the same way on their own track.
 */
export function scoreKills(kills: readonly Kill[], s: Schedule, community: ReadonlySet<string>): ScoredKill[] {
  const sorted = kills.map((kill, index) => ({ kill, index }));
  sorted.sort((a, b) => (a.kill.t ?? 0) - (b.kill.t ?? 0) || a.index - b.index);
  const seen = new Map<string, number>();
  return sorted.map(({ kill: k }) => {
    const day = dayOf(k.t ?? 0, s);
    const track = k.bg === true ? "bg" : "pvp";
    if (k.name !== undefined && community.has(k.name)) {
      return { kill: k, day, track, counted: false, points: 0, reason: "community" as const };
    }
    const key = `${track}:${day}:${k.name}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (k.name !== undefined && n > SAME_VICTIM_LIMIT) {
      return { kill: k, day, track, counted: false, points: 0, reason: "repeat" as const };
    }
    return { kill: k, day, track, counted: true, points: killValue(k) };
  });
}

// ===== Duels =====

export interface DuelRecord {
  /** Person key of the friend who recorded it. */
  friend: string;
  t: number;
  won: boolean;
  /** The opponent's full character name. */
  vs: string;
}

export interface DuelResult {
  day: number;
  /** The pair, a < b. */
  a: string;
  b: string;
  winner?: string;
  disputed: boolean;
  /** When the first record of the pair that day was made. */
  t: number;
}

/**
 * The Duel slot: per day and pair of friends the first duel counts once (the earliest record of each side). Both
 * records agree: the winner 3, the loser 1. They disagree: disputed, nobody scores. One record: as recorded.
 * `owner`: full name -> friend, for the community characters of friends.
 */
export function duels(
  records: readonly DuelRecord[],
  owner: ReadonlyMap<string, string>,
  s: Schedule,
): { points: Record<string, number>; duels: DuelResult[] } {
  const pairs = new Map<string, { day: number; a: string; b: string; first: Map<string, DuelRecord> }>();
  for (const d of records) {
    const other = owner.get(d.vs);
    if (other === undefined || other === d.friend) continue;
    const day = dayOf(d.t, s);
    const [a, b] = other < d.friend ? [other, d.friend] : [d.friend, other];
    const key = `${day}\u0001${a}\u0001${b}`;
    let p = pairs.get(key);
    if (p === undefined) {
      p = { day, a, b, first: new Map() };
      pairs.set(key, p);
    }
    const mine = p.first.get(d.friend);
    if (mine === undefined || d.t < mine.t) p.first.set(d.friend, d);
  }
  const list: DuelResult[] = [];
  const points: Record<string, number> = {};
  for (const p of pairs.values()) {
    const ra = p.first.get(p.a);
    const rb = p.first.get(p.b);
    const t = Math.min(ra?.t ?? Infinity, rb?.t ?? Infinity);
    const aWonByA = ra?.won;
    const aWonByB = rb === undefined ? undefined : !rb.won;
    if (ra !== undefined && rb !== undefined && aWonByA !== aWonByB) {
      list.push({ day: p.day, a: p.a, b: p.b, disputed: true, t });
      continue;
    }
    const aWon = ra !== undefined ? aWonByA! : aWonByB!;
    const winner = aWon ? p.a : p.b;
    const loser = aWon ? p.b : p.a;
    points[winner] = (points[winner] ?? 0) + POINTS.duelWin;
    points[loser] = (points[loser] ?? 0) + POINTS.duelLoss;
    list.push({ day: p.day, a: p.a, b: p.b, winner, disputed: false, t });
  }
  list.sort((x, y) => x.day - y.day || cmp(x.a, y.a) || cmp(x.b, y.b));
  return { points, duels: list };
}

/** Plain code-unit order, as Lua compares strings. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ===== Points, crossing out, the crown, the streak =====

const TRACK: Record<GoalSlot, Track> = { daily: "pve", weekly: "pve", skirmish: "pvp", bounty: "pvp" };

/**
 * CF-69: the pool version a day's or week's points count in: the entry's own `pool` (recorded with its set), else the
 * friend's `goals.pool`, else 1 (an entry from before CF-69, or an older addon).
 */
export function entryPool(entry?: { pool?: unknown }, goalsPool?: unknown): number {
  const p = entry?.pool;
  if (typeof p === "number" && p >= 1) return p;
  if (typeof goalsPool === "number" && goalsPool >= 1) return goalsPool;
  return 1;
}

/**
 * CF-69: a done goal's points in pool version `pool`. Pool version 1 scores flat: 5 for a daily, the Skirmish and the
 * Hunt, 15 for a weekly and the Bounty. From pool version 2 the goal's own size, flat while it has none; the Hunt
 * stays 5. Undefined for an unknown id (a newer pool).
 */
export function pointsFor(id: string, pool = 1): number | undefined {
  if (id === "hunt") return POINTS.daily;
  const g = BY_ID.get(id);
  if (g === undefined) return undefined;
  if (pool >= 2 && g.points !== undefined) return g.points;
  return g.slot === "weekly" || g.slot === "bounty" ? POINTS.weekly : POINTS.daily;
}

/**
 * The track and points of a done goal ("hunt" is a PvP daily) in pool version `pool`; undefined for an unknown id (a
 * newer pool).
 */
export function goalPoints(id: string, pool = 1): { track: Track; points: number } | undefined {
  const points = pointsFor(id, pool);
  if (points === undefined) return undefined;
  return { track: id === "hunt" ? "pvp" : TRACK[BY_ID.get(id)!.slot], points };
}

/**
 * A friend's points for done goals (days and weeks merged, all of one pool version: `pool`), plus kill and duel points
 * on PvP. Goals of a newer pool (unknown ids) count nothing.
 */
export function points(
  done: Readonly<Record<string, number>>,
  killPoints = 0,
  duelPoints = 0,
  pool = 1,
): { pve: number; pvp: number } {
  const total = { pve: 0, pvp: killPoints + duelPoints };
  for (const id of Object.keys(done)) {
    const p = goalPoints(id, pool);
    if (p !== undefined) total[p.track] += p.points;
  }
  return total;
}

/** Every PvE daily of the day's set is done (the PvP goals don't count). */
export function crossedOut(set: readonly string[], done: Readonly<Record<string, number>>): boolean {
  let dailies = 0;
  for (const id of set) {
    if (BY_ID.get(id)?.slot !== "daily") continue;
    dailies++;
    if (done[id] === undefined) return false;
  }
  return dailies > 0;
}

/** When a friend crossed out (the last of the PvE dailies), or undefined. */
export function finishedAt(set: readonly string[], done: Readonly<Record<string, number>>): number | undefined {
  if (!crossedOut(set, done)) return undefined;
  let last = 0;
  for (const id of set) if (BY_ID.get(id)?.slot === "daily") last = Math.max(last, done[id]!);
  return last;
}

/** The crown of a day: the first to cross out; on equal times the lower friend key. */
export function crown(
  friends: readonly { friend: string; set: readonly string[]; done: Readonly<Record<string, number>> }[],
): { friend: string; at: number } | undefined {
  let best: { friend: string; at: number } | undefined;
  for (const f of friends) {
    const at = finishedAt(f.set, f.done);
    if (at === undefined) continue;
    if (best === undefined || at < best.at || (at === best.at && f.friend < best.friend))
      best = { friend: f.friend, at };
  }
  return best;
}

/**
 * The streak on `today`: days in a row with at least one goal done. Today without one yet doesn't end it. best: the
 * longest run in `days`, at least `storedBest`.
 */
export function streak(
  days: Readonly<Record<number, number>>,
  today: number,
  storedBest = 0,
): { streak: number; best: number } {
  const has = (n: number) => (days[n] ?? 0) > 0;
  let current = 0;
  for (let n = has(today) ? today : today - 1; has(n); n--) current++;
  let best = storedBest;
  let run = 0;
  let last: number | undefined;
  for (const day of Object.keys(days)
    .map(Number)
    .filter(has)
    .sort((a, b) => a - b)) {
    run = last === day - 1 ? run + 1 : 1;
    last = day;
    best = Math.max(best, run);
  }
  return { streak: current, best: Math.max(best, current) };
}

// ===== Ladder =====

export interface LadderInput {
  friend: string;
  name?: string;
  pve: number;
  pvp: number;
  /** Goals done this week. */
  goals: number;
  /** Counted kills this week. */
  kills: number;
  /** Any kill on any character, ever. */
  killedEver: boolean;
}

export interface LadderRank {
  friend: string;
  rank: number;
  points: number;
  /** Positions gained since last week (negative: lost); "new" when not ranked last week. */
  move: number | "new";
}

/**
 * The week's ladder, one ranking per track. PvE ties: more goals done, then the name. PvP: PvP Virgins aren't ranked;
 * ties: more goals done, then more counted kills, then the name.
 */
export function ladder(
  friends: readonly LadderInput[],
  previous: { pve?: Readonly<Record<string, number>>; pvp?: Readonly<Record<string, number>> } = {},
): { pve: LadderRank[]; pvp: LadderRank[]; virgins: string[] } {
  const rank = (track: Track, list: LadderInput[]): LadderRank[] => {
    list.sort(
      (a, b) =>
        b[track] - a[track] ||
        b.goals - a.goals ||
        (track === "pvp" ? b.kills - a.kills : 0) ||
        cmp(a.name ?? a.friend, b.name ?? b.friend),
    );
    return list.map((f, i) => {
      const before = previous[track]?.[f.friend];
      return { friend: f.friend, rank: i + 1, points: f[track], move: before !== undefined ? before - (i + 1) : "new" };
    });
  };
  const pve = friends.map((f) => ({ ...f }));
  const pvp = pve.filter((f) => f.killedEver);
  const virgins = pve
    .filter((f) => !f.killedEver)
    .map((f) => f.friend)
    .sort(cmp);
  return { pve: rank("pve", pve), pvp: rank("pvp", pvp), virgins };
}

// ===== Elo (site and bot only, DOOMSDAY.md "Ladder") =====

export const ELO_START = 1000;
export const ELO_K = 32;

/** Elo ratings from duels in time order (start 1000, K = 32), disputed ones left out. */
export function elo(results: readonly DuelResult[]): Record<string, number> {
  const rating: Record<string, number> = {};
  const sorted = [...results].sort((x, y) => x.t - y.t || x.day - y.day || cmp(x.a, y.a) || cmp(x.b, y.b));
  for (const d of sorted) {
    if (d.disputed || d.winner === undefined) continue;
    const ra = rating[d.a] ?? ELO_START;
    const rb = rating[d.b] ?? ELO_START;
    const expectA = 1 / (1 + 10 ** ((rb - ra) / 400));
    const scoreA = d.winner === d.a ? 1 : 0;
    rating[d.a] = ra + ELO_K * (scoreA - expectA);
    rating[d.b] = rb + ELO_K * (1 - scoreA - (1 - expectA));
  }
  return rating;
}

/**
 * A goal's short label (the catalogue's `short`, the same as the addon's, DOOMSDAY.md "Short labels (CF-61)"), for a
 * column title where the full text doesn't fit (the bot's board image, WEB-66). The Hunt is "Hunt", a goal from a newer
 * addon "New goal".
 */
export function shortLabel(id: string): string {
  if (id.startsWith("hunt")) return "Hunt";
  return BY_ID.get(id)?.short ?? "New goal";
}

/**
 * Bosses per dungeon for `w.fullClear`, by the instance name the feed stores. Source: the addon's `Goals.BOSSES`
 * (src/core/Goals.lua, from the game's DungeonEncounter table, Classic Era, checked 2026-10-28). Dungeons with wings or
 * optional bosses (Scarlet Monastery, Blackrock Spire, Dire Maul, Stratholme, Scholomance, Blackfathom Deeps, Sunken
 * Temple) and Forever's new dungeons wait for counts from launch, as in the addon; no progress shows for them.
 */
export const DUNGEON_BOSSES: Readonly<Record<string, number>> = {
  "Ragefire Chasm": 4,
  "Wailing Caverns": 8,
  "The Deadmines": 7,
  Deadmines: 7,
  "Shadowfang Keep": 8,
  "The Stockade": 5,
  "Stormwind Stockade": 5,
  Gnomeregan: 5,
  "Razorfen Kraul": 6,
  "Razorfen Downs": 6,
  Uldaman: 8,
  "Zul'Farrak": 8,
  Maraudon: 8,
  "Blackrock Depths": 21,
};
