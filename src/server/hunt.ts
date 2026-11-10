import { and, desc, eq, gte } from "drizzle-orm";
import { scheduleAt } from "@/core/doomsday/engine";
import type { Dataset } from "@/core/model";
import {
  type Census,
  censusInfo,
  comboIds,
  FACTIONS,
  friendHunt,
  groupHunted,
  groupHunters,
  type HuntEntry,
  type HuntFriend,
  huntDay,
  huntedBy,
  huntFeats,
  huntKills,
  huntLocked,
  type HuntPick,
  type HuntPlannedDay,
  type HuntVictim,
  huntTargetsView,
  huntToday,
  huntWeek,
  mergeCensus,
  NO_REPEAT_DAYS,
  parseCensusImport,
  parsePopulation,
  planHunts,
  rareTargets,
  scheduleHuntDays,
  targetDone,
  targetOf,
} from "@/core/doomsday/hunt";
import { CALENDAR_DAYS, PLAN_DAYS, type ScheduleHunt } from "@/core/doomsday/missionPool";
import { dayRecipes, recipeTiles, themeCards } from "@/core/views/pool6Page";
import type { GoalRecord } from "@/core/doomsday/record";
import { dayOf, dayStart, draw, enemyOf, type Faction, POOL_VERSION, type Schedule } from "@/core/doomsday/rules";
import type {
  DayRecipeView,
  FriendHuntView,
  HuntDay,
  RecipeTileView,
  ThemeCardView,
  HuntFeatProgress,
  HuntKill,
  HuntTargetsView,
  HuntTodayView,
  HuntWeekRow,
} from "@/core/views/pool6";
import { AccessError } from "./access";
import { logChange, requireOwner } from "./admins";
import type { Db } from "./db";
import { doomsdayGoals, feedDays, huntCensus, huntCensusFetch, huntPins, huntPlan, missionSettings } from "./db/schema";
import { doomsdayResetSetting, getBotSettings } from "./discord";
import { missionPool, type MissionPoolData } from "./missionPool";
import { loadState as loadUploads } from "./uploads";

// The Hunt from pool version 6 (WEB-108): the daily census from Everloot, the owner's switches, pins and imports, the
// drawn quarries (src/core/doomsday/hunt.ts) and what the pages read. The census is fetched once per realm day, before
// the day's draw (instrumentation.ts runs runDueCensus every minute); when it can't be fetched the last stored census
// is used and the failure logged. The quarries are stored: today and tomorrow are frozen, the free days are drawn
// again with each new census and each owner change.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Everloot's population tool over plain HTTP (https://everloot.app/docs/api: `/api/tools/{tool}`, GET).
 * EVERLOOT_API_URL replaces the origin (tests: an address that refuses, so nothing is ever fetched).
 */
export function populationUrl(): string {
  const base = process.env.EVERLOOT_API_URL;
  return `${base !== undefined && base !== "" ? base.replace(/\/$/, "") : "https://everloot.app"}/api/tools/population`;
}
/**
 * The classes the census is asked for, one call per hunted faction and class: 18 calls a day, 9 when the group hunts
 * one faction (WEB-112).
 */
const CENSUS_CLASSES = ["Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Shaman", "Mage", "Warlock", "Druid"];
/** One call's time limit. */
const FETCH_TIMEOUT_MS = 15_000;

function clock(db: Db | Tx, now: number): { s: Required<Schedule>; today: number } {
  const settings = getBotSettings(db);
  const s = scheduleAt(settings.realmTimeZone, doomsdayResetSetting(settings), now);
  return { s, today: dayOf(now, s) };
}

// --- the census --------------------------------------------------------------------------------------------------

/** The newest stored census and when it was stored; undefined before the first. */
export function latestCensus(db: Db | Tx): { census: Census; at: number } | undefined {
  const row = db.select().from(huntCensus).orderBy(desc(huntCensus.at), desc(huntCensus.id)).limit(1).get();
  return row === undefined ? undefined : { census: row.data, at: row.at };
}

/** Whether today's fetch failed, so the census shown is the last stored one. */
function censusStale(db: Db | Tx, today: number): boolean {
  const row = db.select().from(huntCensusFetch).where(eq(huntCensusFetch.day, today)).get();
  return row !== undefined && !row.ok;
}

export type Fetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * Everloot's census: the population tool's race-and-class counts (window: active in the last 7 days), one call per
 * hunted faction and class, with the API key as a Bearer token (never logged, never sent elsewhere). Only the factions
 * the group hunts (`groupHunted`, WEB-112): the other's targets have no counts then, and its draw (still made, the
 * addon's schedule has both) takes every target alike. Sequential, and it stops at the first refusal (429: Everloot's
 * limit; the next day tries again). Throws when no part came back.
 */
export async function fetchCensus(
  fetchImpl: Fetch,
  apiKey: string | undefined,
  hunted: readonly Faction[] = FACTIONS,
): Promise<Census> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (apiKey !== undefined && apiKey !== "") headers.authorization = `Bearer ${apiKey}`;
  const parts: Census[] = [];
  for (const faction of FACTIONS.filter((f) => hunted.includes(f))) {
    for (const cls of CENSUS_CLASSES) {
      const url = `${populationUrl()}?${new URLSearchParams({ faction, class: cls, window: "week" })}`;
      const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Everloot census: HTTP ${res.status}`);
      const part = parsePopulation(await res.json());
      if (part === undefined) throw new Error("Everloot census: not a population answer");
      parts.push(part);
    }
  }
  const census = mergeCensus(parts);
  if (census === undefined) throw new Error("Everloot census: no answer");
  return census;
}

function storeCensus(tx: Db | Tx, census: Census, day: number, now: number, by?: string): void {
  tx.insert(huntCensus)
    .values({ day, at: now, source: census.source, data: census, by: by ?? null })
    .run();
}

let running = false;

/**
 * The daily census: once per realm day, before the day's draw. On success it is stored and the free days are drawn
 * again with it; on failure the last stored census stays and the failure is logged (no key, no response text).
 * Without EVERLOOT_API_KEY it still tries Everloot's keyless allowance. Returns whether it ran.
 */
export async function runDueCensus(
  db: Db,
  now: number,
  fetchImpl: Fetch = fetch as unknown as Fetch,
  apiKey: string | undefined = process.env.EVERLOOT_API_KEY,
): Promise<boolean> {
  if (running) return false;
  const { today } = clock(db, now);
  if (db.select().from(huntCensusFetch).where(eq(huntCensusFetch.day, today)).get() !== undefined) return false;
  running = true;
  try {
    // Marked first, so a slow or failing fetch is tried once a day, never every minute.
    db.insert(huntCensusFetch).values({ day: today, at: now, ok: false, error: "running" }).run();
    let census: Census | undefined;
    let error: string | undefined;
    try {
      census = await fetchCensus(fetchImpl, apiKey, groupHunted(loadUploads(db)?.data));
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 200) : "failed";
    }
    db.transaction((tx) => {
      if (census !== undefined) {
        storeCensus(tx, census, today, now);
        storeHuntPlan(tx, now, true);
      } else {
        storeHuntPlan(tx, now);
      }
      tx.update(huntCensusFetch)
        .set({ ok: census !== undefined, error: error ?? null })
        .where(eq(huntCensusFetch.day, today))
        .run();
    });
    if (error !== undefined) console.warn(`hunt: census not fetched (${error}); using the last stored census`);
    return true;
  } finally {
    running = false;
  }
}

/** The owner's manual import (the Hunt targets page): stored like a fetch, and the free days drawn again. */
export function importCensus(db: Db, by: string, text: string, now: number, owner?: string): Census {
  const parsed = parseCensusImport(text, now);
  if ("error" in parsed) throw new AccessError(`${parsed.error} Nothing was changed.`);
  db.transaction((tx) => {
    requireOwner(tx, by, owner);
    storeCensus(tx, parsed, clock(tx, now).today, now, by);
    storeHuntPlan(tx, now, true);
    logChange(tx, by, "censusImported", now);
  });
  return parsed;
}

// --- the plan ----------------------------------------------------------------------------------------------------

/**
 * Targets the owner switched off on the Hunt targets grid: `mission_settings` rows with id "hunt:<raceId>:<classId>"
 * (WEB-109's setHuntTarget). A free day with such a target is drawn again.
 */
export const HUNT_SETTING = "hunt:";

function offTargets(db: Db | Tx): Set<string> {
  return new Set(
    db
      .select()
      .from(missionSettings)
      .all()
      .filter((r) => r.off && r.id.startsWith(HUNT_SETTING))
      .map((r) => r.id.slice(HUNT_SETTING.length)),
  );
}

function picks(rows: readonly { n: number; faction: Faction; key: string }[]): Record<number, HuntPick> {
  const out: Record<number, HuntPick> = {};
  for (const r of rows) (out[r.n] ??= {})[r.faction] = r.key;
  return out;
}

/** The planned days: yesterday to 16 days ahead, as the missions (missionPool.ts window). */
function windowDays(today: number): number[] {
  const out: number[] = [];
  for (let n = today - 1; n < today + PLAN_DAYS; n++) out.push(n);
  return out;
}

/** The Hunt over the window at `now`, as computed (not stored). */
export function huntPlanAt(db: Db | Tx, now: number, recompute = false): HuntPlannedDay[] {
  const { today } = clock(db, now);
  const from = today - 1 - NO_REPEAT_DAYS;
  const stored = picks(db.select().from(huntPlan).where(gte(huntPlan.n, from)).all());
  const pins = picks(db.select().from(huntPins).where(gte(huntPins.n, today)).all());
  const latest = latestCensus(db);
  return planHunts(
    {
      today,
      days: windowDays(today),
      stored,
      pins,
      off: offTargets(db),
      ...(latest !== undefined ? { census: latest.census } : {}),
    },
    recompute,
  );
}

/** Computes the Hunt and stores what changed (a day that entered the window is drawn once; locked days stay). */
export function storeHuntPlan(tx: Db | Tx, now: number, recompute = false): HuntPlannedDay[] {
  const plan = huntPlanAt(tx, now, recompute);
  for (const d of plan) {
    for (const f of FACTIONS) {
      const key = d.pick[f];
      if (key === undefined) continue;
      const where = and(eq(huntPlan.n, d.n), eq(huntPlan.faction, f));
      const old = tx.select({ key: huntPlan.key }).from(huntPlan).where(where).get();
      if (old?.key === key) continue;
      tx.insert(huntPlan)
        .values({ n: d.n, faction: f, key, at: now })
        .onConflictDoUpdate({ target: [huntPlan.n, huntPlan.faction], set: { key, at: now } })
        .run();
    }
  }
  return plan;
}

/** The schedule's Hunt part (runs answer): the stored plan, the rare targets, the census. Stores days new to it. */
export function scheduleHunt(db: Db | Tx, now: number): ScheduleHunt {
  const plan = storeHuntPlan(db, now);
  const latest = latestCensus(db);
  const out: ScheduleHunt = { days: scheduleHuntDays(plan), rare: rareTargets(latest?.census) };
  if (latest !== undefined) {
    const census: { at: number; characters?: number } = { at: latest.census.asOf || latest.at };
    if (latest.census.characters !== undefined) census.characters = latest.census.characters;
    out.census = census;
  }
  return out;
}

function checkFaction(f: string): Faction {
  if (f !== "Alliance" && f !== "Horde") throw new AccessError("No such faction.");
  return f;
}

/**
 * Pins a day's quarry for a hunted faction in the day editor (`key` undefined: unpins). Owner only, free days only. A
 * pin wins over the census, the switches and the 7-day rule.
 */
export function pinHunt(
  db: Db,
  by: string,
  n: number,
  faction: string,
  key: string | undefined,
  now: number,
  owner?: string,
): void {
  const f = checkFaction(faction);
  if (key !== undefined && targetOf(key)?.faction !== f) throw new AccessError("That target doesn't fit that Hunt.");
  db.transaction((tx) => {
    requireOwner(tx, by, owner);
    const { today } = clock(tx, now);
    if (!Number.isInteger(n) || huntLocked(n, today) || n >= today + PLAN_DAYS)
      throw new AccessError("That day is locked. Nothing was changed.");
    storeHuntPlan(tx, now);
    const where = and(eq(huntPins.n, n), eq(huntPins.faction, f));
    if (key === undefined) {
      if (tx.delete(huntPins).where(where).run().changes === 0) return;
      storeHuntPlan(tx, now, true);
      logChange(tx, by, "huntUnpinned", now, undefined, `day:${n}`);
      return;
    }
    const row = { n, faction: f, key, at: now, by };
    tx.insert(huntPins)
      .values(row)
      .onConflictDoUpdate({ target: [huntPins.n, huntPins.faction], set: row })
      .run();
    storeHuntPlan(tx, now, true);
    logChange(tx, by, "huntPinned", now, key, `day:${n}`);
  });
}

// --- kills and the pages -------------------------------------------------------------------------------------------

/** A day's quarry: the stored plan, else (a day before pool version 6) the addon's draw of the site's pool version. */
function quarryLookup(db: Db | Tx): (day: number) => HuntPick {
  const stored = picks(db.select().from(huntPlan).all());
  return (day) => {
    const s = stored[day];
    if (s !== undefined) return s;
    const out: HuntPick = {};
    const h = draw(day, POOL_VERSION).hunt;
    for (const hunted of FACTIONS) {
      const c = h?.[hunted === "Alliance" ? "Horde" : "Alliance"];
      const ids = c !== undefined ? comboIds(hunted, c) : undefined;
      if (ids !== undefined) out[hunted] = `${ids.race}:${ids.class}`;
    }
    return out;
  };
}

/** Every Hunt kill of the uploads, oldest first, each on its Doomsday day (the kill's time, else the feed's day). */
export function allHuntKills(
  db: Db | Tx,
  now: number,
  data: Dataset | undefined = loadUploads(db as Db)?.data,
): HuntKill[] {
  const { s } = clock(db, now);
  const entries: HuntEntry[] = [];
  for (const row of db.select().from(feedDays).all()) {
    // Hunt kills are the honorable kills (CF-55 `pvpKills`, ids from CF-118) of a valid target.
    for (const k of row.data.pvpKills ?? []) {
      const faction = data?.characters[row.guid]?.faction;
      const hunt: HuntVictim = {};
      if (k.race !== undefined) hunt.race = k.race;
      if (k.class !== undefined) hunt.class = k.class;
      if (k.raceId !== undefined) hunt.raceId = k.raceId;
      if (k.classId !== undefined) hunt.classId = k.classId;
      if (k.t !== undefined) hunt.at = k.t;
      if (k.zone !== undefined) hunt.zone = k.zone;
      entries.push({
        owner: row.owner,
        guid: row.guid,
        day: k.t !== undefined ? dayOf(k.t, s) : row.day,
        ...(faction !== undefined ? { faction } : {}),
        hunt,
      });
    }
  }
  return huntKills(entries, quarryLookup(db));
}

/** The friends with characters (person key and their characters' factions). */
function huntFriends(db: Db | Tx, data: Dataset | undefined = loadUploads(db as Db)?.data): HuntFriend[] {
  if (data === undefined) return [];
  const byOwner = new Map<string, Set<string>>();
  for (const c of Object.values(data.characters)) {
    if (c.owner === undefined) continue;
    const set = byOwner.get(c.owner) ?? new Set<string>();
    if (c.faction !== undefined) set.add(c.faction);
    byOwner.set(c.owner, set);
  }
  return [...byOwner.entries()]
    .map(([owner, f]) => ({ owner, factions: [...f] }))
    .sort((a, b) => (a.owner < b.owner ? -1 : 1));
}

/** Per friend: the days their goal records have the Hunt done (an addon without `hunts[]` still marks the slot). */
function doneDays(db: Db | Tx): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const r of db.select().from(doomsdayGoals).where(eq(doomsdayGoals.period, "day")).all()) {
    const rec = r.data as GoalRecord;
    if (rec.done?.hunt === undefined) continue;
    const set = out.get(r.owner) ?? new Set<number>();
    set.add(r.n);
    out.set(r.owner, set);
  }
  return out;
}

export interface DoomsdayHuntData {
  today: number;
  todayStart: number;
  /** "The Hunt today", today's and tomorrow's quarry. */
  hunt: HuntTodayView;
  /** Per friend (person key; the pages name them): trophies, bagged, feats. */
  friends: FriendHuntView[];
  /** "Hunt · this week". */
  week: HuntWeekRow[];
  /** The next 7 days' quarries (MP05's strip), from tomorrow. */
  next: HuntPlannedDay[];
  /** The factions the group hunts with (`groupHunters`, WEB-112): the pages show only their Hunts. */
  hunters: Faction[];
}

/** What the Doomsday pages show of the Hunt (WEB-110). Every logged-in viewer. Stores days new to the plan. */
export function doomsdayHunt(db: Db, now: number): DoomsdayHuntData {
  const { s, today } = clock(db, now);
  const plan = storeHuntPlan(db, now);
  const stored = picks(db.select().from(huntPlan).all());
  const latest = latestCensus(db);
  const data = loadUploads(db)?.data;
  const kills = allHuntKills(db, now, data);
  const done = doneDays(db);
  const hunters = groupHunters(data);
  const group = groupHunted(data);
  const friends = huntFriends(db, data).map((friend) =>
    friendHunt({
      friend,
      kills,
      today,
      group,
      ...(latest !== undefined ? { census: latest.census, censusAt: latest.at } : {}),
      ...(done.has(friend.owner) ? { doneDays: done.get(friend.owner)! } : {}),
    }),
  );
  return {
    today,
    todayStart: dayStart(today, s),
    hunt: huntToday(today, stored, friends, latest?.census, latest?.at, group),
    friends,
    week: huntWeek(friends),
    next: plan.filter((d) => d.n > today && d.n <= today + 7),
    hunters,
  };
}

export interface HuntTargetsData {
  view: HuntTargetsView;
  plan: HuntPlannedDay[];
}

/** The Hunt targets grid (MP06) and the planned quarries. Owner only. */
export function huntTargetsFor(db: Db, by: string, now: number, owner?: string): HuntTargetsData {
  requireOwner(db, by, owner);
  const { today } = clock(db, now);
  const plan = storeHuntPlan(db, now);
  const stored = picks(db.select().from(huntPlan).all());
  const latest = latestCensus(db);
  const kills = allHuntKills(db, now);
  // Who could hunt on a day: every friend with characters (the site doesn't know who played which day's Hunt).
  const friends = huntFriends(db);
  const hunters: Record<number, HuntFriend[]> = {};
  for (const n of Object.keys(stored).map(Number)) if (n <= today) hunters[n] = friends;
  const view = huntTargetsView({
    today,
    ...(latest !== undefined ? { census: latest.census, censusAt: latest.at } : {}),
    stale: censusStale(db, today),
    off: offTargets(db),
    days: stored,
    done: targetDone(Object.fromEntries(Object.entries(stored).filter(([n]) => Number(n) <= today)), kills, hunters),
  });
  return { view, plan };
}

/** The census for display (with its date and whether today's fetch failed); undefined before the first. */
export function huntCensusInfo(db: Db | Tx, now: number) {
  const latest = latestCensus(db);
  return censusInfo(latest?.census, latest?.at ?? 0, censusStale(db, clock(db, now).today));
}

/** The Hunt feats per friend from every stored Hunt kill (feats.ts, after an upload's feed is stored). */
export function huntFeatsByOwner(tx: Db | Tx, now: number, data: Dataset): Record<string, HuntFeatProgress[]> {
  // The quarries of the window are stored first, so a kill is compared with the site's own draw.
  storeHuntPlan(tx, now);
  const kills = allHuntKills(tx, now, data);
  if (kills.length === 0) return {};
  const rare = new Set(rareTargets(latestCensus(tx)?.census));
  const group = groupHunted(data);
  const out: Record<string, HuntFeatProgress[]> = {};
  for (const f of huntFriends(tx, data)) {
    const mine = kills.filter((k) => k.owner === f.owner);
    if (mine.length > 0) out[f.owner] = huntFeats(mine, huntedBy(f, group), rare);
  }
  return out;
}

export interface MissionPoolPage {
  /** The page's existing data (plan, settings, overrides, stats; WEB-79). */
  pool: MissionPoolData;
  /** MP05: the recipe bar, the theme cards, the 14 calendar days with their Hunt. */
  tiles: RecipeTileView[];
  cards: ThemeCardView[];
  days: DayRecipeView[];
  /** MP05: today's quarry per hunted faction, and the next 7 days. MP06: the Hunt targets grid. */
  quarry: HuntTodayView["quarry"];
  next: HuntDay[];
  targets: HuntTargetsView;
  /** The factions the group hunts with (WEB-112): the quarry card's sides, the grid's tabs, the days' Hunt line. */
  hunters: Faction[];
}

/** Everything the Mission pool page v2 shows (WEB-109, boards MP05–MP07). Owner only. Stores days new to the plan. */
export function missionPoolPage(db: Db, by: string, now: number, owner?: string): MissionPoolPage {
  const data = missionPool(db, by, now, owner);
  const { view, plan } = huntTargetsFor(db, by, now, owner);
  const today = doomsdayHunt(db, now);
  // The recipe tile's "in the draw": the factions the group hunts (the other has no census since WEB-112).
  const hunted = today.hunters.map(enemyOf);
  const inDraw = Math.round(hunted.reduce((a, f) => a + view.factions[f].inDraw, 0) / hunted.length);
  return {
    pool: data,
    tiles: recipeTiles(data.settings, inDraw),
    cards: themeCards(data.settings, data.stats),
    days: dayRecipes(
      data.plan.days.filter((d) => d.n >= data.today && d.n < data.today + CALENDAR_DAYS),
      plan,
    ),
    quarry: today.hunt.quarry,
    next: today.next.map(huntDay),
    targets: view,
    hunters: today.hunters,
  };
}
