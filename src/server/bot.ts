import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, gte, isNull } from "drizzle-orm";
import {
  BOT_TOKEN_BYTES,
  EVENT_TTL_SECONDS,
  EVENTS_PER_PAGE,
  formatBotToken,
  LONG_POLL_SECONDS,
  type Milestone,
  type MilestonesEvent,
} from "@/core/bot";
import { featCardScore, type FeatFields } from "@/core/doomsday/feats";
import type { Db } from "./db";
import { botEvents, botTokens } from "./db/schema";
import { getBotSettings } from "./discord";
import { hashToken } from "./uploader";

// The Discord bot's token and event feed (WEB-38, docs/BOT-API.md). One token, made and revoked by the admin, shown
// once and stored only as its SHA-256. Events are written when an upload is accepted and handed out until the bot
// acknowledges them.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// --- token --------------------------------------------------------------------------------------------------------

/** Makes the bot token and returns it once; the token before it stops working. */
export function createBotToken(db: Db, battleTag: string, now: number): string {
  const token = formatBotToken(randomBytes(BOT_TOKEN_BYTES));
  db.transaction((tx) => {
    tx.update(botTokens).set({ revokedAt: now }).where(isNull(botTokens.revokedAt)).run();
    tx.insert(botTokens)
      .values({ tokenHash: hashToken(token), createdBy: battleTag, createdAt: now })
      .run();
  });
  return token;
}

/** Revokes the bot token; true when there was an active one. */
export function revokeBotToken(db: Db, now: number): boolean {
  return db.update(botTokens).set({ revokedAt: now }).where(isNull(botTokens.revokedAt)).run().changes > 0;
}

export interface BotTokenStatus {
  createdAt: number;
  /** BattleTag of the admin who made it. */
  createdBy: string;
  lastUsedAt?: number;
}

/** The active bot token's dates (never the token), for the Discord page (WEB-39); undefined without one. */
export function botTokenStatus(db: Db): BotTokenStatus | undefined {
  const row = db.select().from(botTokens).where(isNull(botTokens.revokedAt)).get();
  if (row === undefined) return undefined;
  const status: BotTokenStatus = { createdAt: row.createdAt, createdBy: row.createdBy };
  if (row.lastUsedAt !== null) status.lastUsedAt = row.lastUsedAt;
  return status;
}

/** Whether a token is the active bot token; notes its use. */
export function checkBotToken(db: Db, token: string, now: number): boolean {
  return (
    db
      .update(botTokens)
      .set({ lastUsedAt: now })
      .where(and(eq(botTokens.tokenHash, hashToken(token)), isNull(botTokens.revokedAt)))
      .run().changes > 0
  );
}

// --- events -------------------------------------------------------------------------------------------------------

export interface BotEvent {
  id: number;
  type: string;
  createdAt: number;
  data: unknown;
}

/**
 * Writes an event for the bot and wakes waiting polls (WEB-39: the admin's test post). Returns its id.
 * Upload events are written in the upload's transaction instead (recordMilestones).
 */
export function enqueueBotEvent(db: Db, type: string, data: unknown, now: number): number {
  const { id } = db.insert(botEvents).values({ type, data, createdAt: now }).returning({ id: botEvents.id }).get();
  notifyBotEvents();
  return id;
}

/**
 * Writes the `milestones` event of an accepted upload, in the upload's transaction: the feats it brought
 * (src/server/feats.ts). None when it reached nothing or is the site's first upload (`first`: there was no data before
 * it). Feats with a card image get their card id, and the event the most special one's (WEB-56). Returns whether it
 * wrote one.
 */
export function recordMilestones(
  tx: Tx,
  upload: { id: number; uploadedAt: number },
  reached: Milestone[],
  first: boolean,
): boolean {
  // The admin's Milestones switch (WEB-39): off makes no events, so turning it on later posts nothing old.
  if (first || !getBotSettings(tx).milestones) return false;
  if (reached.length === 0) return false;
  const data: MilestonesEvent = { uploadId: upload.id, uploadedAt: upload.uploadedAt, milestones: reached };
  const { id } = tx
    .insert(botEvents)
    .values({ type: "milestones", data, createdAt: upload.uploadedAt, uploadId: upload.id })
    .returning({ id: botEvents.id })
    .get();
  // WEB-66: every feat but a new character has a card; the post's one card is the most special.
  let best: { card: string; rank: number } | undefined;
  reached.forEach((m, n) => {
    const rank = featCardScore({ kind: m.kind, fields: m as FeatFields, firstInGroup: m.firstInGroup === true });
    if (rank < 0) return;
    m.card = `milestone-${id}-${n}`;
    if (best === undefined || rank > best.rank) best = { card: m.card, rank };
  });
  if (best !== undefined) {
    data.card = best.card;
    tx.update(botEvents).set({ data }).where(eq(botEvents.id, id)).run();
  }
  return true;
}

/** Events after the cursor that the bot hasn't acknowledged and that are under 7 days old, oldest first. */
export function pendingEvents(db: Db, after: number, now: number, limit = EVENTS_PER_PAGE): BotEvent[] {
  return db
    .select({ id: botEvents.id, type: botEvents.type, createdAt: botEvents.createdAt, data: botEvents.data })
    .from(botEvents)
    .where(and(gt(botEvents.id, after), isNull(botEvents.postedAt), gte(botEvents.createdAt, now - EVENT_TTL_SECONDS)))
    .orderBy(asc(botEvents.id))
    .limit(limit)
    .all();
}

export type Acknowledged = "ok" | "unknown" | "expired" | "conflict";

/**
 * The bot posted an event as a Discord message. Acknowledging again with the same message id is fine (a retry);
 * with another one it is a conflict, so the bot knows it posted twice. An expired event can't be acknowledged.
 */
export function acknowledge(db: Db, id: number, messageId: string, now: number): Acknowledged {
  return db.transaction((tx) => {
    const row = tx.select().from(botEvents).where(eq(botEvents.id, id)).get();
    if (row === undefined) return "unknown";
    if (row.postedAt !== null) return row.messageId === messageId ? "ok" : "conflict";
    if (row.createdAt < now - EVENT_TTL_SECONDS) return "expired";
    tx.update(botEvents).set({ postedAt: now, messageId }).where(eq(botEvents.id, id)).run();
    return "ok";
  });
}

// --- long poll ----------------------------------------------------------------------------------------------------

// Waiting long polls, woken when an upload wrote events. On globalThis: route bundles may load this module more than
// once in one server process (the site is one container).
const KEY = Symbol.for("communitiesforever.botWaiters");
const waiters: Set<() => void> = ((globalThis as Record<symbol, unknown>)[KEY] ??= new Set<() => void>()) as Set<
  () => void
>;

/** Wakes every waiting long poll (after an upload's transaction wrote events). */
export function notifyBotEvents(): void {
  for (const wake of [...waiters]) wake();
}

/** How long a poll holds when there is nothing new; tests make it short. */
export const longPoll = { seconds: LONG_POLL_SECONDS };

/** Without a wake-up (another process wrote), a waiting poll still looks again this often. */
export const RECHECK_MS = 5_000;

/**
 * The events after the cursor at once when there are any; otherwise waits until an upload writes some, `timeoutMs`
 * passes or the request is aborted, and answers what there is then (maybe nothing). `beforeLook` runs before every
 * look, so events that fall due while a poll waits are written within RECHECK_MS.
 */
export async function waitForEvents(
  db: Db,
  after: number,
  now: () => number,
  timeoutMs: number,
  signal?: AbortSignal,
  beforeLook?: (now: number) => void,
): Promise<BotEvent[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // Time-based events (the runs' reminders, WEB-40) are written here: there is no scheduler.
    beforeLook?.(now());
    const events = pendingEvents(db, after, now());
    const left = deadline - Date.now();
    if (events.length > 0 || left <= 0 || signal?.aborted) return events;
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        waiters.delete(done);
        signal?.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, Math.min(left, RECHECK_MS));
      waiters.add(done);
      signal?.addEventListener("abort", done);
    });
  }
}
