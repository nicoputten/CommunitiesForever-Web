import type {
  DoomsdaySnapshot,
  FriendDoomsday,
  FriendGoal,
  GoalRef,
  GoalSlot,
  Points,
  Track,
} from "../doomsday/snapshot";
import { localTime } from "../runTime";
import { compareText } from "./characters";
import { initials, joinNames } from "./text";

// The Doomsday page (E8; the addon repo's docs/DOOMSDAY.md): the header, Today, Week, the Board and the 12-week
// heatmap (WEB-59, boards `doomsday-today`, `doomsday-phone` and `doomsday-rules`). Times in the viewer's own zone
// (Nico, 2026-10-28), the day's name by the realm's calendar. Names only, never BattleTags.

export const DOOMSDAY_TABS = [
  { tab: "today", label: "Today", href: "/doomsday" },
  { tab: "week", label: "Week", href: "/doomsday/week" },
  { tab: "board", label: "Board", href: "/doomsday/board" },
] as const;

export type DoomsdayTab = (typeof DOOMSDAY_TABS)[number]["tab"];

export const SUGGESTIONS = "Goals are suggestions with points. Skip any of them; nothing is locked.";

export interface DoomsdayInput {
  snapshot: DoomsdaySnapshot;
  /** The viewer's friend key (PersonView.key); undefined for a viewer the data doesn't know. */
  viewerKey?: string;
  /** The viewer's own time zone. */
  timeZone: string;
}

/** Points of both tracks, never added together; `approx` when a PvP number rests on guessed victims ("≈"). */
export interface PointsView {
  pve: number;
  pvp: number;
  approx: boolean;
}

export interface StreakView {
  current: number;
  best: number;
}

export interface DoomsdayHeader {
  /** "Daily goals at 19:00, feats for bragging, and a ladder per track. Suggestions, never rules." */
  sub: string;
  /** The viewer's own numbers; undefined without Doomsday data. */
  today?: PointsView;
  week?: PointsView;
  streak?: StreakView;
}

export interface GoalCardView {
  key: string;
  track: Track;
  /** "PvE daily", "PvP · the Hunt", "PvP · Skirmish", "PvE weekly", "PvP bounty". */
  kind: string;
  title: string;
  done: boolean;
  /** "done at 10:42", "done at Mon 22:10". */
  doneText?: string;
  /** "3 / 5" with its share (0..100); only when the site can tell. */
  progress?: { text: string; percent: number; approx: boolean };
  /** "+5 PvE". */
  worth: string;
  /** Tooltip of the swap mark: "Instead of: Raise Cooking, First Aid or Fishing". */
  swap?: string;
}

export interface DuelSlotView {
  /** First duels so far today (won or lost). */
  count: number;
  /** "Won vs Bob · Mira and Tok still open today". */
  text: string;
}

export interface TodayView {
  /** "Your goals · Tue 28 Oct". */
  title: string;
  /** "3 of 5 done". */
  doneText: string;
  /** "resets in 11 h 30 m". */
  resets: string;
  pve: GoalCardView[];
  pvp: GoalCardView[];
  duels: DuelSlotView;
}

export interface SoFarView {
  crown?: { name: string; time: string };
  /** Finished all PvE dailies after the crown. */
  finished: { name: string; initials: string; time: string }[];
  /** "Bob: Hunt + Skirmish done". */
  partial: { name: string; initials: string; text: string }[];
  /** "Jorrit hasn't started · Sanne has no addon". */
  rest?: string;
  /** Nobody has done anything yet today. */
  empty: boolean;
}

export interface BoardColumn {
  id: string;
  track: Track;
  title: string;
}

export type BoardCell =
  | { kind: "done"; time: string; swap?: string }
  | { kind: "progress"; text: string; swap?: string }
  | { kind: "open"; swap?: string };

export interface BoardRow {
  key: string;
  name: string;
  initials: string;
  you: boolean;
  /** All 3 PvE dailies done: the name is struck through. */
  crossedOut: boolean;
  /** The crown's time ("19:30"). */
  crown?: string;
  pvpVirgin: boolean;
  /** One per column; undefined for a friend without Doomsday data. */
  cells?: BoardCell[];
  /** "1 won · vs Bob", "—". */
  duels?: string;
  today?: PointsView;
  week?: PointsView;
  streak?: StreakView;
  /** For a friend without Doomsday data: "No addon yet · goals start counting once Sanne installs CommunitiesForever". */
  note?: string;
  /** Without data the row is dimmed. */
  dim: boolean;
}

export interface BoardView {
  columns: BoardColumn[];
  rows: BoardRow[];
  /** Only the viewer (or one friend) has data: "Only you have data so far. …". */
  lonely?: string;
}

export interface WeekView {
  /** "resets Sunday 19:00 · in 4 d 11 h". */
  resets: string;
  points?: PointsView;
  goals: GoalCardView[];
}

export interface HeatmapRow {
  key: string;
  name: string;
  best: number;
  /** 84 days, oldest first: a shade 0..5 and the label for its tooltip. */
  days: { level: HeatLevel; label: string }[];
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface HeatmapView {
  rows: HeatmapRow[];
  /** "Sanne: no addon yet." */
  without?: string;
}

export interface DoomsdayPage {
  header: DoomsdayHeader;
  /** The viewer's own day; undefined without Doomsday data. */
  today?: TodayView;
  week?: WeekView;
  soFar: SoFarView;
  board: BoardView;
  heatmap: HeatmapView;
  /** Nobody has done a goal yet this day (the first day state, WEB-61). */
  firstDay: boolean;
}

const KIND: Record<GoalSlot, string> = {
  pveDaily: "PvE daily",
  hunt: "PvP · the Hunt",
  skirmish: "PvP · Skirmish",
  pveWeekly: "PvE weekly",
  bounty: "PvP bounty",
};

const TRACK: Record<Track, string> = { pve: "PvE", pvp: "PvP" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue 28 Oct" in the zone. */
function dayName(at: number, timeZone: string): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "numeric" })
    .formatToParts(new Date(at * 1000))
    .reduce<Record<string, string>>((acc, x) => ({ ...acc, [x.type]: x.value }), {});
  const weekday = WEEKDAYS.indexOf(p.weekday ?? "");
  return `${WEEKDAYS[weekday] ?? p.weekday} ${p.day} ${MONTHS[Number(p.month) - 1]}`;
}

/** "Sunday" in the zone. */
function weekdayLong(at: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long" }).format(new Date(at * 1000));
}

/** "11 h 30 m", "4 d 11 h", "25 m". */
export function countdown(at: number, now: number): string {
  const s = Math.max(0, at - now);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} m`;
  return `${Math.max(1, m)} m`;
}

function pointsView(p: Points | undefined, approx: boolean): PointsView | undefined {
  return p === undefined ? undefined : { pve: p.pve, pvp: p.pvp, approx };
}

/** "done at 10:42", or with the day for a weekly done on another day ("done at Mon 22:10"). */
function doneText(at: number, timeZone: string, withDay: boolean): string {
  const time = localTime(at, timeZone);
  return withDay ? `done at ${WEEKDAYS[weekdayIndex(at, timeZone)]} ${time}` : `done at ${time}`;
}

function weekdayIndex(at: number, timeZone: string): number {
  return WEEKDAYS.indexOf(new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" }).format(new Date(at * 1000)));
}

function swapText(g: FriendGoal): string | undefined {
  return g.swappedFrom === undefined ? undefined : `Instead of: ${g.swappedFrom.title}`;
}

function goalCard(g: FriendGoal, timeZone: string, withDay: boolean): GoalCardView {
  const card: GoalCardView = {
    key: g.columnId,
    track: g.goal.track,
    kind: KIND[g.goal.slot],
    title: g.goal.title,
    done: g.doneAt !== undefined,
    worth: `+${g.points} ${TRACK[g.goal.track]}`,
  };
  if (g.doneAt !== undefined) card.doneText = doneText(g.doneAt, timeZone, withDay);
  else if (g.progress !== undefined && g.progress.target > 0) {
    const value = Math.min(g.progress.value, g.progress.target);
    card.progress = {
      text: `${g.progress.approx === true ? "≈" : ""}${value} / ${g.progress.target}`,
      percent: Math.round((value / g.progress.target) * 100),
      approx: g.progress.approx === true,
    };
  }
  const swap = swapText(g);
  if (swap !== undefined) card.swap = swap;
  return card;
}

function isPve(g: FriendGoal): boolean {
  return g.goal.slot === "pveDaily";
}

/** The board's columns: the 3 PvE dailies, the Hunt (Alliance: the group plays Horde, Nico 2026-10-28), the Skirmish. */
function boardColumns(s: DoomsdaySnapshot): BoardColumn[] {
  const column = (g: GoalRef, id = g.id): BoardColumn => ({ id, track: g.track, title: g.title });
  const pve = s.todayGoals.filter((g) => g.slot === "pveDaily").map((g) => column(g));
  const rest = s.todayGoals.filter((g) => g.slot !== "pveDaily").map((g) => column(g));
  const hunt =
    s.hunts.alliance !== undefined
      ? column(s.hunts.alliance, "hunt:alliance")
      : s.hunts.horde !== undefined
        ? column(s.hunts.horde, "hunt:horde")
        : undefined;
  return [...pve, ...(hunt === undefined ? [] : [hunt]), ...rest];
}

/** The friend's goal for a column: the one filling it, or for the Hunt column the friend's own Hunt. */
function goalFor(f: FriendDoomsday, column: BoardColumn): FriendGoal | undefined {
  const goals = f.today?.goals ?? [];
  const exact = goals.find((g) => g.columnId === column.id);
  if (exact !== undefined) return exact;
  if (goals.every((g) => g.goal.slot !== "hunt")) return undefined;
  const hunts = goals.filter((g) => g.goal.slot === "hunt");
  const columnIsHunt = hunts.length > 0 && column.id.startsWith("hunt");
  // Either Hunt counts: a friend with both factions shows the one done, else the first.
  return columnIsHunt ? (hunts.find((g) => g.doneAt !== undefined) ?? hunts[0]) : undefined;
}

function boardCell(g: FriendGoal | undefined, timeZone: string): BoardCell {
  if (g === undefined) return { kind: "open" };
  const swap = swapText(g);
  const cell: BoardCell =
    g.doneAt !== undefined
      ? { kind: "done", time: localTime(g.doneAt, timeZone) }
      : g.progress !== undefined && g.progress.target > 0
        ? {
            kind: "progress",
            text: `${g.progress.approx === true ? "≈" : ""}${Math.min(g.progress.value, g.progress.target)}/${g.progress.target}`,
          }
        : { kind: "open" };
  if (swap !== undefined) cell.swap = swap;
  return cell;
}

function duelsCell(f: FriendDoomsday): string {
  const first = (f.today?.duels.first ?? []).filter((d) => d.result !== "disputed");
  if (first.length === 0) return "—";
  const won = first.filter((d) => d.result === "won").length;
  const lost = first.length - won;
  const parts = [won > 0 ? `${won} won` : "", lost > 0 ? `${lost} lost` : ""].filter((p) => p !== "");
  return `${parts.join(", ")} · vs ${joinNames(first.map((d) => d.name))}`;
}

function duelSlot(f: FriendDoomsday): DuelSlotView {
  const first = f.today?.duels.first ?? [];
  const counted = first.filter((d) => d.result !== "disputed");
  const won = counted.filter((d) => d.result === "won").map((d) => d.name);
  const lost = counted.filter((d) => d.result === "lost").map((d) => d.name);
  const open = (f.today?.duels.open ?? []).map((d) => d.name);
  const parts: string[] = [];
  if (won.length > 0) parts.push(`Won vs ${joinNames(won)}`);
  if (lost.length > 0) parts.push(`Lost vs ${joinNames(lost)}`);
  if (open.length > 0) parts.push(`${joinNames(open)} still open today`);
  return { count: counted.length, text: parts.length > 0 ? parts.join(" · ") : "Nobody to duel yet today" };
}

function doneCount(f: FriendDoomsday): number {
  return (f.today?.goals ?? []).filter((g) => g.doneAt !== undefined).length;
}

/** "No addon yet · …", "No Doomsday data yet · …". */
function withoutNote(f: FriendDoomsday): string {
  switch (f.status) {
    case "noAddon":
      return `No addon yet · goals start counting once ${f.name} installs CommunitiesForever`;
    default:
      return "No Doomsday data yet · it starts with the next upload from a newer addon";
  }
}

/** The heatmap's shade: one step per goal, 5 and more the darkest (board `doomsday-feats`). */
function heatLevel(n: number): HeatLevel {
  return Math.max(0, Math.min(5, Math.floor(n))) as HeatLevel;
}

function heatmapRow(f: FriendDoomsday, s: DoomsdaySnapshot): HeatmapRow {
  const days = f.heatmap ?? [];
  return {
    key: f.friendKey,
    name: f.name,
    best: f.streak?.best ?? 0,
    days: days.map((n, i) => {
      const start = s.schedule.dayStart - (days.length - 1 - i) * 86400;
      const day = dayName(start, s.schedule.timeZone);
      const label = n === null ? `${day}: no data` : `${day}: ${n} ${n === 1 ? "goal" : "goals"} done`;
      return { level: n === null ? 0 : heatLevel(n), label };
    }),
  };
}

export function doomsdayPage({ snapshot: s, viewerKey, timeZone }: DoomsdayInput): DoomsdayPage {
  const me = s.friends.find((f) => f.friendKey === viewerKey);
  const active = s.friends.filter((f) => f.status === "active");
  const approx = (f: FriendDoomsday) => f.points?.approx?.pvp === true;

  const header: DoomsdayHeader = {
    sub: `Daily goals at ${localTime(s.schedule.nextReset, timeZone)}, feats for bragging, and a ladder per track. Suggestions, never rules.`,
  };
  if (me?.status === "active" && me.points !== undefined) {
    header.today = pointsView(me.points.today, approx(me));
    header.week = pointsView(me.points.week, approx(me));
    if (me.streak !== undefined) header.streak = { ...me.streak };
  }

  const page: DoomsdayPage = {
    header,
    soFar: soFar(s, timeZone),
    board: board(s, viewerKey, timeZone),
    heatmap: {
      rows: orderFriends(active, viewerKey).map((f) => heatmapRow(f, s)),
    },
    firstDay: active.every((f) => doneCount(f) === 0),
  };
  const noAddon = s.friends.filter((f) => f.status !== "active").map((f) => f.name);
  if (noAddon.length > 0) {
    page.heatmap.without = `${joinNames(noAddon)}: no Doomsday data yet.`;
  }

  if (me?.status === "active" && me.today !== undefined) {
    const goals = me.today.goals;
    const done = goals.filter((g) => g.doneAt !== undefined).length;
    page.today = {
      title: `Your goals · ${dayName(s.schedule.dayStart, s.schedule.timeZone)}`,
      doneText: `${done} of ${goals.length} done`,
      resets: `resets in ${countdown(s.schedule.nextReset, s.now)}`,
      pve: goals.filter(isPve).map((g) => goalCard(g, timeZone, false)),
      pvp: goals.filter((g) => !isPve(g)).map((g) => goalCard(g, timeZone, false)),
      duels: duelSlot(me),
    };
  }
  if (me?.status === "active" && me.week !== undefined) {
    const week: WeekView = {
      resets: `resets ${weekdayLong(s.schedule.weekReset, timeZone)} ${localTime(s.schedule.weekReset, timeZone)} · in ${countdown(s.schedule.weekReset, s.now)}`,
      goals: me.week.goals.map((g) => goalCard(g, timeZone, true)),
    };
    const points = pointsView(me.points?.week, approx(me));
    if (points !== undefined) week.points = points;
    page.week = week;
  }
  return page;
}

/** The viewer first, then by goals done today, then by name; friends without data last. */
function orderFriends(friends: readonly FriendDoomsday[], viewerKey: string | undefined): FriendDoomsday[] {
  return [...friends].sort(
    (a, b) =>
      Number(b.friendKey === viewerKey) - Number(a.friendKey === viewerKey) ||
      Number(b.status === "active") - Number(a.status === "active") ||
      doneCount(b) - doneCount(a) ||
      compareText(a.name, b.name),
  );
}

function board(s: DoomsdaySnapshot, viewerKey: string | undefined, timeZone: string): BoardView {
  const columns = boardColumns(s);
  const rows = orderFriends(s.friends, viewerKey).map((f): BoardRow => {
    const row: BoardRow = {
      key: f.friendKey,
      name: f.name,
      initials: initials(f.name),
      you: f.friendKey === viewerKey,
      crossedOut: f.today?.finishedAt !== undefined,
      pvpVirgin: f.status === "active" && f.pvpVirgin,
      dim: f.status !== "active",
    };
    if (f.status !== "active") {
      row.note = withoutNote(f);
      return row;
    }
    if (s.crown?.friendKey === f.friendKey) row.crown = localTime(s.crown.at, timeZone);
    row.cells = columns.map((c) => boardCell(goalFor(f, c), timeZone));
    row.duels = duelsCell(f);
    const approx = f.points?.approx?.pvp === true;
    const today = pointsView(f.points?.today, approx);
    const week = pointsView(f.points?.week, approx);
    if (today !== undefined) row.today = today;
    if (week !== undefined) row.week = week;
    if (f.streak !== undefined) row.streak = { ...f.streak };
    return row;
  });
  const view: BoardView = { columns, rows };
  const withData = s.friends.filter((f) => f.status === "active");
  if (withData.length === 1 && s.friends.length > 1) {
    view.lonely =
      withData[0]!.friendKey === viewerKey
        ? "Only you have data so far. The board fills up as friends install the addon and upload."
        : `Only ${withData[0]!.name} has data so far. The board fills up as friends install the addon and upload.`;
  }
  return view;
}

function soFar(s: DoomsdaySnapshot, timeZone: string): SoFarView {
  const view: SoFarView = { finished: [], partial: [], empty: true };
  const crownKey = s.crown?.friendKey;
  if (s.crown !== undefined) {
    const name = s.friends.find((f) => f.friendKey === crownKey)?.name;
    if (name !== undefined) view.crown = { name, time: localTime(s.crown.at, timeZone) };
  }
  const notStarted: string[] = [];
  const noAddon: string[] = [];
  const noData: string[] = [];
  const active = s.friends
    .filter((f) => f.status === "active")
    .sort(
      (a, b) => (a.today?.finishedAt ?? Infinity) - (b.today?.finishedAt ?? Infinity) || compareText(a.name, b.name),
    );
  for (const f of active) {
    const finishedAt = f.today?.finishedAt;
    if (f.friendKey === crownKey) continue;
    if (finishedAt !== undefined) {
      view.finished.push({ name: f.name, initials: initials(f.name), time: localTime(finishedAt, timeZone) });
      continue;
    }
    const done = (f.today?.goals ?? []).filter((g) => g.doneAt !== undefined);
    if (done.length === 0) {
      notStarted.push(f.name);
      continue;
    }
    view.partial.push({ name: f.name, initials: initials(f.name), text: partialText(done) });
  }
  for (const f of s.friends) {
    if (f.status === "noAddon") noAddon.push(f.name);
    else if (f.status !== "active") noData.push(f.name);
  }
  const rest = [
    notStarted.length === 0 ? "" : `${joinNames(notStarted)} ${notStarted.length === 1 ? "hasn't" : "haven't"} started`,
    noData.length === 0 ? "" : `${joinNames(noData)}: no Doomsday data yet`,
    noAddon.length === 0 ? "" : `${joinNames(noAddon)} ${noAddon.length === 1 ? "has" : "have"} no addon`,
  ].filter((x) => x !== "");
  if (rest.length > 0) view.rest = rest.join(" · ");
  view.empty = view.crown === undefined && view.finished.length === 0 && view.partial.length === 0;
  return view;
}

/** "Hunt + Skirmish done", "2 PvE dailies done", "1 PvE daily + Hunt done". */
function partialText(done: readonly FriendGoal[]): string {
  const pve = done.filter(isPve).length;
  const parts: string[] = [];
  if (pve > 0) parts.push(`${pve} PvE ${pve === 1 ? "daily" : "dailies"}`);
  if (done.some((g) => g.goal.slot === "hunt")) parts.push("Hunt");
  if (done.some((g) => g.goal.slot === "skirmish")) parts.push("Skirmish");
  return `${parts.join(" + ")} done`;
}
