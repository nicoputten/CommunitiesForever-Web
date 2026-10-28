import { and, eq } from "drizzle-orm";
import type { PersonFeed } from "@/core/feed";
import type { Sighting } from "@/core/model";
import type { Db } from "./db";
import { feedDays, feedSharing, sightings } from "./db/schema";

// History for the weekly recap (WEB-41): the addon's activity feed per realm day per character, who shares it, and
// every sighting. Written with every accepted upload (src/server/uploads.ts), in upload order, so a rebuild writes
// the same rows again.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Keeps each day of each character: a copy with later activity (`at`) replaces the stored one; an equal one from a
 * later upload too (the newest upload wins). Several friends relay the same feed, so this keeps the freshest copy.
 */
export function recordFeeds(tx: Tx, feeds: readonly PersonFeed[], uploadId: number): void {
  for (const feed of feeds) {
    tx.insert(feedSharing)
      .values({ owner: feed.owner, shared: feed.shared, sourceUpload: uploadId })
      .onConflictDoUpdate({ target: feedSharing.owner, set: { shared: feed.shared, sourceUpload: uploadId } })
      .run();
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
  tx.delete(feedSharing).run();
  tx.delete(sightings).run();
}
