import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { battleTagKey, sameBattleTag } from "@/core/access";
import type { FeedDay } from "@/core/feed";
import { ASK_EXPIRE_SECONDS, siteRunId, type GameItem, type GameRole } from "@/core/gameItems";
import { OUTCOME_SECONDS, ranIt } from "@/core/runOutcome";
import { runDungeon, runDungeonByAddonId, type SlotRole } from "@/core/runs";
import { enqueueBotEvent } from "./bot";
import { cutoffAt } from "./cutoff";
import type { Db } from "./db";
import type { Dataset } from "@/core/model";
import { feedDays, gameItemCarriers, gameItems, runs } from "./db/schema";
import { getBotSettings } from "./discord";
import {
  answerAskFor,
  answerRunFor,
  askFor,
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
// whether a planned run happened, from the stored run log. Called after the upload's transaction. WEB-53: an ask
// of another community member carried in the file is theirs (once, by the asker's item id; each carrier is kept),
// and an in-game answer to an ask (`askAnswer`) answers it as a Discord answer would. Plans, answers and pings are
// only taken as the uploader's own.

/** The addon's role (tank | heal | dps) as a group slot (WEB-47); undefined when the game sent none. */
function slotFromGame(role: GameRole | undefined): SlotRole | undefined {
  return role === "tank" ? "tank" : role === "heal" ? "healer" : role === "dps" ? "damage" : undefined;
}

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
  const data = loadState(db)?.data;
  for (const item of items) {
    // A friend's ask in this file (WEB-53): the asker's, carried by the uploader.
    const asker = item.kind === "ask" ? askerOf(data, item, battleTag) : battleTag;
    const carried = asker === undefined || !sameBattleTag(asker, battleTag);
    if (carried) {
      db.insert(gameItemCarriers)
        .values({ id: item.id, battleTag, uploadId, receivedAt: now })
        .onConflictDoNothing()
        .run();
    }
    if (known.has(item.id)) continue;
    known.add(item.id);
    const { outcome, runId } =
      asker === undefined ? { outcome: "not_member", runId: undefined } : apply(db, asker, item, now);
    if (item.kind === "answer" && outcome === "applied") result.runAnswers++;
    db.insert(gameItems)
      .values({
        id: item.id,
        battleTag: asker ?? battleTag,
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

/**
 * Whose ask an `ask` item is (WEB-53): the owner of its character, else the person its `battleTag` names, else the
 * uploader's own (files from before CF-51 name no one). Undefined: a friend the community's data doesn't know.
 */
function askerOf(
  data: Dataset | undefined,
  item: Extract<GameItem, { kind: "ask" }>,
  uploader: string,
): string | undefined {
  if (item.guid !== undefined) {
    const owner = runCharacter(data, item.guid)?.owner;
    if (owner !== undefined && owner !== "") return owner;
  }
  if (item.battleTag !== undefined && !sameBattleTag(item.battleTag, uploader)) {
    const person = Object.values(data?.people ?? {}).find((p) => sameBattleTag(p.battleTag ?? p.key, item.battleTag!));
    return person === undefined ? undefined : (person.battleTag ?? person.key);
  }
  return uploader;
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
      const lead = item.guid === undefined ? {} : { leadGuid: item.guid };
      const role = slotFromGame(item.role);
      let planned = planRunFor(db, { ...request, ...lead, ...(role === undefined ? {} : { leadRole: role }) }, now);
      // A role the class can't play: the character's own role (WEB-47).
      if (planned === "role_not_for_class") planned = planRunFor(db, { ...request, ...lead }, now);
      // The lead the game picked doesn't fit (or isn't known yet): organiser without a slot.
      if (planned === "lead_out_of_range" || planned === "lead_not_yours") planned = planRunFor(db, request, now);
      return typeof planned === "string" ? { outcome: planned } : { outcome: "applied", runId: planned.id };
    }
    case "answer": {
      const runId = siteRunId(item.run);
      if (runId === undefined) return { outcome: "unknown_run" };
      const request = {
        battleTag,
        answer: item.answer,
        source: "game" as const,
        ...(item.guid === undefined ? {} : { guid: item.guid }),
        ...(item.note === undefined ? {} : { note: item.note }),
      };
      const role = slotFromGame(item.role);
      let answered = answerRunFor(db, runId, { ...request, ...(role === undefined ? {} : { role }) }, now);
      // A role the class can't play: the character's own role (WEB-47).
      if (answered === "role_not_for_class") answered = answerRunFor(db, runId, request, now);
      return typeof answered === "string" ? { outcome: answered, runId } : { outcome: "applied", runId };
    }
    case "ask": {
      // An ask lasts 10 minutes from when it was made in game (story WEB-43); stored as an ask (WEB-51) whatever the
      // admin's "Ask now from the game" says, which only decides whether Discord gets it.
      if (now - item.at > ASK_EXPIRE_SECONDS) return { outcome: "expired" };
      const dungeon = runDungeonByAddonId(item.dungeon) ?? runDungeon(item.dungeon);
      if (dungeon === undefined) return { outcome: "unknown_dungeon" };
      const role = slotFromGame(item.role);
      const request = {
        dungeonId: dungeon.id,
        organiser: battleTag,
        source: "game" as const,
        at: item.at,
        ...(item.note === undefined ? {} : { note: item.note }),
      };
      let asked = askFor(
        db,
        {
          ...request,
          ...(item.guid === undefined ? {} : { leadGuid: item.guid }),
          ...(role === undefined ? {} : { leadRole: role }),
        },
        now,
      );
      // A character the site can't use as the asker's: the ask still goes out, without one.
      if (asked === "lead_out_of_range" || asked === "lead_not_yours" || asked === "role_not_for_class") {
        asked = askFor(db, request, now);
      }
      return typeof asked === "string" ? { outcome: asked } : { outcome: "applied", runId: asked.id };
    }
    case "askAnswer": {
      // The ask by its item id (WEB-53): answered as from Discord, but with source "game".
      const ask = db.select().from(gameItems).where(eq(gameItems.id, item.ask)).get();
      if (ask === undefined || ask.kind !== "ask" || ask.runId === null) return { outcome: "unknown_ask" };
      const request = {
        battleTag,
        answer: item.answer,
        source: "game" as const,
        ...(item.guid === undefined ? {} : { guid: item.guid }),
      };
      const role = slotFromGame(item.role);
      let answered = answerAskFor(db, ask.runId, { ...request, ...(role === undefined ? {} : { role }) }, now);
      if (answered === "role_not_for_class") answered = answerAskFor(db, ask.runId, request, now);
      return typeof answered === "string"
        ? { outcome: answered, runId: ask.runId }
        : { outcome: "applied", runId: ask.runId };
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
  const own = db
    .select({ id: gameItems.id, battleTag: gameItems.battleTag, receivedAt: gameItems.receivedAt })
    .from(gameItems)
    .all()
    .filter((r) => sameBattleTag(r.battleTag, battleTag));
  // WEB-53: friends' asks this player carried, so their game forgets them too.
  const carried = db
    .select({ id: gameItemCarriers.id, battleTag: gameItemCarriers.battleTag, receivedAt: gameItemCarriers.receivedAt })
    .from(gameItemCarriers)
    .all()
    .filter((r) => sameBattleTag(r.battleTag, battleTag));
  const seen = new Set<string>();
  return [...own, ...carried]
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .filter((r) => !seen.has(r.id) && seen.add(r.id))
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
        eq(runs.kind, "run"),
        isNull(runs.cancelledAt),
        isNull(runs.outcome),
        lte(runs.startsAt, now),
        gte(runs.startsAt, Math.max(now - OUTCOME_SECONDS, cutoffAt(db))),
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
