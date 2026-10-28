import { sameBattleTag } from "../access";
import { RUNNABLE_DUNGEONS, classInfo, rolesFor, type LevelRange } from "../gamedata";
import {
  counts,
  group,
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
  type MoveTo,
  type SlotRole,
} from "../runs";
import { localTime, nextDays, runWhen, untilStart, weekEnd, type DayOption } from "../runTime";
import { byLevel, compareText, type CharacterView, type PersonView } from "./characters";
import { levelFit, type FitKind } from "../levelFit";
import { initials, joinNames } from "./text";

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
export const ANSWER_LABEL: Record<Answer, string> = { in: "I'm in", maybe: "Maybe", cant: "Can't", reserve: "Reserve" };
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
  /** May answer I'm in with it (levelFit: not 6+ below the range, WEB-47). */
  fits: boolean;
  /** How its level fits the range (WEB-47 levelFit). */
  fit: FitKind;
  /** "2 levels short", "3 levels over"; undefined in range. */
  off?: string;
}

/** What the viewer can answer with: their characters, those in range first. */
export interface AnswerChoice {
  runId: number;
  characters: RunCharacterView[];
  /** The viewer's answer so far. */
  current?: { answer: Answer; guid?: string };
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
  /** "1 in · 4 open · no healer in range" (finding 11). */
  summary: string;
  /** The five slots in order (tank, healer, damage × 3): filled or not, with the role's letter. */
  slots: { role: SlotRole; letter: string; filled: boolean }[];
  /** The slot bar's tooltip, a row per role: "Tank · Ves Doombringer", "Damage · Lia Thornwhisper · 2 open". */
  slotRows: string[];
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
  /** "organiser as Ves Doombringer · Tank", "organiser", "in as Lia Thornwhisper · Healer", "not answered". */
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

/** The fit label when the level doesn't simply fit ("+3 over", "4 below"); undefined when it fits (WEB-47). */
function offText(level: number | undefined, r: LevelRange): string | undefined {
  const fit = levelFit(level, r.min, r.max);
  return fit.kind === "fits" ? undefined : fit.label;
}

function characterView(c: CharacterView, r: LevelRange): RunCharacterView {
  const info = classInfo(c.classFile);
  const v: RunCharacterView = {
    guid: c.guid,
    name: c.name ?? c.guid,
    role: slotRole(c.role),
    fits: levelFit(c.level, r.min, r.max).canPick,
    fit: levelFit(c.level, r.min, r.max).kind,
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
    choice.current = { answer: mine.answer };
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
          tag !== undefined &&
          !answered.has(tag.toLowerCase()) &&
          slotRole(c.role) === role &&
          levelFit(c.level, r.min, r.max).suggested
        );
      }),
  );
}

function hint(ctx: Ctx, run: RunRecord, yours: boolean, choice: AnswerChoice): RunCardView["hint"] {
  const mine = run.answers.find((a) => isViewer(ctx, a.battleTag));
  if (mine !== undefined && !yours) {
    const withChar = mine.guid === undefined ? "" : ` with ${charName(ctx, mine)}`;
    if (mine.answer === "reserve") {
      return { text: `You're reserve${withChar}: ${mine.role} is full, you move up when a slot frees`, tone: "muted" };
    }
    return { text: `You answered ${ANSWER_LABEL[mine.answer]}${withChar}`, tone: "muted" };
  }
  // The organiser's open roles nobody can fill are in the summary (finding 11).
  if (yours) return undefined;
  const fitting = choice.characters.filter((c) => c.fit === "fits" || c.fit === "over");
  if (fitting.length === 0) return undefined;
  const open = openSlots(run.answers);
  // The fit label when it doesn't simply fit (WEB-47: one wording everywhere): "fits", "can join · +1 over".
  const how = (c: RunCharacterView) => (c.fit === "fits" ? "fits" : `can join · ${c.off ?? ""}`);
  const forOpen = fitting.find((c) => open[c.role] > 0 && c.role !== "damage");
  if (forOpen !== undefined) {
    const text =
      forOpen.fit === "fits"
        ? `Your ${forOpen.name} fits the open ${forOpen.role} slot`
        : `Your ${forOpen.name} can fill the open ${forOpen.role} slot · ${forOpen.off ?? ""}`;
    return { text, tone: "good" };
  }
  return { text: `Your ${fitting[0]!.name} ${how(fitting[0]!)}`, tone: "good" };
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

/** "1 in · 1 maybe · 4 open · no healer in range"; "5 in · full". */
function summary(ctx: Ctx, run: RunRecord): string {
  const c = counts(run.answers);
  const open = openSlots(run.answers);
  const left = open.tank + open.healer + open.damage;
  const parts = [`${c.in} in`];
  if (c.maybe > 0) parts.push(`${c.maybe} maybe`);
  parts.push(left > 0 ? `${left} open` : "full");
  const nobody = openWithNobody(ctx, run);
  if (nobody.length > 0) parts.push(`no ${nobody.join(" or ")} in range`);
  return parts.join(" · ");
}

const ROLE_LETTER: Record<SlotRole, string> = { tank: "T", healer: "H", damage: "D" };

function slotBars(run: RunRecord): RunCardView["slots"] {
  const g = group(run.answers);
  const out: RunCardView["slots"] = [];
  for (const role of SLOT_ROLES) {
    const size = role === "damage" ? 3 : 1;
    for (let i = 0; i < size; i++) out.push({ role, letter: ROLE_LETTER[role], filled: i < g[role].length });
  }
  return out;
}

function slotRows(ctx: Ctx, run: RunRecord): string[] {
  const g = group(run.answers);
  const open = openSlots(run.answers);
  return SLOT_ROLES.map((role) => {
    const names = g[role].map((a) => charName(ctx, a));
    const left = open[role] > 0 ? `${open[role]} open` : undefined;
    const rest =
      names.length === 0
        ? "open"
        : [names.join(", "), names.length > 0 && role === "damage" ? left : undefined]
            .filter((x) => x !== undefined)
            .join(" · ");
    return `${ROLE_LABEL[role]} · ${rest}`;
  });
}

/** "organiser as Ves Doombringer · Tank", "in as Lia Thornwhisper · Healer", "reserve as …", "can't". */
function yourStatus(ctx: Ctx, run: RunRecord): string {
  const mine = run.answers.find((a) => isViewer(ctx, a.battleTag));
  const organiser = isViewer(ctx, run.organiser);
  if (mine === undefined) return organiser ? "organiser" : "not answered";
  if (mine.answer === "cant") return organiser ? "organiser" : "can't";
  const as = mine.guid === undefined ? "" : ` as ${charName(ctx, mine)} · ${ROLE_LABEL[mine.role]}`;
  if (organiser)
    return mine.answer === "in"
      ? `organiser${as}`
      : `organiser · ${mine.answer === "reserve" ? "on the bench" : "maybe"}${as}`;
  return `${mine.answer === "in" ? "in" : mine.answer}${as}`;
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
  // "Runs I can join": a character that fits or is over (WEB-47).
  return viewerCharacters(ctx, rangeOf(run)).some((c) => c.fit === "fits" || c.fit === "over");
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
    summary: summary(ctx, run),
    slots: slotBars(run),
    slotRows: slotRows(ctx, run),
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
      .map((r) => ({
        href: `/runs/${r.id}`,
        dungeon: runDungeon(r.dungeonId)?.name ?? r.dungeonId,
        status: yourStatus(ctx, r),
      })),
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
    classFile?: string;
    colorToken?: string;
    friend: string;
    /** "organiser", "from talents", "set by player", "moved up". */
    note?: string;
    /** WEB-49: the disc's letters and the fit tag. */
    initials: string;
    fit?: { kind: FitKind; label: string };
    guid?: string;
    /** The viewer's own sign-up. */
    yours: boolean;
  };
  /** For an open slot, one fact (WEB-49, finding 1): "1 left", "No healer in range · Kaz Coldbrew is 4 below". */
  open?: string;
  /** The organiser's (or admin's) ⋯ menu for this sign-up (WEB-49). */
  menu?: MoveOption[];
}

/** One entry of a slot's ⋯ menu (WEB-49). */
export interface MoveOption {
  label: string;
  to: MoveTo;
  /** The character that trades places (a taken role). */
  swapWith?: string;
  /** "open", "current", "Healer"; or why it can't ("not for mages"). */
  detail?: string;
  disabled?: boolean;
  danger?: boolean;
}

/** The answer picker (WEB-49, board `runs-v2-picker`): every character, the roles, the answer. */
export interface PickerView {
  runId: number;
  /** "Join Scarlet Monastery: Graveyard". */
  title: string;
  /** "Fri 30 Oct 20:30 · levels 26–36". */
  sub: string;
  characters: PickerCharacter[];
  /** Per role: "open", "3 open", "full → reserve" (counting without the viewer's own answer). */
  roles: Record<SlotRole, { state: string; full: boolean }>;
  current?: { guid?: string; role: SlotRole; answer: Answer };
}

export interface PickerCharacter {
  guid: string;
  name: string;
  initials: string;
  level?: number;
  classFile?: string;
  colorToken?: string;
  /** "22 Priest · Holy". */
  line: string;
  fit: { kind: FitKind; label: string };
  /** The roles its class can play, and the one the addon reports. */
  roles: SlotRole[];
  defaultRole: SlotRole;
  /** "not for priests": why the other roles are off. */
  notFor: string;
  /** 6+ below: only Maybe (levelFit). */
  onlyMaybe: boolean;
  /** "4 levels below: tough, but the group can carry you." */
  note?: string;
}

/** The viewer's answer, collapsed (WEB-49): "You're in as Kaz Coldbrew · Healer". */
export interface AnswerSummary {
  lead: string;
  character?: string;
  role?: string;
  detail?: string;
}

/** The organiser's bar (WEB-49): "You lead as Vesgar Bloodhoof · Tank". */
export interface LeadBar {
  state: "playing" | "benched" | "out";
  character?: string;
  role?: string;
  /** "27 Warrior · Protection talents". */
  line?: string;
  initials?: string;
  classFile?: string;
  colorToken?: string;
}

export interface AnswerRowView {
  character: string;
  level?: number;
  colorToken?: string;
  friend: string;
  role: string;
  /** "(usually tank)" when the role differs from the character's own (WEB-49). */
  usualRole?: string;
  /** The fit label ("fits", "carry · +21"); undefined without a character. */
  fit?: string;
  answer: string;
  answerTone: "in" | "maybe" | "cant" | "reserve" | "organiser";
  /** "Wed 09:12 · Discord" in the viewer's zone (WEB-49: with the day). */
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
  /** WEB-49: the big time, the countdown, the picker, your answer, the organiser's bar, Could fill, Maybe, Reserve. */
  when: string;
  countdown?: string;
  picker: PickerView;
  summary?: AnswerSummary;
  /** "Answered Tue 21:40". */
  answeredAt?: string;
  leadBar?: LeadBar;
  couldFill: string[];
  maybes: string[];
  reserves: string[];
  /** The organiser or the admin: the slots have a ⋯ menu. */
  mayMove: boolean;
  isOrganiser: boolean;
  mayEdit: boolean;
  mayDelete: boolean;
  /** The admin deleting someone else's run. */
  adminDelete: boolean;
  /** "Cancelled by Nico". */
  cancelled?: string;
  /** How it ended (WEB-43): "3 of 5 signed-up came", "no upload showed it". */
  outcome?: string;
}

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
    // "Could fill" (WEB-47): characters that fit or are over, for an open role.
    .filter((ch) => levelFit(ch.level, r.min, r.max).suggested)
    .filter((ch) => open[slotRole(ch.role)] > 0)
    .sort(
      (a, b) =>
        Number(levelFit(b.level, r.min, r.max).kind === "fits") -
          Number(levelFit(a.level, r.min, r.max).kind === "fits") || byLevel(a, b),
    );

  const closed = run.cancelledAt !== undefined || now >= run.startsAt;
  const isOrganiser = isViewer(ctx, run.organiser);
  const mayMove = isOrganiser || viewer.isAdmin;
  const slots: SlotView[] = [];
  for (const role of SLOT_ROLES) {
    const size = role === "damage" ? 3 : 1;
    for (let i = 0; i < size; i++) {
      const a = g[role][i];
      if (a === undefined) {
        slots.push({ role, open: openFact(ctx, run, role, open[role]) });
        continue;
      }
      const ch = a.guid === undefined ? undefined : ctx.byGuid.get(a.guid);
      const info = classInfo(ch?.classFile);
      const who: NonNullable<SlotView["who"]> = {
        character: charName(ctx, a),
        friend: friendName(ctx, a.battleTag),
        initials: initials(charName(ctx, a)),
        yours: isViewer(ctx, a.battleTag),
      };
      if (ch?.level !== undefined) who.level = ch.level;
      if (ch?.className !== undefined) who.className = ch.className;
      if (ch?.classFile !== undefined) who.classFile = ch.classFile;
      if (info !== undefined) who.colorToken = info.textToken;
      if (a.guid !== undefined) who.guid = a.guid;
      if (ch !== undefined) {
        const fit = levelFit(ch.level, r.min, r.max);
        who.fit = { kind: fit.kind, label: fit.label };
      }
      if (a === lead) who.note = "organiser";
      else if (a.movedUp) who.note = "moved up";
      const slot: SlotView = { role, who };
      if (mayMove && a.guid !== undefined && !closed) slot.menu = moveMenu(ctx, run, a);
      slots.push(slot);
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
        answer: organiser ? "Organiser" : ANSWER_LABEL[a.answer],
        answerTone: organiser ? "organiser" : a.answer,
        where: `${dayTime(a.answeredAt, viewer.timeZone)} · ${SOURCE_LABEL[a.source]}`,
      };
      if (ch?.level !== undefined) row.level = ch.level;
      if (info !== undefined) row.colorToken = info.textToken;
      if (ch !== undefined) {
        row.fit = levelFit(ch.level, r.min, r.max).label;
        const usual = slotRole(ch.role);
        if (a.answer !== "cant" && ch.role !== undefined && usual !== a.role) row.usualRole = `(usually ${usual})`;
      }
      return row;
    });

  const choice = answerChoice(ctx, run);
  const mine = run.answers.find((a) => isViewer(ctx, a.battleTag));
  const nameOf = (a: RunAnswer) => (a.guid === undefined ? undefined : charName(ctx, a));
  const listed = (kind: Answer) =>
    run.answers
      .filter((a) => a.answer === kind)
      .sort((x, y) => x.answeredAt - y.answeredAt)
      .map((a) => {
        const ch = a.guid === undefined ? undefined : ctx.byGuid.get(a.guid);
        return [nameOf(a) ?? friendName(ctx, a.battleTag), ch?.level, "·", a.role]
          .filter((x) => x !== undefined)
          .join(" ");
      });
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
      const fit = levelFit(ch.level, r.min, r.max);
      const off = fit.kind === "fits" ? undefined : fit.label;
      if (off !== undefined) v.off = off;
      return v;
    }),
    when: runWhen(run.startsAt, viewer.timeZone, now),
    picker: picker(ctx, run),
    couldFill: candidates
      .slice(0, 3)
      .map((ch) => [ch.name ?? ch.guid, ch.level].filter((x) => x !== undefined).join(" ")),
    maybes: listed("maybe"),
    reserves: listed("reserve"),
    mayMove: mayMove && !closed,
    isOrganiser,
    mayEdit: isViewer(ctx, run.organiser) && c.phase !== "past" && c.phase !== "cancelled" && now < run.startsAt,
    mayDelete: (isViewer(ctx, run.organiser) || viewer.isAdmin) && run.cancelledAt === undefined,
    adminDelete: viewer.isAdmin && !isViewer(ctx, run.organiser),
  };
  if (run.note !== undefined) detail.note = run.note;
  if (c.phase !== "past" && c.phase !== "cancelled") detail.countdown = untilStart(run.startsAt, now);
  if (mine !== undefined) detail.answeredAt = `Answered ${dayTime(mine.answeredAt, viewer.timeZone)}`;
  if (isOrganiser) {
    const ch = mine?.guid === undefined ? undefined : ctx.byGuid.get(mine.guid);
    const bar: LeadBar = {
      state: mine?.answer === "in" ? "playing" : mine === undefined || mine.answer === "cant" ? "out" : "benched",
    };
    if (mine !== undefined && mine.answer !== "cant" && ch !== undefined) {
      bar.character = charName(ctx, mine);
      bar.role = ROLE_LABEL[mine.role];
      bar.initials = initials(bar.character);
      if (ch.classFile !== undefined) bar.classFile = ch.classFile;
      const info = classInfo(ch.classFile);
      if (info !== undefined) bar.colorToken = info.textToken;
      const talents = ch.mainTreeName === undefined ? undefined : `${ch.mainTreeName} talents`;
      bar.line = [[ch.level, ch.className].filter((x) => x !== undefined).join(" "), talents]
        .filter((x) => x !== undefined && x !== "")
        .join(" · ");
    }
    detail.leadBar = bar;
  } else if (mine !== undefined) {
    const character = nameOf(mine);
    const role = ROLE_LABEL[mine.role];
    const summary: AnswerSummary =
      mine.answer === "in"
        ? { lead: "You're in as", role }
        : mine.answer === "reserve"
          ? { lead: `${role} is full · you're reserve as`, detail: "You move up when someone drops out." }
          : mine.answer === "maybe"
            ? { lead: "Maybe as", role }
            : { lead: "You can't make it" };
    if (character !== undefined && mine.answer !== "cant") summary.character = character;
    detail.summary = summary;
  }
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
      (d) =>
        d.instanceId === dungeon?.instanceId &&
        d.id !== run.dungeonId &&
        levelFit(best.level, d.typicalLevels.min, d.typicalLevels.max).kind === "fits",
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

// --- WEB-49: the picker, the organiser's moves, the run page v2 -------------------------------------------------

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Wed 09:12" in a zone. */
function dayTime(at: number, timeZone: string): string {
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" }).format(new Date(at * 1000));
  return `${WEEKDAY_SHORT.find((d) => weekday.startsWith(d)) ?? weekday} ${localTime(at, timeZone)}`;
}

/** "priests", "mages". */
function classPlural(className: string | undefined): string {
  return className === undefined ? "this class" : `${className.toLowerCase()}s`;
}

function fitNote(kind: FitKind, label: string): string | undefined {
  const n = label.match(/\d+/)?.[0];
  switch (kind) {
    case "low":
      return `${n} levels below: tough, but the group can carry you.`;
    case "tooLow":
      return `${n} levels below: you can only answer Maybe.`;
    case "carry":
      return `${n} levels over. The others get less XP from kills, but runs go fast.`;
    default:
      return undefined;
  }
}

function pickerCharacter(c: CharacterView, r: LevelRange): PickerCharacter {
  const fit = levelFit(c.level, r.min, r.max);
  const info = classInfo(c.classFile);
  const roles = [...rolesFor(c.classFile)] as SlotRole[];
  const own = slotRole(c.role);
  const v: PickerCharacter = {
    guid: c.guid,
    name: c.name ?? c.guid,
    initials: initials(c.name),
    line: [[c.level, c.className].filter((x) => x !== undefined).join(" "), c.mainTreeName]
      .filter((x) => x !== undefined && x !== "")
      .join(" · "),
    fit: { kind: fit.kind, label: fit.label },
    roles,
    defaultRole: roles.includes(own) ? own : roles[0]!,
    notFor: `not for ${classPlural(c.className)}`,
    onlyMaybe: !fit.canPick,
  };
  if (c.level !== undefined) v.level = c.level;
  if (c.classFile !== undefined) v.classFile = c.classFile;
  if (info !== undefined) v.colorToken = info.textToken;
  const note = fitNote(fit.kind, fit.label);
  if (note !== undefined) v.note = note;
  return v;
}

/** The picker for the viewer: all their characters, the roles' states without their own answer. */
function picker(ctx: Ctx, run: RunRecord): PickerView {
  const r = rangeOf(run);
  const dungeon = runDungeon(run.dungeonId);
  const mine = run.answers.find((a) => isViewer(ctx, a.battleTag));
  const open = openSlots(run.answers.filter((a) => a !== mine));
  const roles = {} as PickerView["roles"];
  for (const role of SLOT_ROLES) {
    const n = open[role];
    roles[role] = { state: n <= 0 ? "full → reserve" : role === "damage" ? `${n} open` : "open", full: n <= 0 };
  }
  const view: PickerView = {
    runId: run.id,
    title: `Join ${dungeon?.name ?? "the run"}`,
    sub: `${runWhen(run.startsAt, ctx.input.viewer.timeZone, ctx.input.now)} · levels ${rangeText(r)}`,
    characters: ctx.input.characters
      .filter((c) => {
        const tag = ownerTag(ctx, c);
        return tag !== undefined && isViewer(ctx, tag);
      })
      .sort(byLevel)
      .map((c) => pickerCharacter(c, r)),
    roles,
  };
  if (mine !== undefined) {
    view.current = { role: mine.role, answer: mine.answer };
    if (mine.guid !== undefined) view.current.guid = mine.guid;
  }
  return view;
}

/** The ⋯ menu for a sign-up in a slot: other roles (open, or a swap), reserve, off the run (WEB-49). */
function moveMenu(ctx: Ctx, run: RunRecord, a: RunAnswer): MoveOption[] {
  const ch = a.guid === undefined ? undefined : ctx.byGuid.get(a.guid);
  const own = isViewer(ctx, a.battleTag);
  const can = rolesFor(ch?.classFile);
  const open = openSlots(run.answers);
  const g = group(run.answers);
  const menu: MoveOption[] = SLOT_ROLES.map((role): MoveOption => {
    const label = ROLE_LABEL[role];
    if (role === a.role) return { label, to: role, detail: "current", disabled: true };
    if (!can.includes(role))
      return { label, to: role, detail: `not for ${classPlural(ch?.className)}`, disabled: true };
    if (open[role] > 0) return { label: `Move to ${label}`, to: role, detail: "open" };
    // Full: trade places with someone there whose class can play this sign-up's role.
    const partner = g[role].find((p) => {
      const pc = p.guid === undefined ? undefined : ctx.byGuid.get(p.guid);
      return p.guid !== undefined && rolesFor(pc?.classFile).includes(a.role);
    });
    if (partner === undefined) return { label, to: role, detail: "taken", disabled: true };
    return { label: `Swap with ${charName(ctx, partner)}`, to: role, swapWith: partner.guid!, detail: label };
  });
  menu.push({ label: own ? "Bench yourself" : "Move to reserve", to: "reserve" });
  menu.push({ label: own ? "Leave the group" : "Remove from run", to: "remove", danger: true });
  return menu;
}

/** One fact for an open slot (finding 1): how many are left, or that nobody is in range and who is closest. */
function openFact(ctx: Ctx, run: RunRecord, role: SlotRole, left: number): string {
  const r = rangeOf(run);
  const answered = new Set(run.answers.map((a) => a.battleTag.toLowerCase()));
  const free = ctx.input.characters.filter((c) => {
    const tag = ownerTag(ctx, c);
    return tag !== undefined && !answered.has(tag.toLowerCase()) && rolesFor(c.classFile).includes(role);
  });
  if (free.some((c) => levelFit(c.level, r.min, r.max).suggested)) return `${left} left`;
  const below = free
    .filter((c) => c.level !== undefined && c.level < r.min)
    .sort((x, y) => (y.level ?? 0) - (x.level ?? 0))[0];
  const nobody = `No ${role} in range`;
  return below === undefined
    ? nobody
    : `${nobody} · ${below.name ?? below.guid} is ${levelFit(below.level, r.min, r.max).label}`;
}

// --- Plan a run -------------------------------------------------------------------------------------------------------

export interface DungeonOption {
  id: string;
  name: string;
  label: string;
  /** "Fits 4 friends' characters · no tank in range yet". */
  fits: string;
  range: LevelRange;
  /** One of Forever's new dungeons ("Forever" next to the range). */
  forever: boolean;
  /** The instance when this is one of its wings ("Scarlet Monastery"): searching shows the other wings. */
  wingOf?: string;
  /** A character of the viewer fits or is over: the "Fits your characters" group. */
  fitsYou: boolean;
  /** The viewer's best character for it: "Vesgar 27 fits", "Twinkle 5 below", "no fit". */
  best?: { text: string; tone?: "good" | "warn" };
}

export interface PlanPage {
  /** "Fits your characters" first, then "All dungeons by level" (WEB-49). */
  dungeons: DungeonOption[];
  /** Filled in from a dungeon page or a roster band, or when exactly one dungeon fits a character of the viewer. */
  dungeonId?: string;
  /** Lead as through the picker (WEB-49): the viewer's characters per dungeon, with fit, roles and notes. */
  leadPicker: Record<string, PickerCharacter[]>;
  days: DayOption[];
  timeZone: string;
  /** Friends in another zone, for "Bob and Jorrit see 19:30". */
  otherZones: { name: string; timeZone: string }[];
  organiser: { name: string };
  /** When the page was rendered: the form's time-passed state. */
  now: number;
}

/** Which of the viewer's characters is the best for a range: fits (highest), over, low, carry, then too low. */
const FIT_RANK: Record<FitKind, number> = { fits: 0, over: 1, low: 2, carry: 3, tooLow: 4 };

function bestFit(mine: readonly CharacterView[], r: LevelRange): DungeonOption["best"] {
  const away = (level: number | undefined) =>
    level === undefined ? Infinity : level > r.max ? level - r.max : level < r.min ? r.min - level : -level;
  const best = mine
    .map((c) => ({ c, fit: levelFit(c.level, r.min, r.max) }))
    .sort((a, b) => FIT_RANK[a.fit.kind] - FIT_RANK[b.fit.kind] || away(a.c.level) - away(b.c.level))[0];
  if (best === undefined) return undefined;
  const { c, fit } = best;
  const name = (c.name ?? c.guid).split(" ")[0]!;
  switch (fit.kind) {
    case "fits":
    case "over":
      return { text: `${name} ${c.level ?? ""} ${fit.label}`, tone: "good" };
    case "low":
    case "carry":
      return { text: `${name} ${fit.label}`, tone: "warn" };
    default:
      return { text: "no fit" };
  }
}

export function planPage(input: RunsInput, dungeonId: string | undefined): PlanPage {
  const ctx = context(input);
  const mine = input.characters
    .filter((c) => {
      const tag = ownerTag(ctx, c);
      return tag !== undefined && isViewer(ctx, tag);
    })
    .sort(byLevel);
  const all = RUNNABLE_DUNGEONS.map((d): DungeonOption => {
    const fit = input.characters.filter(
      (c) => levelFit(c.level, d.typicalLevels.min, d.typicalLevels.max).kind === "fits",
    );
    const owners = new Set(fit.map((c) => c.owner));
    const missing = SLOT_ROLES.filter((role) => role !== "damage" && !fit.some((c) => slotRole(c.role) === role));
    const fits = [
      `Fits ${owners.size} friend${owners.size === 1 ? "" : "s"}' characters`,
      missing.length === 0 ? undefined : `no ${joinNames(missing)} in range yet`,
    ]
      .filter((x) => x !== undefined)
      .join(" · ");
    const r = d.typicalLevels;
    const o: DungeonOption = {
      id: d.id,
      name: d.name,
      label: `${d.name} · ${rangeText(r)}`,
      fits,
      range: r,
      forever: d.forever,
      fitsYou: mine.some((c) => levelFit(c.level, r.min, r.max).suggested),
    };
    if (d.wingOf !== undefined) o.wingOf = d.wingOf;
    const best = bestFit(mine, r);
    if (best !== undefined) o.best = best;
    return o;
  });
  const byRange = (a: DungeonOption, b: DungeonOption) =>
    a.range.min - b.range.min || a.range.max - b.range.max || compareText(a.name, b.name);
  const dungeons = [...all.filter((d) => d.fitsYou).sort(byRange), ...all.filter((d) => !d.fitsYou).sort(byRange)];
  const leadPicker: Record<string, PickerCharacter[]> = {};
  for (const d of dungeons) leadPicker[d.id] = mine.map((c) => pickerCharacter(c, d.range));
  // Finding 6: no guessed dungeon; when exactly one dungeon fits a character of the viewer, that one.
  const fitting = dungeons.filter((d) => mine.some((c) => levelFit(c.level, d.range.min, d.range.max).kind === "fits"));
  const chosen = dungeons.find((d) => d.id === dungeonId) ?? (fitting.length === 1 ? fitting[0] : undefined);
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
    ...(chosen === undefined ? {} : { dungeonId: chosen.id }),
    leadPicker,
    days: nextDays(input.now, tz),
    timeZone: tz,
    otherZones: [...others].map(([name, timeZone]) => ({ name, timeZone })).sort((a, b) => compareText(a.name, b.name)),
    organiser: { name: friendName(ctx, input.viewer.battleTag) },
    now: input.now,
  };
}

// --- runs on the roster (WEB-45, board `roster-cards-runs`) ----------------------------------------------------------

export interface NextRunView {
  href: string;
  dungeon: string;
  /** "Today 20:30" in the viewer's zone. */
  when: string;
  /** "Nico on Ves Doombringer · 3 in · 1 maybe · tank open". */
  line: string;
}

export interface BandRunView {
  href: string;
  /** "Fri 20:30 · 3 in". */
  label: string;
}

export interface RosterRuns {
  /** The next upcoming run, whoever can join it (Nico, 2026-10-28); none when nothing is planned. */
  next?: NextRunView;
  /** Per dungeon id: its upcoming runs for the band popover, at most 3, and how many more. */
  byDungeon: Record<string, { runs: BandRunView[]; more: number }>;
}

/** The runs per dungeon a band popover lists (Nico, 2026-10-28: up to three, each a link). */
export const BAND_RUNS = 3;

export function rosterRuns(input: RunsInput): RosterRuns {
  const ctx = context(input);
  const upcoming = input.runs
    .filter((r) => isUpcoming(r, input.now))
    .sort((a, b) => a.startsAt - b.startsAt || a.id - b.id);
  const out: RosterRuns = { byDungeon: {} };
  const first = upcoming[0];
  if (first !== undefined) {
    const c = card(ctx, first);
    const lead = first.answers.find((a) => sameBattleTag(a.battleTag, first.organiser) && a.answer === "in");
    const who = isViewer(ctx, first.organiser)
      ? lead === undefined
        ? "You organise"
        : `You lead as ${charName(ctx, lead)}`
      : lead === undefined
        ? `${friendName(ctx, first.organiser)} organises`
        : `${friendName(ctx, first.organiser)} on ${charName(ctx, lead)}`;
    const open = openSlots(first.answers);
    const gaps = SLOT_ROLES.filter((r) => open[r] > 0).map((r) =>
      r === "damage" && open[r] > 1 ? `${open[r]} damage open` : `${r} open`,
    );
    out.next = {
      href: c.href,
      dungeon: c.dungeon,
      when: c.when,
      line: [who, c.tally, ...gaps].join(" · "),
    };
  }
  for (const run of upcoming) {
    const entry = (out.byDungeon[run.dungeonId] ??= { runs: [], more: 0 });
    if (entry.runs.length >= BAND_RUNS) {
      entry.more++;
      continue;
    }
    const c = card(ctx, run);
    entry.runs.push({ href: c.href, label: `${c.when} · ${counts(run.answers).in} in` });
  }
  return out;
}
