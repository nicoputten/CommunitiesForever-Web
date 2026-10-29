import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { battleTagKey, sameBattleTag } from "@/core/access";
import type { Dataset } from "@/core/model";
import {
  cleanNote,
  counts,
  giveAnswer,
  isUpcoming,
  MAX_NOTE,
  mayDelete,
  mayEdit,
  openSlots,
  SLOT_ROLES,
  slotRole,
  phase,
  planRun,
  runDungeon,
  moveSignUp,
  type MoveRefusal,
  type MoveTo,
  type AnswerOutcome,
  type AnswerRefusal,
  type PlanRefusal,
  type RunAnswer,
  type RunRecord,
  type RunSource,
  type SlotRole,
} from "@/core/runs";
import { rolesFor } from "@/core/gamedata";
import { levelFit, type FitKind } from "@/core/levelFit";
import { characterRole } from "@/core/views/characters";
import { OUTCOME_SECONDS } from "@/core/runOutcome";
import { ASK_EXPIRE_SECONDS } from "@/core/gameItems";
import { logChange } from "./admins";
import { enqueueBotEvent } from "./bot";
import type { Db } from "./db";
import { cutoffAt } from "./cutoff";
import { discordLinks, runAnswers, runs } from "./db/schema";
import { getBotSettings } from "./discord";
import { loadState } from "./uploads";

// Planned runs (WEB-40): stored on the site, planned and answered from the Runs pages and through the bot
// (docs/BOT-API.md). Every change writes a bot event when the admin's Runs switch is on (WEB-39).

export type StoredRun = RunRecord;

type RunRow = typeof runs.$inferSelect;
type AnswerRow = typeof runAnswers.$inferSelect;

function answerFrom(row: AnswerRow): RunAnswer {
  const a: RunAnswer = {
    battleTag: row.battleTag,
    answer: row.answer,
    role: row.role,
    source: row.source,
    answeredAt: row.answeredAt,
  };
  if (row.guid !== null) a.guid = row.guid;
  // A WEB-40 "Maybe, first in line" is a reserve (WEB-47).
  if (row.waitlisted && row.answer === "maybe") a.answer = "reserve";
  if (row.movedUp) a.movedUp = true;
  if (row.note !== null) a.note = row.note;
  return a;
}

function runFrom(row: RunRow, answers: RunAnswer[]): StoredRun {
  const r: StoredRun = {
    id: row.id,
    dungeonId: row.dungeonId,
    startsAt: row.startsAt,
    organiser: row.organiser,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    answers,
  };
  if (row.note !== null) r.note = row.note;
  if (row.kind === "ask") {
    r.kind = "ask";
    if (row.expiresAt !== null) r.expiresAt = row.expiresAt;
  }
  if (row.cancelledAt !== null) r.cancelledAt = row.cancelledAt;
  if (row.cancelledBy !== null) r.cancelledBy = row.cancelledBy;
  if (row.outcome === "done" && row.outcomeAt !== null) {
    r.outcome = { kind: "done", at: row.outcomeAt, came: row.came ?? 0, signedUp: row.signedUp ?? 0 };
  } else if (row.outcome === "didntHappen" && row.outcomeAt !== null) {
    r.outcome = { kind: "didntHappen", at: row.outcomeAt };
  }
  return r;
}

/** Every run with its answers, by start; asks (WEB-51) are left out. */
export function listRuns(db: Db): StoredRun[] {
  return listKind(db, "run");
}

/** WEB-62: runs and asks that start before the launch cut-off are hidden everywhere (kept in the database). */
const sinceCutoff = (db: Db) => gte(runs.startsAt, cutoffAt(db));

function listKind(db: Db, kind: "run" | "ask"): StoredRun[] {
  const rows = db
    .select()
    .from(runs)
    .where(and(eq(runs.kind, kind), sinceCutoff(db)))
    .orderBy(asc(runs.startsAt), asc(runs.id))
    .all();
  const answers = db.select().from(runAnswers).all();
  return rows.map((row) => runFrom(row, answers.filter((a) => a.runId === row.id).map(answerFrom)));
}

/** A run by id; an ask (WEB-51) only when asked for with `kind` "ask". */
export function getRun(db: Db, id: number, kind: "run" | "ask" = "run"): StoredRun | undefined {
  const row = db
    .select()
    .from(runs)
    .where(and(eq(runs.id, id), eq(runs.kind, kind), sinceCutoff(db)))
    .get();
  if (row === undefined) return undefined;
  return runFrom(row, db.select().from(runAnswers).where(eq(runAnswers.runId, id)).all().map(answerFrom));
}

function writeAnswers(db: Db, runId: number, answers: readonly RunAnswer[]): void {
  db.delete(runAnswers).where(eq(runAnswers.runId, runId)).run();
  for (const a of answers) {
    db.insert(runAnswers)
      .values({
        runId,
        key: battleTagKey(a.battleTag),
        battleTag: a.battleTag,
        guid: a.guid ?? null,
        answer: a.answer,
        role: a.role,
        source: a.source,
        answeredAt: a.answeredAt,
        waitlisted: false,
        movedUp: a.movedUp === true,
        note: a.note ?? null,
      })
      .run();
  }
}

// --- characters -----------------------------------------------------------------------------------------------------

export interface RunCharacter {
  guid: string;
  name?: string;
  level?: number;
  classFile?: string;
  role?: "tank" | "heal" | "dps";
  /** The owner's BattleTag. */
  owner?: string;
}

/** A character as the runs need it: its owner's BattleTag (people are keyed by BattleTag), level and role. */
export function runCharacter(data: Dataset | undefined, guid: string): RunCharacter | undefined {
  const c = data?.characters[guid];
  if (c === undefined || !c.hasRecord) return undefined;
  const owner = c.owner === undefined ? undefined : (data!.people[c.owner]?.battleTag ?? c.owner);
  const out: RunCharacter = { guid };
  if (c.name !== undefined) out.name = c.name;
  if (c.level !== undefined) out.level = c.level;
  if (c.classFile !== undefined) out.classFile = c.classFile;
  const role = characterRole(c);
  if (role !== undefined) out.role = role;
  if (owner !== undefined) out.owner = owner;
  return out;
}

/** A friend's characters with a record, highest level first. */
export function charactersOf(data: Dataset | undefined, battleTag: string): RunCharacter[] {
  if (data === undefined) return [];
  return Object.keys(data.characters)
    .map((guid) => runCharacter(data, guid))
    .filter((c): c is RunCharacter => c !== undefined && sameBattleTag(c.owner, battleTag))
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || (a.name ?? "").localeCompare(b.name ?? "", "en"));
}

// --- bot events -----------------------------------------------------------------------------------------------------

/** The friend's display name (never the BattleTag in a post). */
export function displayName(data: Dataset | undefined, battleTag: string): string {
  const person =
    data === undefined
      ? undefined
      : Object.values(data.people).find((p) => sameBattleTag(p.battleTag ?? p.key, battleTag));
  return person?.displayName ?? battleTag.split("#")[0]!;
}

export function discordIds(db: Db): Map<string, string> {
  return new Map(
    db
      .select()
      .from(discordLinks)
      .all()
      .map((l) => [l.key, l.discordId]),
  );
}

/** A run as the bot gets it (docs/BOT-API.md "Run events"): names, never BattleTags; Discord ids of linked friends. */
export function runPayload(db: Db, run: StoredRun, now: number, data = loadState(db)?.data) {
  const dungeon = runDungeon(run.dungeonId);
  const ids = discordIds(db);
  const lead = run.answers.find((a) => sameBattleTag(a.battleTag, run.organiser) && a.answer === "in");
  const person = (battleTag: string) => {
    const p: { name: string; discordId?: string } = { name: displayName(data, battleTag) };
    const id = ids.get(battleTagKey(battleTag));
    if (id !== undefined) p.discordId = id;
    return p;
  };
  const open = openSlots(run.answers);
  return {
    id: run.id,
    dungeon: {
      id: run.dungeonId,
      name: dungeon?.name ?? run.dungeonId,
      typicalLevels: dungeon?.typicalLevels ?? { min: 1, max: 60 },
    },
    startsAt: run.startsAt,
    ...(run.note === undefined ? {} : { note: run.note }),
    organiser: {
      ...person(run.organiser),
      ...(lead?.guid === undefined ? {} : { character: runCharacter(data, lead.guid)?.name ?? lead.guid }),
      ...(lead?.guid === undefined ? {} : characterFacts(data, lead.guid)),
    },
    source: run.source,
    state: phase(run, run.answers, now),
    open,
    counts: counts(run.answers),
    ...(run.outcome === undefined ? {} : { outcome: run.outcome }),
    couldFill: couldFill(data, run, open),
    answers: answersPayload(data, run, ids),
  };
}

/** A run's (or ask's) answers as the bot gets them, oldest first: names, never BattleTags. */
function answersPayload(data: Dataset | undefined, run: StoredRun, ids: Map<string, string>) {
  const person = (battleTag: string) => {
    const p: { name: string; discordId?: string } = { name: displayName(data, battleTag) };
    const id = ids.get(battleTagKey(battleTag));
    if (id !== undefined) p.discordId = id;
    return p;
  };
  return [...run.answers]
    .sort((a, b) => a.answeredAt - b.answeredAt)
    .map((a) => ({
      ...person(a.battleTag),
      ...(a.guid === undefined ? {} : { character: runCharacter(data, a.guid)?.name ?? a.guid }),
      // A reserve stays "maybe" with `reserve` for bots from before WEB-47 (optional fields within v1).
      answer: a.answer === "reserve" ? "maybe" : a.answer,
      role: a.role,
      source: a.source,
      ...(a.guid === undefined ? {} : { guid: a.guid, fit: fitOf(data, run, a.guid), ...characterFacts(data, a.guid) }),
      ...(a.movedUp ? { movedUp: true } : {}),
      ...(a.answer === "reserve" ? { reserve: true, waitlisted: true } : {}),
      ...(a.note === undefined ? {} : { note: a.note }),
    }));
}

export type RunEventType =
  "runCreated" | "runChanged" | "runCancelled" | "runReminder" | "runStarting" | "runMovedUp" | "runMoved" | "runEnded";

/** Writes a run event when the admin's Runs switch is on; the reminders have their own switch. */
export function runEvent(
  db: Db,
  type: RunEventType,
  run: StoredRun,
  now: number,
  extra: Record<string, unknown> = {},
): void {
  const settings = getBotSettings(db);
  if (!settings.runs || (type === "runReminder" && !settings.reminders)) return;
  enqueueBotEvent(db, type, { run: runPayload(db, run, now), ...extra }, now);
}

/** Those who answered I'm in or Maybe, as the bot mentions them (Discord ids of linked friends). */
function mentions(db: Db, run: StoredRun): string[] {
  const ids = discordIds(db);
  return run.answers
    .filter((a) => a.answer !== "cant")
    .map((a) => ids.get(battleTagKey(a.battleTag)))
    .filter((id): id is string => id !== undefined);
}

/**
 * Writes the reminder and "starting now" events that are due, each once (decided with Nico, 2026-10-27: made when the
 * bot polls, no scheduler). A run that started more than its reminder time ago gets no late reminder.
 */
export function writeDueRunEvents(db: Db, now: number): number {
  const minutes = getBotSettings(db).reminderMinutes;
  let written = markDidntHappen(db, now);
  const due = db
    .select()
    .from(runs)
    .where(and(eq(runs.kind, "run"), isNull(runs.cancelledAt), lte(runs.startsAt, now + minutes * 60), sinceCutoff(db)))
    .all()
    .filter((r) => r.remindedAt === null || (r.startingAt === null && r.startsAt <= now));
  for (const row of due) {
    const run = getRun(db, row.id)!;
    if (!isUpcoming(run, now)) continue;
    if (row.remindedAt === null) {
      db.update(runs).set({ remindedAt: now }).where(eq(runs.id, row.id)).run();
      if (now < row.startsAt) {
        runEvent(db, "runReminder", run, now, { mention: mentions(db, run), minutes });
        written++;
      }
    }
    if (row.startingAt === null && row.startsAt <= now) {
      db.update(runs).set({ startingAt: now }).where(eq(runs.id, row.id)).run();
      if (now < row.startsAt + minutes * 60) {
        runEvent(db, "runStarting", run, now, { mention: mentions(db, run) });
        written++;
      }
    }
  }
  return written + writeExpiredAsks(db, now);
}

// --- actions --------------------------------------------------------------------------------------------------------

export interface PlanRequest {
  dungeonId: string;
  startsAt: number;
  note?: unknown;
  organiser: string;
  source: RunSource;
  /** The organiser's character to lead as; none when none of theirs fits. */
  leadGuid?: string;
  /** The lead's role for this run (WEB-47); default the character's role from the addon. */
  leadRole?: SlotRole;
}

export function planRunFor(db: Db, req: PlanRequest, now: number): { id: number } | PlanRefusal {
  const data = loadState(db)?.data;
  const note = cleanNote(req.note);
  if (typeof req.note === "string" && req.note.trim().length > MAX_NOTE) return "note_too_long";
  const lead = req.leadGuid === undefined ? undefined : runCharacter(data, req.leadGuid);
  if (req.leadGuid !== undefined && lead === undefined) return "lead_not_yours";
  const checked = planRun(
    {
      dungeonId: req.dungeonId,
      startsAt: req.startsAt,
      organiser: req.organiser,
      source: req.source,
      ...(note === undefined ? {} : { note }),
      ...(lead === undefined
        ? {}
        : {
            lead: {
              guid: lead.guid,
              owner: lead.owner ?? "",
              ...(lead.level === undefined ? {} : { level: lead.level }),
              ...(lead.role === undefined ? {} : { role: lead.role }),
              ...(lead.classFile === undefined ? {} : { classFile: lead.classFile }),
              ...(req.leadRole === undefined ? {} : { slot: req.leadRole }),
            },
          }),
    },
    now,
  );
  if (typeof checked === "string") return checked;
  const id = db.transaction((tx) => {
    const { id } = tx
      .insert(runs)
      .values({
        dungeonId: req.dungeonId,
        startsAt: req.startsAt,
        note: note ?? null,
        organiser: req.organiser,
        source: req.source,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: runs.id })
      .get();
    writeAnswers(tx as unknown as Db, id, checked.answers);
    return id;
  });
  runEvent(db, "runCreated", getRun(db, id)!, now);
  return { id };
}

export type RunMissing = "unknown_run";

export interface AnswerRequest {
  battleTag: string;
  answer: "in" | "maybe" | "cant";
  source: RunSource;
  /** Required for I'm in; it must be the friend's own. */
  guid?: string;
  /** The role for this run (WEB-47); default the character's role from the addon. */
  role?: SlotRole;
  /** WEB-67: the note with an answer from the game. */
  note?: string;
}

export function answerRunFor(
  db: Db,
  runId: number,
  req: AnswerRequest,
  now: number,
): AnswerOutcome | AnswerRefusal | RunMissing | "not_your_character" {
  return answerFor(db, runId, "run", req, now);
}

function answerFor(
  db: Db,
  runId: number,
  kind: "run" | "ask",
  req: AnswerRequest,
  now: number,
): AnswerOutcome | AnswerRefusal | RunMissing | "not_your_character" {
  const run = getRun(db, runId, kind);
  if (run === undefined) return "unknown_run";
  const data = loadState(db)?.data;
  const character = req.guid === undefined ? undefined : runCharacter(data, req.guid);
  if (req.guid !== undefined && (character === undefined || !sameBattleTag(character.owner, req.battleTag))) {
    return "not_your_character";
  }
  const range = runDungeon(run.dungeonId)?.typicalLevels ?? { min: 1, max: 60 };
  const outcome = giveAnswer(
    { ...run, range },
    run.answers,
    {
      battleTag: req.battleTag,
      answer: req.answer,
      source: req.source,
      ...(character === undefined
        ? {}
        : {
            character: {
              guid: character.guid,
              ...(character.level === undefined ? {} : { level: character.level }),
              ...(character.role === undefined ? {} : { role: character.role }),
              ...(character.classFile === undefined ? {} : { classFile: character.classFile }),
            },
          }),
      ...(req.role === undefined ? {} : { role: req.role }),
      ...(req.note === undefined ? {} : { note: req.note }),
    },
    now,
    (guid) => runCharacter(data, guid)?.level,
  );
  if (typeof outcome === "string") return outcome;
  db.transaction((tx) => {
    writeAnswers(tx as unknown as Db, runId, outcome.answers);
    tx.update(runs).set({ updatedAt: now }).where(eq(runs.id, runId)).run();
  });
  const after = getRun(db, runId, kind)!;
  if (kind === "ask") {
    askEvent(db, "askChanged", after, now);
    return outcome;
  }
  runEvent(db, "runChanged", after, now, { changed: ["answers"] });
  if (outcome.movedUp !== undefined) {
    const id = discordIds(db).get(battleTagKey(outcome.movedUp.battleTag));
    runEvent(db, "runMovedUp", after, now, {
      who: { name: displayName(data, outcome.movedUp.battleTag), ...(id === undefined ? {} : { discordId: id }) },
    });
  }
  return outcome;
}

export type EditRefusal = RunMissing | "not_organiser" | "closed" | "time_passed" | "note_too_long";

/** The organiser changes day, time and note (decided with Nico, 2026-10-27: another dungeon is another run). */
export function editRun(
  db: Db,
  runId: number,
  battleTag: string,
  change: { startsAt?: number; note?: unknown },
  now: number,
): StoredRun | EditRefusal {
  const run = getRun(db, runId);
  if (run === undefined) return "unknown_run";
  if (!mayEdit(run, battleTag)) return "not_organiser";
  if (run.cancelledAt !== undefined || now >= run.startsAt) return "closed";
  if (change.startsAt !== undefined && change.startsAt <= now) return "time_passed";
  if (typeof change.note === "string" && change.note.trim().length > MAX_NOTE) return "note_too_long";
  const changed: string[] = [];
  const set: Partial<typeof runs.$inferInsert> = { updatedAt: now };
  if (change.startsAt !== undefined && change.startsAt !== run.startsAt) {
    set.startsAt = change.startsAt;
    // A new time gets its reminder and "starting now" again.
    set.remindedAt = null;
    set.startingAt = null;
    changed.push("startsAt");
  }
  if (change.note !== undefined) {
    const note = cleanNote(change.note) ?? null;
    if (note !== (run.note ?? null)) {
      set.note = note;
      changed.push("note");
    }
  }
  if (changed.length === 0) return run;
  db.update(runs).set(set).where(eq(runs.id, runId)).run();
  const after = getRun(db, runId)!;
  runEvent(db, "runChanged", after, now, { changed });
  return after;
}

/** Deleting cancels: the run stays for Discord ("cancelled") and history (story WEB-40). */
export function cancelRun(
  db: Db,
  runId: number,
  battleTag: string,
  isAdmin: boolean,
  now: number,
): StoredRun | RunMissing | "not_allowed" | "already_cancelled" {
  const run = getRun(db, runId);
  if (run === undefined) return "unknown_run";
  if (!mayDelete(run, battleTag, isAdmin)) return "not_allowed";
  if (run.cancelledAt !== undefined) return "already_cancelled";
  db.update(runs).set({ cancelledAt: now, cancelledBy: battleTag, updatedAt: now }).where(eq(runs.id, runId)).run();
  // An admin deleting someone else's run goes in the admin changes log (WEB-64).
  if (!mayEdit(run, battleTag)) {
    logChange(db, battleTag, "runDeleted", now, run.organiser, runDungeon(run.dungeonId)?.name ?? run.dungeonId);
  }
  const after = getRun(db, runId)!;
  runEvent(db, "runCancelled", after, now, {
    by: displayName(loadState(db)?.data, battleTag),
    mention: mentions(db, after),
  });
  return after;
}

/** The admin's "Send a test run post" (WEB-39's Discord page): a made-up run, marked as a test, never stored. */
export function sendTestRunPost(db: Db, adminName: string, now: number): number {
  const dungeon = runDungeon("sm-armory")!;
  return enqueueBotEvent(
    db,
    "runCreated",
    {
      test: true,
      run: {
        id: 0,
        dungeon: { id: dungeon.id, name: dungeon.name, typicalLevels: dungeon.typicalLevels },
        startsAt: now + 3 * 60 * 60,
        note: "A test post from the Discord page. Nothing was planned.",
        organiser: { name: adminName },
        source: "website",
        state: "open",
        open: { tank: 1, healer: 1, damage: 3 } satisfies Record<SlotRole, number>,
        counts: { in: 0, maybe: 0, cant: 0 },
        answers: [],
      },
    },
    now,
  );
}

// --- outcomes (WEB-43) ----------------------------------------------------------------------------------------------

/** A run ended more than this long ago is marked without a post: no news a day late (and none for older runs). */
const ENDED_POST_SECONDS = 24 * 60 * 60;

/** Stores how a run ended and, while it's news, writes `runEnded` for the bot. Only once per run. */
export function setOutcome(db: Db, runId: number, outcome: NonNullable<StoredRun["outcome"]>, now: number): boolean {
  const changed =
    db
      .update(runs)
      .set({
        outcome: outcome.kind,
        outcomeAt: outcome.at,
        came: outcome.kind === "done" ? outcome.came : null,
        signedUp: outcome.kind === "done" ? outcome.signedUp : null,
      })
      .where(and(eq(runs.id, runId), isNull(runs.outcome), isNull(runs.cancelledAt)))
      .run().changes > 0;
  if (!changed) return false;
  const run = getRun(db, runId)!;
  if (now - (run.startsAt + OUTCOME_SECONDS) < ENDED_POST_SECONDS) {
    runEvent(db, "runEnded", run, now, {
      outcome: outcome.kind,
      ...(outcome.kind === "done" ? { came: outcome.came, signedUp: outcome.signedUp } : {}),
    });
  }
  return true;
}

/**
 * Runs no upload showed within 4 hours of their start: "didn't happen" (story WEB-43), when the admin's "Mark runs
 * done from uploads" is on. Written when the bot polls, as the reminders are.
 */
export function markDidntHappen(db: Db, now: number): number {
  if (!getBotSettings(db).markDone) return 0;
  const due = db
    .select({ id: runs.id, startsAt: runs.startsAt })
    .from(runs)
    .where(
      and(
        eq(runs.kind, "run"),
        isNull(runs.cancelledAt),
        isNull(runs.outcome),
        lte(runs.startsAt, now - OUTCOME_SECONDS),
        sinceCutoff(db),
      ),
    )
    .all();
  let marked = 0;
  for (const r of due) {
    if (setOutcome(db, r.id, { kind: "didntHappen", at: r.startsAt + OUTCOME_SECONDS }, now)) marked++;
  }
  return marked;
}

// --- the organiser's moves (WEB-47) ---------------------------------------------------------------------------------

/** How a character's level fits the run (WEB-47 levelFit): its kind and label, for the bot and the uploader. */
export function fitOf(data: Dataset | undefined, run: StoredRun, guid: string): { kind: FitKind; label: string } {
  const range = runDungeon(run.dungeonId)?.typicalLevels ?? { min: 1, max: 60 };
  const fit = levelFit(runCharacter(data, guid)?.level, range.min, range.max);
  return { kind: fit.kind, label: fit.label };
}

export type MoveRefusalOrRights = MoveRefusal | RunMissing | "not_allowed";

/**
 * The organiser (or the admin) moves a sign-up to another role, to reserve, or off the run. The moved friend gets a
 * quiet notice (`runMoved`, a direct message rather than a channel post), as does anyone who moved up.
 */
export function moveRunSignUp(
  db: Db,
  runId: number,
  by: string,
  isAdmin: boolean,
  guid: string,
  to: MoveTo,
  now: number,
  swapWith?: string,
): StoredRun | MoveRefusalOrRights {
  const run = getRun(db, runId);
  if (run === undefined) return "unknown_run";
  if (!isAdmin && !mayEdit(run, by)) return "not_allowed";
  const data = loadState(db)?.data;
  const range = runDungeon(run.dungeonId)?.typicalLevels ?? { min: 1, max: 60 };
  const target = run.answers.find((a) => a.guid === guid);
  const outcome = moveSignUp(
    { ...run, range },
    run.answers,
    guid,
    to,
    now,
    (g) => runCharacter(data, g)?.level,
    (g) => runCharacter(data, g)?.classFile,
    swapWith,
  );
  if (typeof outcome === "string") return outcome;
  db.transaction((tx) => {
    writeAnswers(tx as unknown as Db, runId, outcome.answers);
    tx.update(runs).set({ updatedAt: now }).where(eq(runs.id, runId)).run();
  });
  const after = getRun(db, runId)!;
  runEvent(db, "runChanged", after, now, { changed: ["answers"] });
  const ids = discordIds(db);
  const who = (battleTag: string) => {
    const id = ids.get(battleTagKey(battleTag));
    return { name: displayName(data, battleTag), ...(id === undefined ? {} : { discordId: id }) };
  };
  // The quiet notice goes to whoever was moved by someone else; the organiser moving themselves gets none (WEB-49).
  const notify = (moved: { battleTag: string }, place: string) => {
    if (battleTagKey(moved.battleTag) === battleTagKey(by)) return;
    runEvent(db, "runMoved", after, now, { who: who(moved.battleTag), to: place, by: displayName(data, by) });
  };
  if (target !== undefined) notify(target, to === "remove" ? "removed" : to);
  if (outcome.swapped !== undefined) {
    notify(outcome.swapped, outcome.swapped.answer === "in" ? outcome.swapped.role : outcome.swapped.answer);
  }
  if (outcome.movedUp !== undefined) runEvent(db, "runMovedUp", after, now, { who: who(outcome.movedUp.battleTag) });
  return after;
}

// --- for the bot's run post (BOT-04) --------------------------------------------------------------------------------

/** A character's level and class for the run post ("37 · Femke", "39 Warlock"); optional fields within v1. */
function characterFacts(data: Dataset | undefined, guid: string): { level?: number; classFile?: string } {
  const c = runCharacter(data, guid);
  return {
    ...(c?.level === undefined ? {} : { level: c.level }),
    ...(c?.classFile === undefined ? {} : { classFile: c.classFile }),
  };
}

/** At most this many names per open role in "Could fill". */
export const COULD_FILL_MAX = 3;

/**
 * "Could fill the tank slot" (the bot's run post, BOT-04): per role with an open slot, up to three characters of
 * friends who haven't answered that fit or are over (WEB-47 levelFit) and whose class can play it; without one, the
 * closest below the range as `close`.
 */
export function couldFill(data: Dataset | undefined, run: StoredRun, open: Record<SlotRole, number>) {
  if (data === undefined) return [];
  const range = runDungeon(run.dungeonId)?.typicalLevels ?? { min: 1, max: 60 };
  const answered = new Set(run.answers.map((a) => battleTagKey(a.battleTag)));
  const candidates = Object.keys(data.characters)
    .map((guid) => runCharacter(data, guid))
    .filter((c): c is RunCharacter => c !== undefined && c.owner !== undefined && !answered.has(battleTagKey(c.owner)))
    .map((c) => ({ c, fit: levelFit(c.level, range.min, range.max) }));
  const show = ({ c, fit }: (typeof candidates)[number]) => ({
    name: displayName(data, c.owner!),
    character: c.name ?? c.guid,
    ...characterFacts(data, c.guid),
    fit: { kind: fit.kind, label: fit.label },
  });
  return SLOT_ROLES.filter((role) => open[role] > 0).map((role) => {
    const forRole = candidates.filter(({ c }) => rolesFor(c.classFile).includes(role) && slotRole(c.role) === role);
    const fitting = forRole
      .filter(({ fit }) => fit.suggested)
      .sort(
        (a, b) => Number(b.fit.kind === "fits") - Number(a.fit.kind === "fits") || (b.c.level ?? 0) - (a.c.level ?? 0),
      );
    const close = forRole
      .filter(({ c }) => c.level !== undefined && c.level < range.min)
      .sort((a, b) => (b.c.level ?? 0) - (a.c.level ?? 0));
    return {
      role,
      open: open[role],
      characters: fitting.slice(0, COULD_FILL_MAX).map(show),
      ...(fitting.length === 0 && close.length > 0 ? { close: close.slice(0, COULD_FILL_MAX).map(show) } : {}),
    };
  });
}

// --- asks (WEB-51) --------------------------------------------------------------------------------------------------

export interface AskRequest {
  dungeonId: string;
  note?: unknown;
  organiser: string;
  source: RunSource;
  /** The asker's character and its role (as for a run's lead); none when none of theirs may join. */
  leadGuid?: string;
  leadRole?: SlotRole;
  /** When it was made: in game for an ask from an upload (WEB-43), else now. */
  at?: number;
}

/** An ask: a run that starts when it is made and takes answers for 10 minutes, without slots (Nico, 2026-10-28). */
export function askFor(db: Db, req: AskRequest, now: number): { id: number } | PlanRefusal {
  const data = loadState(db)?.data;
  const at = req.at ?? now;
  const note = cleanNote(req.note);
  if (typeof req.note === "string" && req.note.trim().length > MAX_NOTE) return "note_too_long";
  const lead = req.leadGuid === undefined ? undefined : runCharacter(data, req.leadGuid);
  if (req.leadGuid !== undefined && lead === undefined) return "lead_not_yours";
  const checked = planRun(
    {
      dungeonId: req.dungeonId,
      startsAt: at,
      organiser: req.organiser,
      source: req.source,
      ask: true,
      ...(note === undefined ? {} : { note }),
      ...(lead === undefined
        ? {}
        : {
            lead: {
              guid: lead.guid,
              owner: lead.owner ?? "",
              ...(lead.level === undefined ? {} : { level: lead.level }),
              ...(lead.role === undefined ? {} : { role: lead.role }),
              ...(lead.classFile === undefined ? {} : { classFile: lead.classFile }),
              ...(req.leadRole === undefined ? {} : { slot: req.leadRole }),
            },
          }),
    },
    at,
  );
  if (typeof checked === "string") return checked;
  const id = db.transaction((tx) => {
    const { id } = tx
      .insert(runs)
      .values({
        dungeonId: req.dungeonId,
        startsAt: at,
        note: note ?? null,
        organiser: req.organiser,
        source: req.source,
        createdAt: now,
        updatedAt: now,
        kind: "ask",
        expiresAt: at + ASK_EXPIRE_SECONDS,
      })
      .returning({ id: runs.id })
      .get();
    writeAnswers(tx as unknown as Db, id, checked.answers);
    return id;
  });
  askEvent(db, "askNow", getRun(db, id, "ask")!, now);
  return { id };
}

export function answerAskFor(
  db: Db,
  askId: number,
  req: AnswerRequest,
  now: number,
): AnswerOutcome | AnswerRefusal | RunMissing | "not_your_character" {
  return answerFor(db, askId, "ask", req, now);
}

/** Asks still taking answers, oldest first. */
export function openAsks(db: Db, now: number): StoredRun[] {
  return listKind(db, "ask").filter((a) => a.cancelledAt === undefined && (a.expiresAt ?? a.startsAt) > now);
}

export type AskEventType = "askNow" | "askChanged" | "askExpired";

/**
 * An ask's bot event: an ask from the game only with the admin's "Ask now from the game", one from Discord with the
 * Runs switch (story WEB-51). Stored either way.
 */
export function askEvent(db: Db, type: AskEventType, ask: StoredRun, now: number): void {
  const settings = getBotSettings(db);
  if (ask.source === "game" ? !settings.askNow : !settings.runs) return;
  enqueueBotEvent(db, type, { ask: askPayload(db, ask, now) }, now);
}

/** Asks past their 10 minutes: `askExpired` once each, so the bot ends the post (written when the bot polls). */
function writeExpiredAsks(db: Db, now: number): number {
  const due = db
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.kind, "ask"), isNull(runs.expiredAt), lte(runs.expiresAt, now), sinceCutoff(db)))
    .all();
  for (const { id } of due) {
    db.update(runs).set({ expiredAt: now }).where(eq(runs.id, id)).run();
    askEvent(db, "askExpired", getRun(db, id, "ask")!, now);
  }
  return due.length;
}

const GAME_ROLE: Record<SlotRole, "tank" | "heal" | "dps"> = { tank: "tank", healer: "heal", damage: "dps" };

/**
 * An ask as the bot gets it (docs/BOT-API.md `askNow`): the WEB-43 fields (`role` the addon's tank / heal / dps), now
 * with the stored ask's id, `state` and its answers as a run's.
 */
export function askPayload(db: Db, ask: StoredRun, now: number, data = loadState(db)?.data) {
  const dungeon = runDungeon(ask.dungeonId);
  const ids = discordIds(db);
  const lead = ask.answers.find((a) => sameBattleTag(a.battleTag, ask.organiser) && a.answer === "in");
  const fromId = ids.get(battleTagKey(ask.organiser));
  const expiresAt = ask.expiresAt ?? ask.startsAt;
  return {
    id: ask.id,
    dungeon: {
      id: ask.dungeonId,
      name: dungeon?.name ?? ask.dungeonId,
      typicalLevels: dungeon?.typicalLevels ?? { min: 1, max: 60 },
    },
    from: { name: displayName(data, ask.organiser), ...(fromId === undefined ? {} : { discordId: fromId }) },
    ...(lead?.guid === undefined ? {} : { character: runCharacter(data, lead.guid)?.name ?? lead.guid }),
    ...(lead === undefined ? {} : { role: GAME_ROLE[lead.role] }),
    ...(ask.note === undefined ? {} : { note: ask.note }),
    source: ask.source,
    at: ask.startsAt,
    expiresAt,
    state: ask.cancelledAt !== undefined ? "cancelled" : now >= expiresAt ? "expired" : "open",
    counts: counts(ask.answers),
    answers: answersPayload(data, ask, ids),
  };
}
