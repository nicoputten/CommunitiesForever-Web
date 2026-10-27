import { battleTagKey } from "./access";
import { RUNNABLE_DUNGEONS, rolesFor, type GroupRole, type LevelRange, type RunnableDungeon } from "./gamedata";
import { levelFit } from "./levelFit";
import type { Role } from "./views/characters";

// Planned runs (WEB-40, WEB-47; docs/STORIES-COMPLETED.md): the slots, who may answer what with which role, reserve,
// moving up and the organiser's moves. Pure: the stored run and its answers come in, the new answers and what happened
// go out. Times are Unix seconds (UTC).

/** The five slots of a group (story WEB-40). */
export type SlotRole = GroupRole;
export const SLOTS: Readonly<Record<SlotRole, number>> = { tank: 1, healer: 1, damage: 3 };
export const SLOT_ROLES: readonly SlotRole[] = ["tank", "healer", "damage"];

/** `reserve` (WEB-47): said I'm in while the role was full; moves up first when a slot of that role frees. */
export type Answer = "in" | "maybe" | "cant" | "reserve";
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

/**
 * A dungeon a run can be planned for by the addon's id (WEB-43: plans and asks from the game): `smarm`, `lfg1984`.
 * The addon's Upper Blackrock Spire (`ubrs`) is the site's one Blackrock Spire too.
 */
export function runDungeonByAddonId(addonId: string): RunnableDungeon | undefined {
  const id = addonId === "ubrs" ? "lbrs" : addonId;
  return RUNNABLE_DUNGEONS.find((d) => d.addonId === id);
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
  /** The slot the character fills (or would): chosen per sign-up, one its class can play (WEB-47). */
  role: SlotRole;
  source: RunSource;
  /** When the answer was last given (Unix seconds); reserves and Maybes move up in this order. */
  answeredAt: number;
  /** Moved up from reserve or Maybe when a slot freed. */
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
  /** WEB-43: "Ran it · N of M came" or "didn't happen". */
  outcome?: RunOutcome;
}

export type RunOutcome =
  { kind: "done"; at: number; came: number; signedUp: number } | { kind: "didntHappen"; at: number };

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
  /** In, Maybe or Can't; reserve is what an I'm in on a full role becomes. */
  answer: "in" | "maybe" | "cant";
  source: RunSource;
  /** The character answered with and what the site knows of it. */
  character?: { guid: string; level?: number; role?: Role; classFile?: string };
  /** The role chosen for this run (WEB-47); default the role the addon reports. */
  role?: SlotRole;
}

export type AnswerRefusal =
  /** The run is cancelled or already started. */
  | "closed"
  /** I'm in needs a character. */
  | "no_character"
  /** I'm in needs a character that may join (levelFit: not 6+ below); Maybe and Can't always go. */
  | "out_of_range"
  /** The character's class can't play that role (rolesFor). */
  | "role_not_for_class";

export interface AnswerOutcome {
  answers: RunAnswer[];
  /** The answer as stored: I'm in on a full role is stored as reserve. */
  stored: RunAnswer;
  /** Who moved up into the slot this answer freed (they get a quiet notice). */
  movedUp?: RunAnswer;
}

type LevelOf = (guid: string) => number | undefined;

/**
 * A slot of a full role freed: the oldest reserve of that role moves up, else the first Maybe for it, in answer order,
 * whose character may join (decided with Nico, 2026-10-27). A role that wasn't full pulls nobody in: a Maybe there
 * chose Maybe. `before` are the answers before the change, `next` after it.
 */
function moveUp(
  run: { range: LevelRange },
  before: readonly RunAnswer[],
  next: RunAnswer[],
  freed: SlotRole,
  levelOf: LevelOf,
  except: RunAnswer | undefined,
): { answers: RunAnswer[]; movedUp?: RunAnswer } {
  if (!(openSlots(before)[freed] <= 0 && openSlots(next)[freed] > 0)) return { answers: next };
  const waiting = (kind: Answer) =>
    next
      .filter((a) => a !== except && a.answer === kind && a.role === freed && a.guid !== undefined)
      .sort((x, y) => x.answeredAt - y.answeredAt)
      .find((a) => levelFit(levelOf(a.guid!), run.range.min, run.range.max).canPick);
  const first = waiting("reserve") ?? waiting("maybe");
  if (first === undefined) return { answers: next };
  const up: RunAnswer = { ...first, answer: "in", movedUp: true };
  return { answers: next.map((a) => (a === first ? up : a)), movedUp: up };
}

/**
 * Gives a friend's answer: it replaces their earlier one. I'm in needs a character that may join (levelFit) and a role
 * its class can play; on a full role it is kept as reserve. When an I'm in leaves a full role, the oldest reserve (else
 * the first Maybe) for that role moves up. `levelOf` gives a character's level now.
 */
export function giveAnswer(
  run: RunCore & { range: LevelRange },
  answers: readonly RunAnswer[],
  input: AnswerInput,
  now: number,
  levelOf: LevelOf,
): AnswerOutcome | AnswerRefusal {
  if (run.cancelledAt !== undefined || now >= run.startsAt) return "closed";
  const role = input.role ?? slotRole(input.character?.role);
  if (input.character !== undefined && !rolesFor(input.character.classFile).includes(role)) {
    return "role_not_for_class";
  }
  if (input.answer === "in") {
    if (input.character === undefined) return "no_character";
    if (!levelFit(input.character.level, run.range.min, run.range.max).canPick) return "out_of_range";
  }
  const key = battleTagKey(input.battleTag);
  const before = answers.find((a) => battleTagKey(a.battleTag) === key);
  const others = answers.filter((a) => a !== before);
  const stored: RunAnswer = {
    battleTag: input.battleTag,
    answer: input.answer,
    role,
    source: input.source,
    answeredAt: now,
  };
  if (input.character !== undefined) stored.guid = input.character.guid;
  if (stored.answer === "in" && openSlots(others)[role] <= 0) stored.answer = "reserve";
  const next = [...others, stored];
  if (before?.answer === "in" && !(stored.answer === "in" && stored.role === before.role)) {
    return { ...moveUp(run, answers, next, before.role, levelOf, stored), stored };
  }
  return { answers: next, stored };
}

// --- the organiser's moves (WEB-47) -------------------------------------------------------------------------------

/** Where the organiser (or the admin) moves a sign-up: another role, reserve, or off the run. */
export type MoveTo = SlotRole | "reserve" | "remove";

export type MoveRefusal =
  | "closed"
  /** No sign-up with that character. */
  | "unknown_sign_up"
  /** The role has no open slot. */
  | "role_full"
  | "role_not_for_class"
  /** It already is there. */
  | "same";

export interface MoveOutcome {
  answers: RunAnswer[];
  /** The sign-up as it is now; undefined when removed. */
  moved?: RunAnswer;
  /** Who moved up into a slot the move freed. */
  movedUp?: RunAnswer;
}

/**
 * Moves the sign-up with character `guid`: into another role's open slot (as I'm in), to reserve, or off the run (its
 * answer removed; they may answer again, decided with Nico 2026-10-27). A slot it frees pulls up the oldest reserve,
 * else the first Maybe. Rights are the caller's (mayEdit, or the admin).
 */
export function moveSignUp(
  run: RunCore & { range: LevelRange },
  answers: readonly RunAnswer[],
  guid: string,
  to: MoveTo,
  now: number,
  levelOf: LevelOf,
  classOf: (guid: string) => string | undefined,
): MoveOutcome | MoveRefusal {
  if (run.cancelledAt !== undefined || now >= run.startsAt) return "closed";
  const target = answers.find((a) => a.guid === guid);
  if (target === undefined) return "unknown_sign_up";
  const others = answers.filter((a) => a !== target);
  let moved: RunAnswer | undefined;
  if (to === "reserve") {
    if (target.answer === "reserve") return "same";
    moved = { ...target, answer: "reserve" };
    delete moved.movedUp;
  } else if (to !== "remove") {
    if (!rolesFor(classOf(guid)).includes(to)) return "role_not_for_class";
    if (target.answer === "in" && target.role === to) return "same";
    if (openSlots(others)[to] <= 0) return "role_full";
    moved = { ...target, answer: "in", role: to };
  }
  const next = moved === undefined ? others : [...others, moved];
  const outcome: MoveOutcome = { answers: next };
  if (moved !== undefined) outcome.moved = moved;
  if (target.answer === "in" && !(moved?.answer === "in" && moved.role === target.role)) {
    const up = moveUp(run, answers, next, target.role, levelOf, moved);
    outcome.answers = up.answers;
    if (up.movedUp !== undefined) outcome.movedUp = up.movedUp;
  }
  return outcome;
}

// --- planning -----------------------------------------------------------------------------------------------------

export type PlanRefusal =
  "unknown_dungeon" | "time_passed" | "note_too_long" | "lead_not_yours" | "lead_out_of_range" | "role_not_for_class";

export interface PlanInput {
  dungeonId: string;
  startsAt: number;
  note?: string;
  organiser: string;
  source: RunSource;
  /** The organiser's character, when one may join ("organiser without a slot" otherwise), and its role. */
  lead?: { guid: string; level?: number; role?: Role; classFile?: string; owner: string; slot?: SlotRole };
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
  const { min, max } = dungeon.typicalLevels;
  if (!levelFit(input.lead.level, min, max).canPick) return "lead_out_of_range";
  const role = input.lead.slot ?? slotRole(input.lead.role);
  if (!rolesFor(input.lead.classFile).includes(role)) return "role_not_for_class";
  return {
    answers: [
      {
        battleTag: input.organiser,
        guid: input.lead.guid,
        answer: "in",
        role,
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
