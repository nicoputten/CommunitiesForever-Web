import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { battleTagKey, sameBattleTag } from "@/core/access";
import type { FeedDay } from "@/core/feed";
import { ASK_EXPIRE_SECONDS, siteRunId, type GameItem } from "@/core/gameItems";
import { OUTCOME_SECONDS, ranIt } from "@/core/runOutcome";
import { runDungeon, runDungeonByAddonId } from "@/core/runs";
import { enqueueBotEvent } from "./bot";
import type { Db } from "./db";
import { feedDays, gameItems, runs } from "./db/schema";
import { getBotSettings } from "./discord";
import {
  answerRunFor,
  discordIds,
  displayName,
  getRun,
  planRunFor,
  runCharacter,
  runPayload,
  setOutcome,
} from "./runs";
import { loadState } from "./uploads";

// What the game sent with an upload (WEB-43): the uploader's runs planned, answers given, asks to post on Discord and
// Discord pings, each applied once (by its id, so a file uploaded twice changes nothing); and after every upload,
// whether a planned run happened, from the stored run log. Called after the upload's transaction.

export interface GameItemsResult {
  /** Answers the game sent and the site took ("N run answers" in the session report, story WEB-43). */
  runAnswers: number;
}

/** The game's items of an accepted upload by `battleTag` (the file is theirs), each applied once. */
export function applyGameItems(
  db: Db,
  uploadId: number,
  battleTag: string,
  items: readonly GameItem[],
  now: number,
): GameItemsResult {
  const result: GameItemsResult = { runAnswers: 0 };
  if (items.length === 0) return result;
  const known = new Set(
    db
      .select({ id: gameItems.id })
      .from(gameItems)
      .where(
        inArray(
          gameItems.id,
          items.map((i) => i.id),
        ),
      )
      .all()
      .map((r) => r.id),
  );
  for (const item of items) {
    if (known.has(item.id)) continue;
    const { outcome, runId } = apply(db, battleTag, item, now);
    if (item.kind === "answer" && outcome === "applied") result.runAnswers++;
    db.insert(gameItems)
      .values({
        id: item.id,
        battleTag,
        kind: item.kind,
        at: item.at,
        receivedAt: now,
        uploadId,
        result: outcome,
        runId: runId ?? null,
      })
      .onConflictDoNothing()
      .run();
  }
  return result;
}

function apply(db: Db, battleTag: string, item: GameItem, now: number): { outcome: string; runId?: number } {
  switch (item.kind) {
    case "plan": {
      const dungeon = runDungeonByAddonId(item.dungeon) ?? runDungeon(item.dungeon);
      if (dungeon === undefined) return { outcome: "unknown_dungeon" };
      // A plan that reached the site after its start is dropped (decided with Nico, 2026-10-27).
      const request = {
        dungeonId: dungeon.id,
        startsAt: item.startsAt,
        note: item.note,
        organiser: battleTag,
        source: "game" as const,
      };
      let planned = planRunFor(db, { ...request, ...(item.guid === undefined ? {} : { leadGuid: item.guid }) }, now);
      // The lead the game picked doesn't fit (or isn't known yet): organiser without a slot.
      if (planned === "lead_out_of_range" || planned === "lead_not_yours") planned = planRunFor(db, request, now);
      return typeof planned === "string" ? { outcome: planned } : { outcome: "applied", runId: planned.id };
    }
    case "answer": {
      const runId = siteRunId(item.run);
      if (runId === undefined) return { outcome: "unknown_run" };
      const answered = answerRunFor(
        db,
        runId,
        { battleTag, answer: item.answer, source: "game", ...(item.guid === undefined ? {} : { guid: item.guid }) },
        now,
      );
      return typeof answered === "string" ? { outcome: answered, runId } : { outcome: "applied", runId };
    }
    case "ask": {
      // An ask is posted only within 10 minutes of being made in game (story WEB-43).
      if (now - item.at > ASK_EXPIRE_SECONDS) return { outcome: "expired" };
      const settings = getBotSettings(db);
      if (!settings.askNow) return { outcome: "off" };
      const dungeon = runDungeonByAddonId(item.dungeon) ?? runDungeon(item.dungeon);
      const data = loadState(db)?.data;
      const id = discordIds(db).get(battleTagKey(battleTag));
      const character = item.guid === undefined ? undefined : runCharacter(data, item.guid);
      enqueueBotEvent(
        db,
        "askNow",
        {
          ask: {
            id: item.id,
            dungeon: dungeon
              ? { id: dungeon.id, name: dungeon.name, typicalLevels: dungeon.typicalLevels }
              : { id: item.dungeon, name: item.dungeon },
            from: { name: displayName(data, battleTag), ...(id === undefined ? {} : { discordId: id }) },
            ...(item.guid === undefined && item.name === undefined
              ? {}
              : { character: character?.name ?? item.name ?? item.guid }),
            ...(item.role === undefined ? {} : { role: item.role }),
            ...(item.note === undefined ? {} : { note: item.note }),
            at: item.at,
            expiresAt: item.at + ASK_EXPIRE_SECONDS,
          },
        },
        now,
      );
      return { outcome: "applied" };
    }
    case "ping": {
      const runId = siteRunId(item.run);
      const run = runId === undefined ? undefined : getRun(db, runId);
      if (run === undefined) return { outcome: "unknown_run" };
      if (!getBotSettings(db).runs) return { outcome: "off" };
      const data = loadState(db)?.data;
      const ids = discordIds(db);
      const target = item.battleTag ?? (item.guid === undefined ? undefined : runCharacter(data, item.guid)?.owner);
      const targetId = target === undefined ? undefined : ids.get(battleTagKey(target));
      const fromId = ids.get(battleTagKey(battleTag));
      enqueueBotEvent(
        db,
        "ping",
        {
          run: runPayload(db, run, now, data),
          from: { name: displayName(data, battleTag), ...(fromId === undefined ? {} : { discordId: fromId }) },
          to: {
            ...(target === undefined ? {} : { name: displayName(data, target) }),
            ...(item.name === undefined ? {} : { character: item.name }),
            ...(targetId === undefined ? {} : { discordId: targetId }),
          },
        },
        now,
      );
      return { outcome: "applied", runId: run.id };
    }
  }
}

/** The ids of a player's items the site has, newest first, for the game to forget (`received`, at most 200). */
export function receivedIds(db: Db, battleTag: string, limit = 200): string[] {
  return db
    .select({ id: gameItems.id, battleTag: gameItems.battleTag })
    .from(gameItems)
    .orderBy(desc(gameItems.receivedAt), desc(gameItems.at))
    .all()
    .filter((r) => sameBattleTag(r.battleTag, battleTag))
    .slice(0, limit)
    .map((r) => r.id);
}

/** Answers from the game an upload brought ("N run answers"), for its report after a rebuild too. */
export function runAnswersOf(db: Db, uploadId: number): number {
  return db
    .select({ id: gameItems.id })
    .from(gameItems)
    .where(and(eq(gameItems.uploadId, uploadId), eq(gameItems.kind, "answer"), eq(gameItems.result, "applied")))
    .all().length;
}

/**
 * Runs that started in the last 4 hours and that the stored run log now shows: "Ran it · N of M came" (decided with
 * Nico, 2026-10-27), when the admin's "Mark runs done from uploads" is on.
 */
export function markRanIt(db: Db, now: number): number {
  if (!getBotSettings(db).markDone) return 0;
  const candidates = db
    .select({ id: runs.id })
    .from(runs)
    .where(
      and(
        isNull(runs.cancelledAt),
        isNull(runs.outcome),
        lte(runs.startsAt, now),
        gte(runs.startsAt, now - OUTCOME_SECONDS),
      ),
    )
    .all();
  let marked = 0;
  for (const { id } of candidates) {
    const run = getRun(db, id)!;
    const cache = new Map<number, Record<string, FeedDay>>();
    const day = (d: number) => {
      let entries = cache.get(d);
      if (entries === undefined) {
        entries = Object.fromEntries(
          db
            .select({ guid: feedDays.guid, data: feedDays.data })
            .from(feedDays)
            .where(eq(feedDays.day, d))
            .all()
            .map((r) => [r.guid, r.data]),
        );
        cache.set(d, entries);
      }
      return entries;
    };
    const ran = ranIt(run, day);
    if (ran !== undefined && setOutcome(db, id, { kind: "done", at: now, ...ran }, now)) marked++;
  }
  return marked;
}
