import type { LuaChunk, LuaValue } from "../lua";
import { dict, entries, field, findGlobal, list, num, str, table, type Table } from "../normalize";
import { stripEscapes } from "../sanitize";

// The goals a friend's addon recorded done (addon CF-56; docs/DOOMSDAY.md "Who decides done"): per Doomsday day and
// week the drawn set, the swaps, and each goal done with its time, plus the streak. The addon decides; the site
// stores (src/server/doomsday.ts) and counts. Untrusted like the rest of the file, cleaned and capped as the addon
// cleans what it receives. An upload holds the last 7 days and 2 weeks; the site keeps every one it sees.

/** One Doomsday day or week as the addon recorded it. */
export interface GoalRecord {
  /** The goal ids drawn for this friend, swaps applied, in slot order. */
  set: string[];
  /** Swapped goal id -> the original it replaced. */
  swapped: Record<string, string>;
  /** Goal id -> when it was done (Unix seconds). */
  done: Record<string, number>;
  /** When the addon last changed this day or week: the newer one wins. */
  at?: number;
}

/** One person's goals from one upload. */
export interface PersonGoals {
  /** Person key, as in the dataset (BattleTag, or "aid:…"). */
  owner: string;
  /** Doomsday day number -> the day. */
  days: Record<number, GoalRecord>;
  /** Doomsday week number -> the week. */
  weeks: Record<number, GoalRecord>;
  streak?: number;
  best?: number;
  /** The addon's `Doomsday.POOL_VERSION`. */
  pool?: number;
  /** The reset the addon used, in seconds after midnight realm time. */
  reset?: number;
}

/** Goal ids are at most this long (CF-56). */
export const MAX_GOAL_ID = 24;
/** A day has 5 slots (3 PvE dailies, the Hunt, the Skirmish), a week 4 (3 PvE weeklies, the bounty). */
const MAX_DAY_SET = 5;
const MAX_WEEK_SET = 4;
/** Days and weeks the site accepts: as the feed's realm days, 2020 to 2100. */
const FIRST_DAY = 18262;
const LAST_DAY = 47482;
const FIRST_WEEK = Math.floor((FIRST_DAY + 4) / 7);
const LAST_WEEK = Math.floor((LAST_DAY + 4) / 7);
const SECONDS_PER_DAY = 86400;

function count(t: Table | undefined, key: string): number | undefined {
  const v = num(t, key);
  return v !== undefined && v >= 0 ? v : undefined;
}

function goalId(value: LuaValue | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const id = stripEscapes(value);
  return id !== "" && id.length <= MAX_GOAL_ID ? id : undefined;
}

function readRecord(t: Table, maxSet: number): GoalRecord {
  const set: string[] = [];
  for (const v of list(table(field(t, "set")))) {
    const id = goalId(v);
    if (id !== undefined && !set.includes(id)) set.push(id);
    if (set.length >= maxSet) break;
  }
  const swapped = dict<string>();
  for (const [key, v] of entries(table(field(t, "swapped")))) {
    const id = goalId(key);
    const original = goalId(v);
    if (id !== undefined && original !== undefined && Object.keys(swapped).length < maxSet) swapped[id] = original;
  }
  const done = dict<number>();
  for (const [key, v] of entries(table(field(t, "done")))) {
    const id = goalId(key);
    if (id !== undefined && typeof v === "number" && Number.isFinite(v) && v >= 0) done[id] = v;
    if (Object.keys(done).length >= maxSet) break;
  }
  const record: GoalRecord = { set, swapped, done };
  const at = count(t, "at");
  if (at !== undefined) record.at = at;
  return record;
}

function readPeriods(value: LuaValue | undefined, first: number, last: number, maxSet: number) {
  const out: Record<number, GoalRecord> = {};
  for (const [key, v] of entries(table(value))) {
    const n = Number(key);
    const t = table(v);
    if (Number.isInteger(n) && n >= first && n <= last && t !== undefined) out[n] = readRecord(t, maxSet);
  }
  return out;
}

/** The streak: a number, or the addon's stored `{ n, last }`. */
function streakOf(value: LuaValue | undefined): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : undefined;
  return count(table(value), "n");
}

/**
 * A person's `goals`. `goals = false` came from addons with "Share my activity" off; that setting is gone (Nico,
 * 2026-10-28), so false means nothing was sent, like a missing field, and the stored goals stay.
 */
function readGoals(owner: string, value: LuaValue | undefined): PersonGoals | undefined {
  const t = table(value);
  if (t === undefined) return undefined;
  const goals: PersonGoals = {
    owner,
    days: readPeriods(field(t, "days"), FIRST_DAY, LAST_DAY, MAX_DAY_SET),
    weeks: readPeriods(field(t, "weeks"), FIRST_WEEK, LAST_WEEK, MAX_WEEK_SET),
  };
  const streak = streakOf(field(t, "streak"));
  const best = count(t, "best");
  const pool = count(t, "pool");
  const reset = count(t, "reset");
  if (streak !== undefined) goals.streak = streak;
  if (best !== undefined) goals.best = best;
  if (pool !== undefined) goals.pool = pool;
  if (reset !== undefined && reset < SECONDS_PER_DAY) goals.reset = reset;
  return goals;
}

/**
 * Every person's goals in a SavedVariables file: the uploader's own (`self.goals`) and each friend's
 * (`people[bt].goals`). A person without the field is left out (an addon before CF-56).
 */
export function readAllGoals(chunk: LuaChunk): PersonGoals[] {
  const global = findGlobal(chunk);
  if (global === undefined) return [];
  const out: PersonGoals[] = [];
  const self = table(field(global, "self"));
  // The same person keys as normalize() and readFeeds().
  const accountId = str(self, "accountId");
  const selfKey =
    str(self, "battleTag") ??
    (accountId !== undefined ? `aid:${accountId}` : self !== undefined ? "uploader" : undefined);
  if (self !== undefined && selfKey !== undefined) {
    const own = readGoals(selfKey, field(self, "goals"));
    if (own !== undefined) out.push(own);
  }
  for (const [key, value] of entries(table(field(global, "people")))) {
    const record = table(value);
    if (record === undefined || key === selfKey) continue;
    const goals = readGoals(key, field(record, "goals"));
    if (goals !== undefined) out.push(goals);
  }
  return out;
}
