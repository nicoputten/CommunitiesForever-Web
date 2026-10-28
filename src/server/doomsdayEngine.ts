import { doomsdaySnapshot, type DoomsdayInput } from "@/core/doomsday/engine";
import type { DoomsdaySnapshot } from "@/core/doomsday/snapshot";
import type { Db } from "./db";
import { doomsdayGoals, doomsdayStatus, feats, feedDays } from "./db/schema";
import { doomsdayResetSetting, getBotSettings } from "./discord";
import { loadState } from "./uploads";

// The Doomsday engine's input from what the site stores (WEB-58): each friend's goals (WEB-55), the feed, the merged
// data and the feats (WEB-56). One snapshot per request: points and ladders are computed, never stored.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The engine's input at `now`; undefined before the first upload. */
export function doomsdayInput(db: Db | Tx, now: number): DoomsdayInput | undefined {
  const state = loadState(db as Db);
  if (state === undefined) return undefined;
  const settings = getBotSettings(db);
  const goals: Record<string, DoomsdayInput["goals"][string]> = {};
  const goalsOf = (owner: string) => (goals[owner] ??= { days: {}, weeks: {} });
  for (const row of db.select().from(doomsdayGoals).all()) {
    const g = goalsOf(row.owner);
    (row.period === "day" ? g.days : g.weeks)[row.n] = row.data;
  }
  for (const row of db.select().from(doomsdayStatus).all()) {
    const g = goalsOf(row.owner);
    if (row.best !== null) g.best = row.best;
  }
  return {
    now,
    timeZone: settings.realmTimeZone,
    reset: doomsdayResetSetting(settings),
    data: state.data,
    goals,
    feed: db
      .select({ guid: feedDays.guid, owner: feedDays.owner, day: feedDays.day, entry: feedDays.data })
      .from(feedDays)
      .all(),
    feats: db.select().from(feats).all(),
  };
}

/** Doomsday for the whole group at `now`; undefined before any Doomsday data (no friend has goals yet). */
export function doomsdayFor(db: Db | Tx, now: number): DoomsdaySnapshot | undefined {
  const input = doomsdayInput(db, now);
  if (input === undefined || Object.keys(input.goals).length === 0) return undefined;
  return doomsdaySnapshot(input);
}
