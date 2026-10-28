import { and, eq } from "drizzle-orm";
import type { GoalRecord, PersonGoals } from "@/core/doomsday/record";
import type { PersonFeed } from "@/core/feed";
import type { Sighting } from "@/core/model";
import type { Db } from "./db";
import { doomsdayGoals, doomsdayStatus, feedDays, sightings } from "./db/schema";

// History for the weekly recap (WEB-41) and Doomsday (WEB-55): the addon's activity feed per realm day per character,
// every sighting, and each friend's Doomsday goals. Written with every accepted upload (src/server/uploads.ts), in upload order, so a rebuild writes
// the same rows again.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Keeps each day of each character: a copy with later activity (`at`) replaces the stored one; an equal one from a
 * later upload too (the newest upload wins). Several friends relay the same feed, so this keeps the freshest copy.
 */
export function recordFeeds(tx: Tx, feeds: readonly PersonFeed[], uploadId: number): void {
  for (const feed of feeds) {
    for (const [dayKey, chars] of Object.entries(feed.days)) {
      const day = Number(dayKey);
      for (const [guid, entry] of Object.entries(chars)) {
        const stored = tx
          .select({ at: feedDays.at })
          .from(feedDays)
          .where(and(eq(feedDays.day, day), eq(feedDays.guid, guid)))
          .get();
        if (stored !== undefined && (stored.at ?? 0) > (entry.at ?? 0)) continue;
        const row = { owner: feed.owner, at: entry.at ?? null, sourceUpload: uploadId, data: entry };
        tx.insert(feedDays)
          .values({ day, guid, ...row })
          .onConflictDoUpdate({ target: [feedDays.day, feedDays.guid], set: row })
          .run();
      }
    }
  }
}

/**
 * Keeps each Doomsday day and week of each person: the copy with the newer `at` replaces the stored one, an equal one
 * from a later upload too (the addon's merge rule, CF-56). The streak, best, pool and reset come with the goals whose
 * newest `at` is the newest seen.
 */
export function recordGoals(tx: Tx, all: readonly PersonGoals[], uploadId: number): void {
  for (const goals of all) {
    let newest: number | undefined;
    const periods: ["day" | "week", Record<number, GoalRecord>][] = [
      ["day", goals.days],
      ["week", goals.weeks],
    ];
    for (const [period, records] of periods) {
      for (const [key, record] of Object.entries(records)) {
        const n = Number(key);
        if (record.at !== undefined) newest = Math.max(newest ?? 0, record.at);
        const where = and(
          eq(doomsdayGoals.owner, goals.owner),
          eq(doomsdayGoals.period, period),
          eq(doomsdayGoals.n, n),
        );
        const stored = tx.select({ at: doomsdayGoals.at }).from(doomsdayGoals).where(where).get();
        if (stored !== undefined && (stored.at ?? 0) > (record.at ?? 0)) continue;
        const row = { at: record.at ?? null, sourceUpload: uploadId, data: record };
        tx.insert(doomsdayGoals)
          .values({ owner: goals.owner, period, n, ...row })
          .onConflictDoUpdate({ target: [doomsdayGoals.owner, doomsdayGoals.period, doomsdayGoals.n], set: row })
          .run();
      }
    }
    const stored = tx
      .select({ at: doomsdayStatus.at })
      .from(doomsdayStatus)
      .where(eq(doomsdayStatus.owner, goals.owner))
      .get();
    if (stored !== undefined && (stored.at ?? 0) > (newest ?? 0)) continue;
    const status = {
      streak: goals.streak ?? null,
      best: goals.best ?? null,
      pool: goals.pool ?? null,
      reset: goals.reset ?? null,
      at: newest ?? null,
      sourceUpload: uploadId,
    };
    tx.insert(doomsdayStatus)
      .values({ owner: goals.owner, ...status })
      .onConflictDoUpdate({ target: doomsdayStatus.owner, set: status })
      .run();
  }
}

/** Keeps every sighting of the upload; the same sighting from another upload is stored once. */
export function recordSightings(tx: Tx, locations: Readonly<Record<string, Sighting>>, uploadId: number): void {
  for (const [guid, s] of Object.entries(locations)) {
    tx.insert(sightings)
      .values({ guid, zone: s.zone, seenAt: s.seenAt, sourceUpload: uploadId })
      .onConflictDoNothing()
      .run();
  }
}

/** Before a rebuild writes the history again. */
export function clearHistory(tx: Tx): void {
  tx.delete(feedDays).run();
  tx.delete(doomsdayGoals).run();
  tx.delete(doomsdayStatus).run();
  tx.delete(sightings).run();
}
