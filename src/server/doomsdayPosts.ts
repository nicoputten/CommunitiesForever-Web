import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { doomsdaySnapshot } from "@/core/doomsday/engine";
import { createHash } from "node:crypto";
import { boardCard } from "@/core/cards/models";
import { type BoardData, boardData, boardNews, boardSummary, ladderData } from "@/core/doomsday/posts";
import { EPOCH, weekOf, weekStart } from "@/core/doomsday/rules";
import { canonical } from "@/core/merge";
import { enqueueBotEvent } from "./bot";
import type { Db } from "./db";
import { botEvents, doomsdayPosts } from "./db/schema";
import { getBotSettings } from "./discord";
import { doomsdayInput } from "./doomsdayEngine";
import { cardHost } from "./cards";

// Doomsday's bot events (WEB-58, docs/BOT-API.md "Doomsday"): the daily board at each reset, its updates after
// uploads (the latest only), the final update with the day's summary at the next reset, and the weekly ladder on
// Sunday at the reset. Each only with its switch on (the Discord page). The board and the ladder are written by the
// minute check (src/instrumentation.ts), never for a day or week already past: a site that was down skips them.

/** How long after a reset its board or ladder may still be written (a restart or a slow minute). */
const LATE = 6 * 3600;

function post(db: Db, kind: "board" | "ladder", n: number) {
  return db
    .select()
    .from(doomsdayPosts)
    .where(and(eq(doomsdayPosts.kind, kind), eq(doomsdayPosts.n, n)))
    .get();
}

/** The Discord message the day's board was last acknowledged with (the board, or an update the bot posted anew). */
function boardMessage(db: Db, day: number): string | null {
  const acknowledged = db
    .select({ data: botEvents.data, messageId: botEvents.messageId })
    .from(botEvents)
    .where(and(inArray(botEvents.type, ["doomsdayBoard", "doomsdayBoardUpdate"]), isNotNull(botEvents.messageId)))
    .orderBy(desc(botEvents.id))
    .all();
  return acknowledged.find((e) => (e.data as { day?: number }).day === day)?.messageId ?? null;
}

/** Acknowledges the day's updates the bot hasn't taken yet: a newer one replaces them (latest only). */
function supersede(db: Db, day: number, now: number): void {
  const pending = db
    .select()
    .from(botEvents)
    .where(and(eq(botEvents.type, "doomsdayBoardUpdate"), isNull(botEvents.postedAt)))
    .all()
    .filter((e) => (e.data as { day?: number }).day === day);
  for (const e of pending) db.update(botEvents).set({ postedAt: now }).where(eq(botEvents.id, e.id)).run();
}

/**
 * WEB-66 (docs/BOT-API.md "Visual posts"): the board's news line and its image id. The id is the day and a hash of the
 * picture as it is drawn now, so it changes only when the picture does (the bot re-attaches only on a new id).
 */
function visual(
  data: BoardData,
  kind: "start" | "update" | "final",
  timeZone: string,
  now: number,
  summary?: ReturnType<typeof boardSummary>,
): { news: string; image: string } {
  const spec = boardCard(
    { ...data, final: kind === "final", ...(summary !== undefined ? { summary } : {}) },
    now,
    timeZone,
    cardHost(),
  );
  const hash = createHash("sha256").update(canonical(spec)).digest("hex").slice(0, 6);
  return { news: boardNews(data, kind, timeZone, summary), image: `doomsday-${data.day}-${hash}` };
}

/** The minute check: the final update of yesterday's board, today's board, and last week's ladder when due. */
export function runDueDoomsday(db: Db, now: number): void {
  const settings = getBotSettings(db);
  if (!settings.doomsdayBoard && !settings.doomsdayLadder) return;
  const input = doomsdayInput(db, now);
  if (input === undefined || Object.keys(input.goals).length === 0) return;
  const snap = doomsdaySnapshot(input);
  const day = snap.schedule.day;
  const fresh = now - snap.schedule.dayStart < LATE;

  if (settings.doomsdayBoard) {
    const prev = post(db, "board", day - 1);
    if (prev !== undefined && prev.finalAt === null) {
      const last = doomsdaySnapshot({ ...input, now: snap.schedule.dayStart - 1 });
      supersede(db, day - 1, now);
      const data = boardData(input, last);
      const summary = boardSummary(last);
      enqueueBotEvent(
        db,
        "doomsdayBoardUpdate",
        {
          ...data,
          ...visual(data, "final", input.timeZone, now, summary),
          boardEvent: prev.eventId,
          messageId: boardMessage(db, day - 1),
          final: true,
          summary,
        },
        now,
      );
      db.update(doomsdayPosts)
        .set({ finalAt: now })
        .where(and(eq(doomsdayPosts.kind, "board"), eq(doomsdayPosts.n, day - 1)))
        .run();
    }
    if (fresh && day >= EPOCH && post(db, "board", day) === undefined) {
      const data = boardData(input, snap);
      const eventId = enqueueBotEvent(
        db,
        "doomsdayBoard",
        { ...data, ...visual(data, "start", input.timeZone, now) },
        now,
      );
      db.insert(doomsdayPosts)
        .values({ kind: "board", n: day, eventId, lastData: canonical(data), createdAt: now, finalAt: null })
        .onConflictDoNothing()
        .run();
    }
  }

  if (settings.doomsdayLadder) {
    const week = snap.schedule.week;
    // When this week began: Sunday's reset.
    const weekBegan = snap.schedule.dayStart - (day - weekStart(week)) * 86400;
    if (week - 1 >= weekOf(EPOCH) && now - weekBegan < LATE && post(db, "ladder", week - 1) === undefined) {
      const eventId = enqueueBotEvent(db, "doomsdayLadder", ladderData(input, weekBegan), now);
      db.insert(doomsdayPosts)
        .values({ kind: "ladder", n: week - 1, eventId, lastData: null, createdAt: now, finalAt: now })
        .onConflictDoNothing()
        .run();
    }
  }
}

/** After an accepted upload: the whole board again when it changed (doomsdayBoardUpdate, the latest only). */
export function updateDoomsdayBoard(db: Db, now: number): boolean {
  if (!getBotSettings(db).doomsdayBoard) return false;
  const input = doomsdayInput(db, now);
  if (input === undefined) return false;
  const snap = doomsdaySnapshot(input);
  const day = snap.schedule.day;
  const row = post(db, "board", day);
  if (row === undefined || row.finalAt !== null) return false;
  const data = boardData(input, snap);
  const text = canonical(data);
  if (text === row.lastData) return false;
  supersede(db, day, now);
  enqueueBotEvent(
    db,
    "doomsdayBoardUpdate",
    {
      ...data,
      ...visual(data, "update", input.timeZone, now),
      boardEvent: row.eventId,
      messageId: boardMessage(db, day),
      final: false,
    },
    now,
  );
  db.update(doomsdayPosts)
    .set({ lastData: text })
    .where(and(eq(doomsdayPosts.kind, "board"), eq(doomsdayPosts.n, day)))
    .run();
  return true;
}
