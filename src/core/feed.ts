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

/** A death (CF-52): when, where and of what. */
export interface FeedDeath {
  t?: number;
  zone?: string;
  cause: DeathCause;
}

/** A finished duel (CF-52): `vs` is the opponent's full name as the game gives it (never split). */
export interface FeedDuel {
  t?: number;
  won?: boolean;
  vs?: string;
}

/** An epic item received (CF-53): its equip slot as the game's `INVTYPE_*` token, the character's level then. */
export interface FeedEpic {
  id?: number;
  name?: string;
  slot?: string;
  level?: number;
}

/** A play session (CF-53): login to logout, server time. */
export interface FeedSession {
  from?: number;
  to?: number;
}

/** One honorable kill (CF-55). Each victim field only when the addon could read it; `lvl` -1 is a skull. */
export interface FeedPvpKill {
  t?: number;
  zone?: string;
  name?: string;
  lvl?: number;
  myLvl?: number;
  class?: string;
  race?: string;
  rank?: number;
  solo?: boolean;
  bg?: boolean;
}

/** A death's cause as the addon stores it (CF-52); anything else becomes `other`, as the addon cleans it. */
export const DEATH_CAUSES = ["fall", "fire", "lava", "drown", "fatigue", "player", "creature", "other"] as const;
export type DeathCause = (typeof DEATH_CAUSES)[number];

/** One character's day. The fields from CF-52, CF-53 and CF-55 are missing in older addons' feeds. */
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
  /** CF-52: honorable kills per zone (every kill, also past the `pvpKills` cap). */
  kills?: Record<string, number>;
  deaths?: FeedDeath[];
  duels?: FeedDuel[];
  /** CF-53: rare (blue) items received, and each epic. */
  loot?: { rare?: number; epic: FeedEpic[] };
  /** CF-53: items of the addon's watch list looted or created, by item id. */
  notable?: Record<string, number>;
  /** CF-53: copper in and out that day. Never shown as an amount: only compared. */
  gold?: { gained?: number; spent?: number };
  sessions?: FeedSession[];
  /** CF-53: GUIDs of community characters grouped with that day. */
  groups?: string[];
  /** CF-55: each honorable kill. */
  pvpKills?: FeedPvpKill[];
}

/** One person's feed. */
export interface PersonFeed {
  /** Person key, as in the dataset (BattleTag, or "aid:…"). */
  owner: string;
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

// Caps as the addon's (CF-52, CF-53, CF-55): a list longer than the addon writes is cut, not refused.
const MAX_DEATHS = 50;
const MAX_DUELS = 50;
const MAX_EPICS = 50;
const MAX_SESSIONS = 50;
const MAX_GROUPS = 40;
const MAX_PVP_KILLS = 100;
/** Longest text kept from a victim or item field. */
const MAX_TEXT = 64;

const count = (t: Table | undefined, key: string) => {
  const v = num(t, key);
  return v !== undefined && v >= 0 ? v : undefined;
};

const text = (t: Table | undefined, key: string) => {
  const v = str(t, key);
  return v !== undefined && v !== "" ? v.slice(0, MAX_TEXT) : undefined;
};

/** The tables of a Lua list, at most `max`. */
function tables(value: LuaValue | undefined, max: number): Table[] {
  const out: Table[] = [];
  for (const v of list(table(value))) {
    const t = table(v);
    if (t !== undefined) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function readDeath(t: Table): FeedDeath {
  const cause = str(t, "cause");
  return strip({
    t: count(t, "t"),
    zone: text(t, "zone"),
    cause: DEATH_CAUSES.find((c) => c === cause) ?? "other",
  });
}

function readPvpKill(t: Table): FeedPvpKill {
  const lvl = num(t, "lvl");
  return strip({
    t: count(t, "t"),
    zone: text(t, "zone"),
    name: text(t, "name"),
    lvl: lvl !== undefined && lvl >= -1 ? lvl : undefined,
    myLvl: count(t, "myLvl"),
    class: text(t, "class"),
    race: text(t, "race"),
    rank: count(t, "rank"),
    solo: bool(t, "solo"),
    bg: bool(t, "bg"),
  });
}

/** The CF-52, CF-53 and CF-55 fields of a day; each left out when the addon didn't send it. */
function readDoomsdayFields(t: Table): Partial<FeedDay> {
  const loot = table(field(t, "loot"));
  const gold = table(field(t, "gold"));
  const groups = table(field(t, "groups"));
  return strip({
    kills: table(field(t, "kills")) !== undefined ? counts(table(field(t, "kills"))) : undefined,
    deaths: field(t, "deaths") !== undefined ? tables(field(t, "deaths"), MAX_DEATHS).map(readDeath) : undefined,
    duels:
      field(t, "duels") !== undefined
        ? tables(field(t, "duels"), MAX_DUELS).map((d) =>
            strip({ t: count(d, "t"), won: bool(d, "won"), vs: text(d, "vs") }),
          )
        : undefined,
    loot:
      loot !== undefined
        ? strip({
            rare: count(loot, "rare"),
            epic: tables(field(loot, "epic"), MAX_EPICS).map((e) =>
              strip({ id: count(e, "id"), name: text(e, "name"), slot: text(e, "slot"), level: count(e, "level") }),
            ),
          })
        : undefined,
    notable: table(field(t, "notable")) !== undefined ? counts(table(field(t, "notable"))) : undefined,
    gold: gold !== undefined ? strip({ gained: count(gold, "gained"), spent: count(gold, "spent") }) : undefined,
    sessions:
      field(t, "sessions") !== undefined
        ? tables(field(t, "sessions"), MAX_SESSIONS).map((s) => strip({ from: count(s, "from"), to: count(s, "to") }))
        : undefined,
    groups:
      groups !== undefined
        ? entries(groups)
            .filter(([guid, v]) => v === true && guid !== "")
            .map(([guid]) => stripEscapes(guid))
            .slice(0, MAX_GROUPS)
        : undefined,
    pvpKills:
      field(t, "pvpKills") !== undefined ? tables(field(t, "pvpKills"), MAX_PVP_KILLS).map(readPvpKill) : undefined,
  });
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
    ...readDoomsdayFields(t),
  });
}

function strip<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

/**
 * A person's feed. `feed = false` came from addons with "Share my activity" off; that setting is gone (Nico,
 * 2026-10-28): false now means nothing was sent, like a missing feed, so the stored days stay.
 */
function readFeed(owner: string, value: LuaValue | undefined): PersonFeed | undefined {
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
  return { owner, days };
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
