import { and, asc, eq, isNull, lte } from "drizzle-orm";
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
  phase,
  planRun,
  runDungeon,
  type Answer,
  type AnswerOutcome,
  type AnswerRefusal,
  type PlanRefusal,
  type RunAnswer,
  type RunRecord,
  type RunSource,
  type SlotRole,
} from "@/core/runs";
import { characterRole } from "@/core/views/characters";
import { enqueueBotEvent } from "./bot";
import type { Db } from "./db";
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
  if (row.waitlisted) a.waitlisted = true;
  if (row.movedUp) a.movedUp = true;
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
  if (row.cancelledAt !== null) r.cancelledAt = row.cancelledAt;
  if (row.cancelledBy !== null) r.cancelledBy = row.cancelledBy;
  return r;
}

/** Every run with its answers, by start. */
export function listRuns(db: Db): StoredRun[] {
  const rows = db.select().from(runs).orderBy(asc(runs.startsAt), asc(runs.id)).all();
  const answers = db.select().from(runAnswers).all();
  return rows.map((row) => runFrom(row, answers.filter((a) => a.runId === row.id).map(answerFrom)));
}

export function getRun(db: Db, id: number): StoredRun | undefined {
  const row = db.select().from(runs).where(eq(runs.id, id)).get();
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
        waitlisted: a.waitlisted === true,
        movedUp: a.movedUp === true,
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
function displayName(data: Dataset | undefined, battleTag: string): string {
  const person =
    data === undefined
      ? undefined
      : Object.values(data.people).find((p) => sameBattleTag(p.battleTag ?? p.key, battleTag));
  return person?.displayName ?? battleTag.split("#")[0]!;
}

function discordIds(db: Db): Map<string, string> {
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
    },
    source: run.source,
    state: phase(run, run.answers, now),
    open,
    counts: counts(run.answers),
    answers: [...run.answers]
      .sort((a, b) => a.answeredAt - b.answeredAt)
      .map((a) => ({
        ...person(a.battleTag),
        ...(a.guid === undefined ? {} : { character: runCharacter(data, a.guid)?.name ?? a.guid }),
        answer: a.answer,
        role: a.role,
        source: a.source,
        ...(a.movedUp ? { movedUp: true } : {}),
        ...(a.waitlisted ? { waitlisted: true } : {}),
      })),
  };
}

export type RunEventType = "runCreated" | "runChanged" | "runCancelled" | "runReminder" | "runStarting" | "runMovedUp";

/** Writes a run event when the admin's Runs switch is on; the reminders have their own switch. */
function runEvent(db: Db, type: RunEventType, run: StoredRun, now: number, extra: Record<string, unknown> = {}): void {
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
  let written = 0;
  const due = db
    .select()
    .from(runs)
    .where(and(isNull(runs.cancelledAt), lte(runs.startsAt, now + minutes * 60)))
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
  return written;
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
  answer: Answer;
  source: RunSource;
  /** Required for I'm in; it must be the friend's own. */
  guid?: string;
}

export function answerRunFor(
  db: Db,
  runId: number,
  req: AnswerRequest,
  now: number,
): AnswerOutcome | AnswerRefusal | RunMissing | "not_your_character" {
  const run = getRun(db, runId);
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
            },
          }),
    },
    now,
    (guid) => runCharacter(data, guid)?.level,
  );
  if (typeof outcome === "string") return outcome;
  db.transaction((tx) => {
    writeAnswers(tx as unknown as Db, runId, outcome.answers);
    tx.update(runs).set({ updatedAt: now }).where(eq(runs.id, runId)).run();
  });
  const after = getRun(db, runId)!;
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
