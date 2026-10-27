import { battleTagKey } from "./access";
import { RUNNABLE_DUNGEONS, type LevelRange, type RunnableDungeon } from "./gamedata";
import type { Role } from "./views/characters";

// Planned runs (WEB-40, docs/STORIES-COMPLETED.md): the slots, who may answer what, and moving up from Maybe. Pure: the
// stored run and its answers come in, the new answers and what happened go out. Times are Unix seconds (UTC).

/** The five slots of a group (story WEB-40). */
export type SlotRole = "tank" | "healer" | "damage";
export const SLOTS: Readonly<Record<SlotRole, number>> = { tank: 1, healer: 1, damage: 3 };
export const SLOT_ROLES: readonly SlotRole[] = ["tank", "healer", "damage"];

export type Answer = "in" | "maybe" | "cant";
/** Where a run was planned or an answer given. */
export type RunSource = "website" | "discord" | "game";

/** A run moves to Past 2 hours after its start (decided with Nico, 2026-10-27). */
export const PAST_AFTER_SECONDS = 2 * 60 * 60;
/** The longest note. */
export const MAX_NOTE = 200;

/**
 * The slot a character fills: its role as the addon knows it (set by the player, else from talents). A character
 * without a known role counts as damage (decided with Nico, 2026-10-27).
 */
export function slotRole(role: Role | undefined): SlotRole {
  return role === "tank" ? "tank" : role === "heal" ? "healer" : "damage";
}

export function inRange(level: number | undefined, range: LevelRange): boolean {
  return level !== undefined && level >= range.min && level <= range.max;
}

/** A dungeon (or Scarlet Monastery wing) a run can be planned for, by id. */
export function runDungeon(id: string): RunnableDungeon | undefined {
  return RUNNABLE_DUNGEONS.find((d) => d.id === id);
}

export interface RunAnswer {
  /** The friend's BattleTag; one answer per friend per run. */
  battleTag: string;
  /** The character; required for I'm in. */
  guid?: string;
  answer: Answer;
  /** The slot the character fills (or would). */
  role: SlotRole;
  source: RunSource;
  /** When the answer was last given (Unix seconds); Maybes move up in this order. */
  answeredAt: number;
  /** Answered I'm in while the role was full: first in line (decided with Nico, 2026-10-27). */
  waitlisted?: boolean;
  /** Moved up from Maybe when a slot freed. */
  movedUp?: boolean;
}

/** What a run stores about itself (the rest is its answers). */
export interface RunCore {
  dungeonId: string;
  startsAt: number;
  /** The organiser's BattleTag. */
  organiser: string;
  cancelledAt?: number;
}

/** A stored run with its answers. */
export interface RunRecord extends RunCore {
  id: number;
  note?: string;
  source: RunSource;
  createdAt: number;
  updatedAt: number;
  cancelledBy?: string;
  answers: RunAnswer[];
}

export type RunPhase = "open" | "full" | "started" | "past" | "cancelled";

/** I'm in answers by slot, in answer order. */
export function group(answers: readonly RunAnswer[]): Record<SlotRole, RunAnswer[]> {
  const g: Record<SlotRole, RunAnswer[]> = { tank: [], healer: [], damage: [] };
  for (const a of [...answers].sort((x, y) => x.answeredAt - y.answeredAt)) if (a.answer === "in") g[a.role].push(a);
  return g;
}

export function openSlots(answers: readonly RunAnswer[]): Record<SlotRole, number> {
  const g = group(answers);
  return {
    tank: SLOTS.tank - g.tank.length,
    healer: SLOTS.healer - g.healer.length,
    damage: SLOTS.damage - g.damage.length,
  };
}

export function phase(run: RunCore, answers: readonly RunAnswer[], now: number): RunPhase {
  if (run.cancelledAt !== undefined) return "cancelled";
  if (now >= run.startsAt + PAST_AFTER_SECONDS) return "past";
  if (now >= run.startsAt) return "started";
  const open = openSlots(answers);
  return open.tank + open.healer + open.damage <= 0 ? "full" : "open";
}

/** Upcoming: not cancelled and not yet past. */
export function isUpcoming(run: RunCore, now: number): boolean {
  return run.cancelledAt === undefined && now < run.startsAt + PAST_AFTER_SECONDS;
}

export function counts(answers: readonly RunAnswer[]): { in: number; maybe: number; cant: number } {
  return {
    in: answers.filter((a) => a.answer === "in").length,
    maybe: answers.filter((a) => a.answer === "maybe").length,
    cant: answers.filter((a) => a.answer === "cant").length,
  };
}

// --- answering ----------------------------------------------------------------------------------------------------

export interface AnswerInput {
  battleTag: string;
  answer: Answer;
  source: RunSource;
  /** The character answered with and what the site knows of it. */
  character?: { guid: string; level?: number; role?: Role };
}

export type AnswerRefusal =
  /** The run is cancelled or already started. */
  | "closed"
  /** I'm in needs a character. */
  | "no_character"
  /** I'm in needs a character in the level range; Maybe and Can't don't. */
  | "out_of_range";

export interface AnswerOutcome {
  answers: RunAnswer[];
  /** The answer as stored: I'm in on a full role is stored as a waitlisted Maybe. */
  stored: RunAnswer;
  /** A Maybe who moved up into the slot this answer freed (they get a quiet notice). */
  movedUp?: RunAnswer;
}

/**
 * Gives a friend's answer: it replaces their earlier one. I'm in on a full role is kept as Maybe, first in line. When
 * an I'm in leaves a full role, the first Maybe for that role whose character is in range moves up. `levelOf` gives a
 * character's level now, for that range check.
 */
export function giveAnswer(
  run: RunCore & { range: LevelRange },
  answers: readonly RunAnswer[],
  input: AnswerInput,
  now: number,
  levelOf: (guid: string) => number | undefined,
): AnswerOutcome | AnswerRefusal {
  if (run.cancelledAt !== undefined || now >= run.startsAt) return "closed";
  if (input.answer === "in") {
    if (input.character === undefined) return "no_character";
    if (!inRange(input.character.level, run.range)) return "out_of_range";
  }
  const key = battleTagKey(input.battleTag);
  const before = answers.find((a) => battleTagKey(a.battleTag) === key);
  const others = answers.filter((a) => a !== before);
  const role = slotRole(input.character?.role);
  const stored: RunAnswer = {
    battleTag: input.battleTag,
    answer: input.answer,
    role,
    source: input.source,
    answeredAt: now,
  };
  if (input.character !== undefined) stored.guid = input.character.guid;
  if (stored.answer === "in" && openSlots(others)[role] <= 0) {
    stored.answer = "maybe";
    stored.waitlisted = true;
  }
  const next = [...others, stored];
  const outcome: AnswerOutcome = { answers: next, stored };
  // A slot of a full role freed: the first Maybe for it, in answer order, whose character is in range moves up. A
  // role that wasn't full pulls nobody in: a Maybe there chose Maybe.
  if (before?.answer === "in" && !(stored.answer === "in" && stored.role === before.role)) {
    const freed = before.role;
    if (openSlots(answers)[freed] <= 0 && openSlots(next)[freed] > 0) {
      const first = next
        .filter((a) => a !== stored && a.answer === "maybe" && a.role === freed && a.guid !== undefined)
        .sort((x, y) => x.answeredAt - y.answeredAt)
        .find((a) => inRange(levelOf(a.guid!), run.range));
      if (first !== undefined) {
        const up: RunAnswer = { ...first, answer: "in", movedUp: true };
        delete up.waitlisted;
        outcome.answers = next.map((a) => (a === first ? up : a));
        outcome.movedUp = up;
      }
    }
  }
  return outcome;
}

// --- planning -----------------------------------------------------------------------------------------------------

export type PlanRefusal = "unknown_dungeon" | "time_passed" | "note_too_long" | "lead_not_yours" | "lead_out_of_range";

export interface PlanInput {
  dungeonId: string;
  startsAt: number;
  note?: string;
  organiser: string;
  source: RunSource;
  /** The organiser's character, when one fits ("organiser without a slot" otherwise). */
  lead?: { guid: string; level?: number; role?: Role; owner: string };
}

/**
 * Checks a new run. The organiser's lead character takes its slot as their I'm in. Without one (none of theirs fits)
 * they are organiser without a slot.
 */
export function planRun(input: PlanInput, now: number): { answers: RunAnswer[] } | PlanRefusal {
  const dungeon = runDungeon(input.dungeonId);
  if (dungeon === undefined) return "unknown_dungeon";
  if (input.startsAt <= now) return "time_passed";
  if ((input.note ?? "").length > MAX_NOTE) return "note_too_long";
  if (input.lead === undefined) return { answers: [] };
  if (battleTagKey(input.lead.owner) !== battleTagKey(input.organiser)) return "lead_not_yours";
  if (!inRange(input.lead.level, dungeon.typicalLevels)) return "lead_out_of_range";
  return {
    answers: [
      {
        battleTag: input.organiser,
        guid: input.lead.guid,
        answer: "in",
        role: slotRole(input.lead.role),
        source: input.source,
        answeredAt: now,
      },
    ],
  };
}

/** Only the organiser edits; the organiser and the admin delete (story WEB-40). */
export function mayEdit(run: RunCore, battleTag: string): boolean {
  return battleTagKey(run.organiser) === battleTagKey(battleTag);
}

export function mayDelete(run: RunCore, battleTag: string, isAdmin: boolean): boolean {
  return isAdmin || mayEdit(run, battleTag);
}

/** A note as typed: WoW escapes and control characters out, trimmed; undefined when empty. */
export function cleanNote(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value
    .replace(/[\u0000-\u001f\u007f|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text === "" ? undefined : text;
}
