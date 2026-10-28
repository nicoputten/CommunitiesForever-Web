import type { LuaChunk, LuaValue } from "./lua";
import { bool, dict, entries, field, findGlobal, list, num, str, table, type Table } from "./normalize";
import { stripEscapes } from "./sanitize";

// The addon's activity feed (CF-22, CF-23; addon docs/ARCHITECTURE.md "Feed"), read for the weekly recap (WEB-41):
// per realm day (days since 1970-01-01) and character, what happened that day. The addon keeps the last 7 realm days
// only, so the site stores every day it sees (src/server/history.ts). Untrusted like the rest of the file: every
// field may be missing or wrong (then left out), every string loses WoW escapes.

/** A dungeon, raid or battleground run of that day (CF-23). */
export interface FeedRun {
  name?: string;
  kind?: string;
  bosses?: number;
  won?: boolean;
  /** GUIDs of community members in the group. */
  with: string[];
}

/** One character's day. */
export interface FeedDay {
  name?: string;
  classFile?: string;
  /** Unix seconds of the last activity that day. */
  at?: number;
  levelFrom?: number;
  levelTo?: number;
  /** Quests completed per zone. */
  quests: Record<string, number>;
  /** Profession rank reached that day, by profession name. */
  ranks: Record<string, number>;
  /** Professions learned that day. */
  learned: string[];
  runs: FeedRun[];
}

/** One person's feed: `shared` false when they turned "Share my activity" off (the addon sends `feed = false`). */
export interface PersonFeed {
  /** Person key, as in the dataset (BattleTag, or "aid:…"). */
  owner: string;
  shared: boolean;
  /** Realm day -> GUID -> the character's day. */
  days: Record<number, Record<string, FeedDay>>;
}

/** Realm days the site accepts: 2020 to 2100 (days since 1970-01-01). */
const FIRST_DAY = 18262;
const LAST_DAY = 47482;

function counts(t: Table | undefined): Record<string, number> {
  const out = dict<number>();
  for (const [key, value] of entries(t)) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) out[stripEscapes(key)] = value;
  }
  return out;
}

function readDay(t: Table): FeedDay {
  const learned: string[] = [];
  for (const [key, value] of entries(table(field(t, "learned")))) {
    if (value === true) learned.push(stripEscapes(key));
  }
  const runs: FeedRun[] = [];
  for (const value of list(table(field(t, "runs")))) {
    const run = table(value);
    if (run === undefined) continue;
    const withGuids = list(table(field(run, "with"))).filter((g): g is string => typeof g === "string");
    runs.push(
      strip({
        name: str(run, "name"),
        kind: str(run, "kind"),
        bosses: num(run, "bosses"),
        won: bool(run, "won"),
        with: withGuids,
      }),
    );
  }
  return strip({
    name: str(t, "name"),
    classFile: str(t, "classFile"),
    at: num(t, "at"),
    levelFrom: num(t, "levelFrom"),
    levelTo: num(t, "levelTo"),
    quests: counts(table(field(t, "quests"))),
    ranks: counts(table(field(t, "ranks"))),
    learned,
    runs,
  });
}

function strip<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

function readFeed(owner: string, value: LuaValue | undefined): PersonFeed | undefined {
  if (value === false) return { owner, shared: false, days: {} };
  const feed = table(value);
  if (feed === undefined) return undefined;
  const days: PersonFeed["days"] = {};
  for (const [dayKey, chars] of entries(feed)) {
    const day = Number(dayKey);
    if (!Number.isInteger(day) || day < FIRST_DAY || day > LAST_DAY) continue;
    const perChar = dict<FeedDay>();
    for (const [guid, entry] of entries(table(chars))) {
      const t = table(entry);
      if (t !== undefined && guid !== "") perChar[guid] = readDay(t);
    }
    if (Object.keys(perChar).length > 0) days[day] = perChar;
  }
  return { owner, shared: true, days };
}

/**
 * Every feed in a SavedVariables file: the uploader's own (`self.feed`) and each friend's (`people[bt].feed`). A
 * person whose record has no feed field is left out (an older addon, or nothing to share yet).
 */
export function readFeeds(chunk: LuaChunk): PersonFeed[] {
  const global = findGlobal(chunk);
  if (global === undefined) return [];
  const out: PersonFeed[] = [];
  const self = table(field(global, "self"));
  // The same person keys as normalize(): the uploader's BattleTag (or "aid:…"), friends by their `people` key.
  const accountId = str(self, "accountId");
  const selfKey =
    str(self, "battleTag") ??
    (accountId !== undefined ? `aid:${accountId}` : self !== undefined ? "uploader" : undefined);
  if (self !== undefined && selfKey !== undefined) {
    const own = readFeed(selfKey, field(self, "feed"));
    if (own !== undefined) out.push(own);
  }
  for (const [key, value] of entries(table(field(global, "people")))) {
    const record = table(value);
    if (record === undefined || key === selfKey) continue;
    const feed = readFeed(key, field(record, "feed"));
    if (feed !== undefined) out.push(feed);
  }
  return out;
}
