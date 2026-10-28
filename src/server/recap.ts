import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { MAP_ZONES, mapZone, recapChar } from "@/core/recap/input";
import { buildRecap } from "@/core/recap/recap";
import type { History, Recap, RecapChar, Week, WeekSighting } from "@/core/recap/types";
import { nextRecapMoment, recapMomentAtOrBefore, type RecapSchedule } from "@/core/recap/week";
import { adminBattleTag } from "./access";
import { enqueueBotEvent } from "./bot";
import type { Db } from "./db";
import { recapSection } from "@/core/doomsday/posts";
import { doomsdayInput } from "./doomsdayEngine";
import { feedDays, recaps, recapStart, sightings } from "./db/schema";
import { effectiveTimeZone, getBotSettings } from "./discord";
import { loadState } from "./uploads";

// The weekly recap (WEB-41c): due at the recap moment (Sunday 13:00 in the admin's time zone by default, the Discord
// page), computed once from the week's history (src/server/history.ts) and stored, then posted by the bot. A check
// every minute (src/instrumentation.ts) runs it; after downtime it catches up with one recap up to the last moment
// missed. The first recap is the first moment after the site started keeping them (week 1, Nico 2026-10-27).

const DAY = 86400;
const MONTH = 28 * DAY;

/** When the recap comes: the Discord page's day and time in the admin's time zone. */
export function recapSchedule(db: Db, admin = adminBattleTag()): RecapSchedule {
  const s = getBotSettings(db);
  return { timeZone: effectiveTimeZone(db, admin, admin), weekday: s.recapDay, time: s.recapTime };
}

interface StoredRecap {
  week: number;
  start: number;
  end: number;
  data: Recap;
  snapshot: Record<string, RecapChar>;
}

export function storedRecaps(db: Db): StoredRecap[] {
  return db.select().from(recaps).orderBy(asc(recaps.week)).all();
}

export function latestRecap(db: Db): StoredRecap | undefined {
  return db.select().from(recaps).orderBy(desc(recaps.week)).limit(1).get();
}

/** What the next recap needs from the earlier ones. */
export function historyOf(stored: readonly StoredRecap[]): History {
  return { weeks: stored.map((r) => r.data.past), cycles: stored.at(-1)?.data.cycles ?? {} };
}

function sightingsBetween(db: Db, from: number, to: number): WeekSighting[] {
  return db
    .select({ guid: sightings.guid, zone: sightings.zone, seenAt: sightings.seenAt })
    .from(sightings)
    .where(and(gte(sightings.seenAt, from), lt(sightings.seenAt, to)))
    .orderBy(asc(sightings.seenAt))
    .all()
    .flatMap((s) => {
      const zone = mapZone(s.zone);
      return zone === undefined ? [] : [{ ...s, zone }];
    });
}

/** The recap's input for `[start, end)`: the characters now against `before`, and the week's history. */
export function assembleWeek(
  db: Db,
  number: number,
  start: number,
  end: number,
  before: Record<string, RecapChar>,
  siteName: string,
): Week {
  const state = loadState(db);
  const after: Record<string, RecapChar> = {};
  for (const c of Object.values(state?.data.characters ?? {})) {
    const rc = recapChar(c);
    if (rc !== undefined) after[rc.guid] = rc;
  }
  const friends = Object.values(state?.data.people ?? {})
    .filter((p) => p.hasRecord)
    .map((p) => ({ key: p.key, name: p.displayName }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const inWeek = (day: number, at: number | null) => {
    const t = at ?? day * DAY + DAY / 2;
    return t >= start && t < end;
  };
  const days = db
    .select()
    .from(feedDays)
    .where(and(gte(feedDays.day, Math.floor(start / DAY) - 1), lt(feedDays.day, Math.ceil(end / DAY) + 1)))
    .orderBy(asc(feedDays.day), asc(feedDays.guid))
    .all()
    .filter((d) => inWeek(d.day, d.at))
    .map((d) => ({ day: d.day, guid: d.guid, owner: d.owner, entry: d.data }));

  const all = sightingsBetween(db, 0, end);
  const lastSeen: Record<string, WeekSighting> = {};
  for (const s of all) lastSeen[s.guid] = s;
  const lastActiveBefore: Record<string, number> = {};
  const active = (owner: string | undefined, at: number) => {
    if (owner !== undefined && at < start) lastActiveBefore[owner] = Math.max(lastActiveBefore[owner] ?? 0, at);
  };
  for (const s of all) active(after[s.guid]?.owner, s.seenAt);
  for (const d of db.select({ owner: feedDays.owner, at: feedDays.at }).from(feedDays).all()) {
    if (d.at !== null) active(d.owner, d.at);
  }

  return {
    number,
    start,
    end,
    siteName,
    friends,
    before,
    after,
    days,
    sightings: all.filter((s) => s.seenAt >= start),
    zonesBefore: [...new Set(all.filter((s) => s.seenAt < start).map((s) => s.zone))].sort(),
    totalZones: MAP_ZONES,
    lastSeen,
    monthAgo: sightingsBetween(db, start - MONTH, end - MONTH),
    lastActiveBefore,
  };
}

/** The recap as the bot gets it: without what only later recaps need. */
export function postedRecap(recap: Recap): Omit<Recap, "past" | "cycles"> {
  const posted: Partial<Recap> = { ...recap };
  delete posted.past;
  delete posted.cycles;
  return posted as Omit<Recap, "past" | "cycles">;
}

/**
 * Computes and stores the recap when one is due: the latest recap moment at or before `now` has no recap yet, and
 * comes after the site started keeping them. Posts it (a `recap` event) when the Discord page's Weekly recap is on.
 * Returns the new recap, or undefined when none was due.
 */
export function runDueRecap(db: Db, now: number, siteName: string): Recap | undefined {
  db.insert(recapStart).values({ id: 1, startedAt: now }).onConflictDoNothing().run();
  const startedAt = db.select().from(recapStart).where(eq(recapStart.id, 1)).get()!.startedAt;
  const schedule = recapSchedule(db);
  const moment = recapMomentAtOrBefore(schedule, now);
  const latest = latestRecap(db);
  if (latest !== undefined ? latest.end >= moment : moment <= startedAt) return undefined;

  const start = latest?.end ?? recapMomentAtOrBefore(schedule, moment - 1);
  const number = (latest?.week ?? 0) + 1;
  const week = assembleWeek(db, number, start, moment, latest?.snapshot ?? {}, siteName);
  const recap = buildRecap(week, historyOf(storedRecaps(db)));
  // WEB-58: the Doomsday section, from the same week.
  const input = doomsdayInput(db, moment);
  const doomsday = input !== undefined ? recapSection(input, start, moment) : undefined;
  if (doomsday !== undefined) recap.doomsday = doomsday;
  db.insert(recaps)
    .values({ week: number, start, end: moment, computedAt: now, data: recap, snapshot: week.after })
    .onConflictDoNothing()
    .run();
  if (getBotSettings(db).recap) enqueueBotEvent(db, "recap", postedRecap(recap), now);
  return recap;
}

/** The coming recap as it would be if the week ended now (the admin's preview); not stored. */
export function previewRecap(db: Db, now: number, siteName: string): Recap {
  const schedule = recapSchedule(db);
  const latest = latestRecap(db);
  const start = latest?.end ?? recapMomentAtOrBefore(schedule, now);
  const week = assembleWeek(
    db,
    (latest?.week ?? 0) + 1,
    start,
    Math.max(now, start + 1),
    latest?.snapshot ?? {},
    siteName,
  );
  return buildRecap(week, historyOf(storedRecaps(db)));
}

/** When the coming recap is due. */
export function nextRecapAt(db: Db, now: number): number {
  return nextRecapMoment(recapSchedule(db), recapMomentAtOrBefore(recapSchedule(db), now));
}
