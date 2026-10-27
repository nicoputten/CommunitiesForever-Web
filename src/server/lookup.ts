import { and, eq, gte } from "drizzle-orm";
import { sameBattleTag } from "@/core/access";
import type { Dataset } from "@/core/model";
import type { Db } from "./db";
import { feedDays, feedSharing } from "./db/schema";

// The bot's look-ups on the server (WEB-39b): who a linked friend is in the data, and their week for `/me`.

const DAY = 86400;

/** The friend's person key in the merged data: the person with the friend's BattleTag. */
export function personKeyOf(d: Dataset, battleTag: string): string | undefined {
  return Object.values(d.people).find((p) => sameBattleTag(p.battleTag, battleTag))?.key;
}

/**
 * `/me`'s week: levels, quests and dungeon runs of the last 7 days from the activity feed (WEB-41a). Undefined for
 * someone who doesn't share their activity (or never sent any).
 */
export function weekOf(
  db: Db,
  personKey: string,
  now: number,
): { levels: number; quests: number; runs: number } | undefined {
  const sharing = db.select().from(feedSharing).where(eq(feedSharing.owner, personKey)).get();
  if (sharing === undefined || !sharing.shared) return undefined;
  const days = db
    .select({ data: feedDays.data })
    .from(feedDays)
    .where(and(eq(feedDays.owner, personKey), gte(feedDays.day, Math.floor(now / DAY) - 6)))
    .all();
  let levels = 0;
  let quests = 0;
  let runs = 0;
  for (const { data } of days) {
    if (data.levelFrom !== undefined && data.levelTo !== undefined && data.levelTo > data.levelFrom) {
      levels += data.levelTo - data.levelFrom;
    }
    quests += Object.values(data.quests).reduce((a, b) => a + b, 0);
    runs += data.runs.filter((r) => r.kind === "party" || r.kind === "raid").length;
  }
  return { levels, quests, runs };
}
