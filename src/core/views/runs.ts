import { sameBattleTag } from "../access";
import { RUNNABLE_DUNGEONS, classInfo, type LevelRange } from "../gamedata";
import {
  counts,
  group,
  inRange,
  isUpcoming,
  openSlots,
  phase,
  runDungeon,
  SLOT_ROLES,
  slotRole,
  type Answer,
  type RunAnswer,
  type RunPhase,
  type RunRecord,
  type RunSource,
  type SlotRole,
} from "../runs";
import { localTime, nextDays, runWhen, untilStart, weekEnd, type DayOption } from "../runTime";
import { byLevel, compareText, type CharacterView, type PersonView } from "./characters";
import { joinNames } from "./text";

// The Runs pages (WEB-40, boards `runs`, `run-detail`, `run-create`, `runs-phone`): the list by This week, Later and
// Past with its filters, a run's page, and Plan a run. Times in the viewer's own zone; names only.

export interface RunsInput {
  runs: readonly RunRecord[];
  /** Every character with a record (recordCharacters). */
  characters: readonly CharacterView[];
  people: readonly PersonView[];
  viewer: { battleTag: string; isAdmin: boolean; timeZone: string };
  /** A friend's own time zone (theirs, else the admin's). */
  timeZoneOf: (battleTag: string) => string;
  now: number;
}

export type RunsFilter = "join" | "mine" | "all";
export const RUNS_FILTERS: readonly { value: RunsFilter; label: string }[] = [
  { value: "join", label: "Runs I can join" },
  { value: "mine", label: "Mine" },
  { value: "all", label: "All" },
];

export function parseRunsFilter(value: unknown): RunsFilter {
  return value === "mine" || value === "all" ? value : "join";
}

export const ROLE_LABEL: Record<SlotRole, string> = { tank: "Tank", healer: "Healer", damage: "Damage" };
export const ANSWER_LABEL: Record<Answer, string> = { in: "I'm in", maybe: "Maybe", cant: "Can't" };
const SOURCE_LABEL: Record<RunSource, string> = { website: "Website", discord: "Discord", game: "In game" };
const PLANNED_ON: Record<RunSource, string> = { website: "on the website", discord: "in Discord", game: "in the game" };

export type PillTone = "open" | "soon" | "full" | "done" | "dim" | "cancelled";

export interface RunCharacterView {
  guid: string;
  name: string;
  level?: number;
  classFile?: string;
  className?: string;
  /** The class text colour token, for the name. */
  colorToken?: string;
  role: SlotRole;
  /** Whether its level is in the run's range. */
  fits: boolean;
  /** "2 levels short", "3 levels over"; undefined in range. */
  off?: string;
}

/** What the viewer can answer with: their characters, those in range first. */
export interface AnswerChoice {
  runId: number;
  characters: RunCharacterView[];
  /** The viewer's answer so far. */
  current?: { answer: Answer; guid?: string; waitlisted: boolean };
  /** Open: answers go. Closed: started or cancelled. */
  open: boolean;
}

export interface RunCardView {
  id: number;
  href: string;
  dungeon: string;
  range: string;
  /** "Today 20:30" in the viewer's zone. */
  when: string;
  /** "in 3 hours". */
  until: string;
  /** "20:00 for Bob": the organiser's own clock when their zone differs. */
  organiserTime?: string;
  phase: RunPhase;
  pill: { label: string; tone: PillTone };
  yours: boolean;
  /** "32–42 · You lead as Ves Doombringer · Lia Thornwhisper, Bob Example in · Tok Ironhide maybe". */
  line: string;
  /** "Tank still open: nobody in range", "Your Grom Ashfeller fits the open tank slot". */
  hint?: { text: string; tone: "warn" | "good" | "muted" };
  /** "3 in · 1 maybe". */
  tally: string;
  /** The five slots in order (tank, healer, damage × 3): filled or not. */
  slots: { role: SlotRole; filled: boolean }[];
  /** Answer buttons on the card: an upcoming run the viewer can join and hasn't answered. */
  answer?: AnswerChoice;
}

export interface PastRunView {
  id: number;
  href: string;
  day: string;
  dungeon: string;
  /** "Nico", "ask now from the game · Nico". */
  by: string;
  /** "Ran it", "Didn't happen", "Cancelled", or "3 in" before the outcome is known (WEB-43). */
  result: { label: string; tone: PillTone };
  /** "3 of 5 signed-up came", "no upload showed it". */
  detail?: string;
}

/** How a past run ended (WEB-43, runs board): its pill and the line after it. */
export function pastResult(run: RunRecord): Pick<PastRunView, "result" | "detail"> {
  if (run.cancelledAt !== undefined) return { result: { label: "Cancelled", tone: "cancelled" } };
  if (run.outcome?.kind === "done") {
    return {
      result: { label: "Ran it", tone: "done" },
      detail: `${run.outcome.came} of ${run.outcome.signedUp} signed-up came`,
    };
  }
  if (run.outcome?.kind === "didntHappen") {
    return { result: { label: "Didn't happen", tone: "dim" }, detail: "no upload showed it" };
  }
  return { result: { label: `${counts(run.answers).in} in`, tone: "done" } };
}

export interface YourAnswerView {
  href: string;
  dungeon: string;
  /** "organiser", "not answered", "maybe", "I'm in", "can't". */
  status: string;
}

export interface RunsPage {
  filter: RunsFilter;
  thisWeek: RunCardView[];
  later: RunCardView[];
  past: PastRunView[];
  /** "1 run hidden by “Runs I can join”: Zul'Farrak on Sun 8 Nov (44–54)." */
  hidden?: string;
  yourAnswers: YourAnswerView[];
  /** Upcoming runs at all (the empty state when none). */
  anyUpcoming: boolean;
  timeZone: string;
}

/** Past runs shown: the last few. */
export const PAST_SHOWN = 5;

// --- helpers --------------------------------------------------------------------------------------------------------

interface Ctx {
  input: RunsInput;
  byGuid: Map<string, CharacterView>;
  /** Person key → BattleTag. */
  battleTagOf: Map<string, string>;
}

function context(input: RunsInput): Ctx {
  return {
    input,
    byGuid: new Map(input.characters.map((c) => [c.guid, c])),
    battleTagOf: new Map(input.people.map((p) => [p.key, p.battleTag ?? p.key])),
  };
}

function ownerTag(ctx: Ctx, c: CharacterView): string | undefined {
  return c.owner === undefined ? undefined : (ctx.battleTagOf.get(c.owner) ?? c.owner);
}

/** The friend's display name (never the BattleTag). */
function friendName(ctx: Ctx, battleTag: string): string {
  const p = ctx.input.people.find((x) => sameBattleTag(x.battleTag ?? x.key, battleTag));
  return p?.displayName ?? battleTag.split("#")[0]!;
}

const isViewer = (ctx: Ctx, battleTag: string) => sameBattleTag(battleTag, ctx.input.viewer.battleTag);

function rangeText(r: LevelRange): string {
  return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}

function rangeOf(run: RunRecord): LevelRange {
  return runDungeon(run.dungeonId)?.typicalLevels ?? { min: 1, max: 60 };
}

function offText(level: number | undefined, r: LevelRange): string | undefined {
  if (level === undefined) return "level unknown";
  if (level < r.min) return `${r.min - level} level${r.min - level === 1 ? "" : "s"} short`;
  if (level > r.max) return `${level - r.max} level${level - r.max === 1 ? "" : "s"} over`;
  return undefined;
}

function characterView(c: CharacterView, r: LevelRange): RunCharacterView {
  const info = classInfo(c.classFile);
  const v: RunCharacterView = {
    guid: c.guid,
    name: c.name ?? c.guid,
    role: slotRole(c.role),
    fits: inRange(c.level, r),
  };
  if (c.level !== undefined) v.level = c.level;
  if (c.classFile !== undefined) v.classFile = c.classFile;
  if (c.className !== undefined) v.className = c.className;
  if (info !== undefined) v.colorToken = info.textToken;
  const off = offText(c.level, r);
  if (off !== undefined) v.off = off;
  return v;
}

/** The viewer's characters for a run: in range first (highest level first), then the others. */
function viewerCharacters(ctx: Ctx, r: LevelRange): RunCharacterView[] {
  return ctx.input.characters
    .filter((c) => {
      const tag = ownerTag(ctx, c);
      return tag !== undefined && isViewer(ctx, tag);
    })
    .sort(byLevel)
    .map((c) => characterView(c, r))
    .sort((a, b) => Number(b.fits) - Number(a.fits));
}

function pill(run: RunRecord, p: RunPhase, now: number): RunCardView["pill"] {
  const startsAt = run.startsAt;
  switch (p) {
    case "cancelled":
      return { label: "Cancelled", tone: "cancelled" };
    case "past":
      return run.outcome === undefined ? { label: "Past", tone: "done" } : pastResult(run).result;
    case "started":
      return { label: "Started", tone: "soon" };
    case "full":
      return { label: "Full", tone: "full" };
    case "open":
      return startsAt - now < 60 * 60 ? { label: "Soon", tone: "soon" } : { label: "Open", tone: "open" };
  }
}

function answerChoice(ctx: Ctx, run: RunRecord): AnswerChoice {
  const mine = run.answers.find((a) => isViewer(ctx, a.battleTag));
  const choice: AnswerChoice = {
    runId: run.id,
    characters: viewerCharacters(ctx, rangeOf(run)),
    open: run.cancelledAt === undefined && ctx.input.now < run.startsAt,
  };
  if (mine !== undefined) {
    choice.current = { answer: mine.answer, waitlisted: mine.waitlisted === true };
    if (mine.guid !== undefined) choice.current.guid = mine.guid;
  }
  return choice;
}

function charName(ctx: Ctx, a: RunAnswer): string {
  return a.guid === undefined ? friendName(ctx, a.battleTag) : (ctx.byGuid.get(a.guid)?.name ?? a.guid);
}

/** Roles open with no character in range of that role among those who haven't answered. */
function openWithNobody(ctx: Ctx, run: RunRecord): SlotRole[] {
  const r = rangeOf(run);
  const open = openSlots(run.answers);
  const answered = new Set(run.answers.map((a) => a.battleTag.toLowerCase()));
  return SLOT_ROLES.filter(
    (role) =>
      open[role] > 0 &&
      !ctx.input.characters.some((c) => {
        const tag = ownerTag(ctx, c);
        return (
          tag !== undefined && !answered.has(tag.toLowerCase()) && slotRole(c.role) === role && inRange(c.level, r)
        );
      }),
  );
}

function hint(ctx: Ctx, run: RunRecord, yours: boolean, choice: AnswerChoice): RunCardView["hint"] {
  const mine = run.answers.find((a) => isViewer(ctx, a.battleTag));
  if (mine !== undefined && !yours) {
    const withChar = mine.guid === undefined ? "" : ` with ${charName(ctx, mine)}`;
    const line = mine.waitlisted ? ", first in line" : "";
    return { text: `You answered ${ANSWER_LABEL[mine.answer]}${withChar}${line}`, tone: "muted" };
  }
  if (yours) {
    const nobody = openWithNobody(ctx, run);
    if (nobody.length > 0) {
      const roles = joinNames(nobody);
      return { text: `${roles[0]!.toUpperCase()}${roles.slice(1)} still open: nobody in range`, tone: "warn" };
    }
    return undefined;
  }
  const fitting = choice.characters.filter((c) => c.fits);
  if (fitting.length === 0) return undefined;
  const open = openSlots(run.answers);
  const forOpen = fitting.find((c) => open[c.role] > 0 && c.role !== "damage");
  if (forOpen !== undefined) return { text: `Your ${forOpen.name} fits the open ${forOpen.role} slot`, tone: "good" };
  return { text: `Your ${fitting[0]!.name} fits`, tone: "good" };
}

function line(ctx: Ctx, run: RunRecord): string {
  const r = rangeOf(run);
  const lead = run.answers.find((a) => sameBattleTag(a.battleTag, run.organiser) && a.answer === "in");
  const parts = [rangeText(r)];
  if (isViewer(ctx, run.organiser)) {
    parts.push(lead === undefined ? "You organise" : `You lead as ${charName(ctx, lead)}`);
  } else {
    const who = friendName(ctx, run.organiser);
    parts.push(lead === undefined ? `${who} organises` : `${who} on ${charName(ctx, lead)} (${lead.role})`);
  }
  const others = [...run.answers].filter((a) => a !== lead).sort((a, b) => a.answeredAt - b.answeredAt);
  const ins = others.filter((a) => a.answer === "in").map((a) => charName(ctx, a));
  const maybes = others.filter((a) => a.answer === "maybe").map((a) => charName(ctx, a));
  if (ins.length > 0) parts.push(`${ins.join(", ")} in`);
  if (maybes.length > 0) parts.push(`${maybes.join(", ")} maybe`);
  return parts.join(" · ");
}

function tally(run: RunRecord): string {
  const c = counts(run.answers);
  const parts = [`${c.in} in`];
  if (c.maybe > 0) parts.push(`${c.maybe} maybe`);
  return parts.join(" · ");
}

function slotBars(run: RunRecord): RunCardView["slots"] {
  const g = group(run.answers);
  const out: RunCardView["slots"] = [];
  for (const role of SLOT_ROLES) {
    const size = role === "damage" ? 3 : 1;
    for (let i = 0; i < size; i++) out.push({ role, filled: i < g[role].length });
  }
  return out;
}

/** "20:00 for Bob" when the organiser's clock differs from the viewer's. */
function organiserTime(ctx: Ctx, run: RunRecord): string | undefined {
  if (isViewer(ctx, run.organiser)) return undefined;
  const theirs = localTime(run.startsAt, ctx.input.timeZoneOf(run.organiser));
  const mine = localTime(run.startsAt, ctx.input.viewer.timeZone);
  return theirs === mine ? undefined : `${theirs} for ${friendName(ctx, run.organiser)}`;
}

/** Whether one of the viewer's characters is in the run's range. */
function viewerFits(ctx: Ctx, run: RunRecord): boolean {
  return viewerCharacters(ctx, rangeOf(run)).some((c) => c.fits);
}

function involved(ctx: Ctx, run: RunRecord): boolean {
  return isViewer(ctx, run.organiser) || run.answers.some((a) => isViewer(ctx, a.battleTag));
}

function card(ctx: Ctx, run: RunRecord): RunCardView {
  const { now } = ctx.input;
  const p = phase(run, run.answers, now);
  const yours = isViewer(ctx, run.organiser);
  const choice = answerChoice(ctx, run);
  const v: RunCardView = {
    id: run.id,
    href: `/runs/${run.id}`,
    dungeon: runDungeon(run.dungeonId)?.name ?? run.dungeonId,
    range: rangeText(rangeOf(run)),
    when: runWhen(run.startsAt, ctx.input.viewer.timeZone, now),
    until: untilStart(run.startsAt, now),
    phase: p,
    pill: pill(run, p, now),
    yours,
    line: line(ctx, run),
    tally: tally(run),
    slots: slotBars(run),
  };
  const other = organiserTime(ctx, run);
  if (other !== undefined) v.organiserTime = other;
  const h = hint(ctx, run, yours, choice);
  if (h !== undefined) v.hint = h;
  if (!yours && choice.current === undefined && choice.open && choice.characters.some((c) => c.fits)) v.answer = choice;
  return v;
}

// --- the list ---------------------------------------------------------------------------------------------------------

/** Upcoming runs the viewer can join (one of their characters fits) and hasn't answered: the top bar's badge. */
export function joinableUnanswered(input: RunsInput): number {
  const ctx = context(input);
  return input.runs.filter(
    (r) => isUpcoming(r, input.now) && input.now < r.startsAt && !involved(ctx, r) && viewerFits(ctx, r),
  ).length;
}

export function runsPage(input: RunsInput, filter: RunsFilter): RunsPage {
  const ctx = context(input);
  const { now } = input;
  const tz = input.viewer.timeZone;
  const upcoming = input.runs.filter((r) => isUpcoming(r, now)).sort((a, b) => a.startsAt - b.startsAt || a.id - b.id);
  const keep = (r: RunRecord) => filter === "all" || involved(ctx, r) || (filter === "join" && viewerFits(ctx, r));
  const shown = upcoming.filter(keep);
  const hiddenRuns = upcoming.filter((r) => !keep(r));
  const end = weekEnd(now, tz);
  const page: RunsPage = {
    filter,
    thisWeek: shown.filter((r) => r.startsAt < end).map((r) => card(ctx, r)),
    later: shown.filter((r) => r.startsAt >= end).map((r) => card(ctx, r)),
    past: input.runs
      .filter((r) => !isUpcoming(r, now) && (filter === "all" || involved(ctx, r) || filter === "join"))
      .sort((a, b) => b.startsAt - a.startsAt || b.id - a.id)
      .slice(0, PAST_SHOWN)
      .map((r) => ({
        id: r.id,
        href: `/runs/${r.id}`,
        day: runWhen(r.startsAt, tz, now).replace(/ \d{2}:\d{2}$/, ""),
        dungeon: runDungeon(r.dungeonId)?.name ?? r.dungeonId,
        by: `${r.source === "game" ? "ask now from the game · " : ""}${friendName(ctx, r.organiser)}`,
        ...pastResult(r),
      })),
    yourAnswers: upcoming
      .filter((r) => involved(ctx, r) || viewerFits(ctx, r))
      .map((r) => {
        const mine = r.answers.find((a) => isViewer(ctx, a.battleTag));
        const status = isViewer(ctx, r.organiser)
          ? "organiser"
          : mine === undefined
            ? "not answered"
            : ANSWER_LABEL[mine.answer].toLowerCase();
        return { href: `/runs/${r.id}`, dungeon: runDungeon(r.dungeonId)?.name ?? r.dungeonId, status };
      }),
    anyUpcoming: upcoming.length > 0,
    timeZone: tz,
  };
  if (hiddenRuns.length > 0 && filter !== "all") {
    const label = RUNS_FILTERS.find((f) => f.value === filter)!.label;
    const list = hiddenRuns.map(
      (r) =>
        `${runDungeon(r.dungeonId)?.name ?? r.dungeonId} on ${runWhen(r.startsAt, tz, now).replace(/ \d{2}:\d{2}$/, "")} (${rangeText(rangeOf(r))})`,
    );
    const n = hiddenRuns.length;
    page.hidden = `${n} run${n === 1 ? "" : "s"} hidden by “${label}”: ${joinNames(list)}.`;
  }
  return page;
}

// --- a run's page -----------------------------------------------------------------------------------------------------

export interface SlotView {
  role: SlotRole;
  /** Undefined: open. */
  who?: {
    character: string;
    level?: number;
    className?: string;
    colorToken?: string;
    friend: string;
    /** "organiser", "from talents", "set by player", "moved up". */
    note?: string;
  };
  /** For an open slot: "Nobody in range yet" or "Grom Ashfeller could". */
  open?: string;
}

export interface AnswerRowView {
  character: string;
  level?: number;
  colorToken?: string;
  friend: string;
  role: string;
  answer: string;
  answerTone: "in" | "maybe" | "cant" | "organiser";
  /** "Discord · 17:40" in the viewer's zone. */
  where: string;
}

export interface CouldJoinView {
  character: string;
  level?: number;
  colorToken?: string;
  friend: string;
  role: SlotRole;
  /** "2 levels short"; undefined when in range. */
  off?: string;
}

export interface RunDetail {
  card: RunCardView;
  /** "Planned by Nico on the website". */
  plannedBy: string;
  /** "Today 19:30 your time · 20:30 for Nico · in 3 hours". */
  time: string;
  /** "Levels 32–42 · organiser Ves Doombringer (39 Warlock)". */
  levels: string;
  note?: string;
  answer: AnswerChoice;
  /** Why I'm in is off, when none of the viewer's characters is in range. */
  outOfRange?: string;
  /** "Plan the Graveyard for Ruk": another wing that fits the viewer's best character. */
  planOther?: { label: string; href: string };
  group: string;
  slots: SlotView[];
  answers: AnswerRowView[];
  couldJoin: CouldJoinView[];
  mayEdit: boolean;
  mayDelete: boolean;
  /** The admin deleting someone else's run. */
  adminDelete: boolean;
  /** "Cancelled by Nico". */
  cancelled?: string;
  /** How it ended (WEB-43): "3 of 5 signed-up came", "no upload showed it". */
  outcome?: string;
}

/** Characters this many levels below a run's range still show under "Could join". */
export const COULD_JOIN_SHORT = 5;

export function runDetail(input: RunsInput, id: number): RunDetail | undefined {
  const ctx = context(input);
  const run = input.runs.find((r) => r.id === id);
  if (run === undefined) return undefined;
  const { now, viewer } = input;
  const r = rangeOf(run);
  const dungeon = runDungeon(run.dungeonId);
  const c = card(ctx, run);
  const lead = run.answers.find((a) => sameBattleTag(a.battleTag, run.organiser) && a.answer === "in");
  const leadChar = lead?.guid === undefined ? undefined : ctx.byGuid.get(lead.guid);
  const g = group(run.answers);
  const open = openSlots(run.answers);
  const answered = new Set(run.answers.map((a) => a.battleTag.toLowerCase()));
  const candidates = input.characters
    .filter((ch) => {
      const tag = ownerTag(ctx, ch);
      return tag !== undefined && !answered.has(tag.toLowerCase()) && ch.level !== undefined;
    })
    .filter((ch) => ch.level! >= r.min - COULD_JOIN_SHORT && ch.level! <= r.max)
    .filter((ch) => open[slotRole(ch.role)] > 0)
    .sort((a, b) => Number(inRange(b.level, r)) - Number(inRange(a.level, r)) || byLevel(a, b));

  const slots: SlotView[] = [];
  for (const role of SLOT_ROLES) {
    const size = role === "damage" ? 3 : 1;
    for (let i = 0; i < size; i++) {
      const a = g[role][i];
      if (a === undefined) {
        const could = candidates.find((ch) => slotRole(ch.role) === role && inRange(ch.level, r));
        slots.push({ role, open: could === undefined ? "Nobody in range yet" : `${could.name ?? could.guid} could` });
        continue;
      }
      const ch = a.guid === undefined ? undefined : ctx.byGuid.get(a.guid);
      const info = classInfo(ch?.classFile);
      const who: NonNullable<SlotView["who"]> = { character: charName(ctx, a), friend: friendName(ctx, a.battleTag) };
      if (ch?.level !== undefined) who.level = ch.level;
      if (ch?.className !== undefined) who.className = ch.className;
      if (info !== undefined) who.colorToken = info.textToken;
      if (a === lead) who.note = "organiser";
      else if (a.movedUp) who.note = "moved up";
      slots.push({ role, who });
    }
  }

  // The organiser first, then in answer order.
  const answers: AnswerRowView[] = [...run.answers]
    .sort((a, b) => Number(b === lead) - Number(a === lead) || a.answeredAt - b.answeredAt)
    .map((a) => {
      const ch = a.guid === undefined ? undefined : ctx.byGuid.get(a.guid);
      const info = classInfo(ch?.classFile);
      const organiser = a === lead;
      const row: AnswerRowView = {
        character: a.guid === undefined ? "—" : charName(ctx, a),
        friend: friendName(ctx, a.battleTag),
        role: a.answer === "cant" ? "—" : ROLE_LABEL[a.role],
        answer: organiser ? "Organiser" : a.waitlisted ? "Maybe · first in line" : ANSWER_LABEL[a.answer],
        answerTone: organiser ? "organiser" : a.answer,
        where: `${SOURCE_LABEL[a.source]} · ${localTime(a.answeredAt, viewer.timeZone)}`,
      };
      if (ch?.level !== undefined) row.level = ch.level;
      if (info !== undefined) row.colorToken = info.textToken;
      return row;
    });

  const choice = answerChoice(ctx, run);
  const detail: RunDetail = {
    card: c,
    plannedBy: `Planned by ${isViewer(ctx, run.organiser) ? "you" : friendName(ctx, run.organiser)} ${PLANNED_ON[run.source]}`,
    time: [`${c.when} your time`, c.organiserTime, c.phase === "past" || c.phase === "cancelled" ? undefined : c.until]
      .filter((x) => x !== undefined)
      .join(" · "),
    levels: [
      `Levels ${rangeText(r)}`,
      leadChar === undefined
        ? `organiser ${friendName(ctx, run.organiser)}`
        : `organiser ${leadChar.name} (${[leadChar.level, leadChar.className].filter((x) => x !== undefined).join(" ")})`,
    ].join(" · "),
    answer: choice,
    group: [
      `${g.tank.length + g.healer.length + g.damage.length} in`,
      counts(run.answers).maybe > 0 ? `${counts(run.answers).maybe} maybe` : undefined,
      `${open.tank + open.healer + open.damage} open`,
    ]
      .filter((x) => x !== undefined)
      .join(" · "),
    slots,
    answers,
    couldJoin: candidates.slice(0, 6).map((ch) => {
      const info = classInfo(ch.classFile);
      const v: CouldJoinView = {
        character: ch.name ?? ch.guid,
        friend: ch.ownerName ?? "",
        role: slotRole(ch.role),
      };
      if (ch.level !== undefined) v.level = ch.level;
      if (info !== undefined) v.colorToken = info.textToken;
      const off = offText(ch.level, r);
      if (off !== undefined) v.off = off;
      return v;
    }),
    mayEdit: isViewer(ctx, run.organiser) && c.phase !== "past" && c.phase !== "cancelled" && now < run.startsAt,
    mayDelete: (isViewer(ctx, run.organiser) || viewer.isAdmin) && run.cancelledAt === undefined,
    adminDelete: viewer.isAdmin && !isViewer(ctx, run.organiser),
  };
  if (run.note !== undefined) detail.note = run.note;
  const ended = run.cancelledAt === undefined ? pastResult(run).detail : undefined;
  if (ended !== undefined) detail.outcome = ended;
  if (run.cancelledAt !== undefined) {
    detail.cancelled = `Cancelled by ${run.cancelledBy === undefined ? "the organiser" : friendName(ctx, run.cancelledBy)}`;
  }
  const best = choice.characters[0];
  if (best !== undefined && !best.fits) {
    const where = dungeon?.name.split(": ").at(-1) ?? dungeon?.name ?? "this run";
    const dir = best.level !== undefined && best.level < r.min ? "below" : "above";
    detail.outOfRange = `${best.name}${best.level === undefined ? "" : ` (${best.level})`} is ${dir} the ${where} (${rangeText(r)}), so I'm in is off. Maybe or Can't still go.`;
    const other = RUNNABLE_DUNGEONS.find(
      (d) => d.instanceId === dungeon?.instanceId && d.id !== run.dungeonId && inRange(best.level, d.typicalLevels),
    );
    if (other !== undefined) {
      detail.planOther = {
        label: `Plan the ${other.name.split(": ").at(-1)} for ${best.name}`,
        href: `/runs/new?dungeon=${other.id}`,
      };
    }
  }
  return detail;
}

// --- Plan a run -------------------------------------------------------------------------------------------------------

export interface DungeonOption {
  id: string;
  name: string;
  label: string;
  /** "Fits 4 friends' characters · no tank in range yet". */
  fits: string;
  range: LevelRange;
}

export interface LeadOption {
  guid: string;
  label: string;
  fits: boolean;
}

export interface PlanPage {
  dungeons: DungeonOption[];
  dungeonId: string;
  leads: Record<string, LeadOption[]>;
  days: DayOption[];
  timeZone: string;
  /** Friends in another zone, for "Bob and Jorrit see 19:30". */
  otherZones: { name: string; timeZone: string }[];
  organiser: { name: string };
  /** When the page was rendered: the form's time-passed state. */
  now: number;
}

export function planPage(input: RunsInput, dungeonId: string | undefined): PlanPage {
  const ctx = context(input);
  const dungeons = RUNNABLE_DUNGEONS.map((d) => {
    const fit = input.characters.filter((c) => inRange(c.level, d.typicalLevels));
    const owners = new Set(fit.map((c) => c.owner));
    const missing = SLOT_ROLES.filter((role) => role !== "damage" && !fit.some((c) => slotRole(c.role) === role));
    const fits = [
      `Fits ${owners.size} friend${owners.size === 1 ? "" : "s"}' characters`,
      missing.length === 0 ? undefined : `no ${joinNames(missing)} in range yet`,
    ]
      .filter((x) => x !== undefined)
      .join(" · ");
    return { id: d.id, name: d.name, label: `${d.name} · ${rangeText(d.typicalLevels)}`, fits, range: d.typicalLevels };
  });
  const leads: Record<string, LeadOption[]> = {};
  for (const d of dungeons) {
    leads[d.id] = viewerCharacters(ctx, d.range).map((c) => {
      const why = c.fits ? c.role : c.level !== undefined && c.level < d.range.min ? "too low" : "too high";
      return { guid: c.guid, label: `${c.name}${c.level === undefined ? "" : ` ${c.level}`} · ${why}`, fits: c.fits };
    });
  }
  const best = dungeons.find((d) => d.id === dungeonId) ?? dungeons.find((d) => d.id === "sm-armory") ?? dungeons[0]!;
  const tz = input.viewer.timeZone;
  const others = new Map<string, string>();
  for (const p of input.people) {
    const tag = p.battleTag ?? p.key;
    if (!p.hasAddon || isViewer(ctx, tag)) continue;
    const zone = input.timeZoneOf(tag);
    if (zone !== tz) others.set(p.displayName, zone);
  }
  return {
    dungeons,
    dungeonId: best.id,
    leads,
    days: nextDays(input.now, tz),
    timeZone: tz,
    otherZones: [...others].map(([name, timeZone]) => ({ name, timeZone })).sort((a, b) => compareText(a.name, b.name)),
    organiser: { name: friendName(ctx, input.viewer.battleTag) },
    now: input.now,
  };
}
