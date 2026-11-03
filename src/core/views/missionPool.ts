import {
  type FullPlan,
  type MissionSetting,
  type MissionStats,
  type Often,
  type Override,
  type Period,
  type PlannedPeriod,
  type Settings,
  settingOf,
  shortDay,
  SLOTS,
  slotName,
} from "../doomsday/missionPool";
import {
  dayLabel,
  dayStart,
  DAY,
  goal,
  goalPoints,
  partOfDay,
  pool,
  type Schedule,
  shortLabel,
  weekStart,
} from "../doomsday/rules";
import { MONTH_SHORT, WEEKDAY_SHORT } from "../names";

// The Mission pool page (WEB-79, boards `mission-pool`, `mission-pool-steering`, `mission-pool-states`) and the Admin
// page's box (`mission-pool-admin-entry`), from WEB-78's data. Times in the viewer's zone; day names ("Fri 7") are the
// Doomsday day's, the realm date it starts on. Pure.

export interface MissionPoolInput {
  now: number;
  s: Schedule;
  fromDay: number;
  today: number;
  week: number;
  plan: FullPlan;
  settings: Settings;
  overrides: Readonly<Record<Period, Readonly<Record<number, Readonly<Record<number, Override>>>>>>;
  stats: ReadonlyMap<string, MissionStats>;
  sawNormal: readonly { period: Period; n: number; owners: string[] }[];
}

export interface TileMission {
  short: string;
  pvp: boolean;
}

export interface DayTile {
  n: number;
  /** "Fri 7". */
  label: string;
  /** "today", "tomorrow". */
  note?: string;
  locked: boolean;
  changed: boolean;
  missions: TileMission[];
}

export interface WeekTile {
  n: number;
  /** "Week 46 · from Sun 9 19:00". */
  title: string;
  /** "3 dungeons · 3 levels · 5 days". */
  pve: string;
  /** "Bounty: 50 counted kills". */
  bounty?: string;
  locked: boolean;
  changed: boolean;
}

export interface PoolRow {
  id: string;
  text: string;
  short: string;
  points: string;
  cameUp: string;
  swapped: string;
  /** 0..100, undefined without records. */
  donePct?: number;
  done: string;
  last: string;
  /** The phone's line: "Came up 18 · done 71% · last Mon". */
  line: string;
  off: boolean;
  often: Often;
}

export interface PoolGroup {
  kind: string;
  title: string;
  rows: PoolRow[];
}

export interface SlotOption {
  id: string;
  text: string;
  /** "also Wed 5": already on another day or week of the plan. */
  also?: string;
}

export interface EditorSlot {
  slot: number;
  name: string;
  id: string;
  text: string;
  tag?: "pinned" | "rerolled";
  options: SlotOption[];
}

export interface Editor {
  period: Period;
  n: number;
  title: string;
  /** "Fri 19:00 → Sat 19:00" (a day). */
  span?: string;
  /** "changed" or "normal draw". */
  changed: boolean;
  locked: boolean;
  /** "Locks Sat 8 19:00" for a free week. */
  locks?: string;
  slots: EditorSlot[];
  /** "Finish 10 quests is also on Thu 6". */
  warnings: string[];
  /** The owner changed this day or week: "Back to normal draw". */
  canReset: boolean;
  /** Friends (display names) who saw the normal draw on this changed day or week. */
  sawNormal: string[];
}

export interface MissionPoolView {
  counts: { label: string; count: number }[];
  /** "1 changed", or nothing. */
  changedText?: string;
  days: DayTile[];
  weeks: WeekTile[];
  /** "since launch · 34 days". */
  since: string;
  groups: PoolGroup[];
  /** Missions in the pool. */
  missionCount: number;
  editor?: Editor;
  /** "Won't come up from Thu 6.": the first free day. */
  offFrom: string;
}

/** The kinds in page order (the Hunt joins once it is on: HUNT_SINCE). */
const KINDS = [
  { kind: "daily", title: "Daily · PvE", count: "Daily PvE" },
  { kind: "skirmish", title: "Skirmish · PvP", count: "Skirmish" },
  { kind: "weekly", title: "Weekly", count: "Weekly" },
  { kind: "bounty", title: "Bounty · PvP", count: "Bounty" },
] as const;

interface Clock {
  weekday: string;
  day: number;
  month: number;
  hour: number;
  time: string;
}

function clock(at: number, timeZone: string): Clock {
  const p: Record<string, string> = {};
  try {
    for (const x of new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(at * 1000)))
      p[x.type] = x.value;
  } catch {
    return clock(at, "UTC");
  }
  return {
    weekday: WEEKDAY_SHORT.find((w) => w === p.weekday) ?? p.weekday ?? "",
    day: Number(p.day),
    month: Number(p.month),
    hour: Number(p.hour),
    time: `${p.hour}:${p.minute}`,
  };
}

/** "Sun 9 19:00" in the viewer's zone. */
function at(time: number, timeZone: string): string {
  const c = clock(time, timeZone);
  return `${c.weekday} ${c.day} ${c.time}`;
}

/** The ISO week number of the Monday a Doomsday week mostly is (it starts on Sunday evening): "Week 46". */
export function weekNumber(week: number): number {
  const monday = new Date((weekStart(week) + 1) * DAY * 1000);
  const thursday = new Date(monday.getTime() + 3 * DAY * 1000);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / (DAY * 1000) / 7) + 1;
}

function weekTitle(week: number, s: Schedule, timeZone: string): string {
  return `Week ${weekNumber(week)} · from ${at(dayStart(weekStart(week), s), timeZone)}`;
}

const isPvp = (id: string) => goalPoints(id)?.track === "pvp";

const missionText = (id: string) => goal(id)?.text ?? "A mission from a newer version";

/** "Mon" within the last week, else "12 Oct"; weeks "wk 44". */
function lastText(kind: string, last: number | undefined, today: number): string {
  if (last === undefined) return "—";
  if (kind === "weekly" || kind === "bounty") return `wk ${weekNumber(last)}`;
  if (today - last < 7) return WEEKDAY_SHORT[(last + 4) % 7]!;
  const d = new Date(last * DAY * 1000);
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

function row(id: string, kind: string, setting: MissionSetting, stats: MissionStats | undefined, today: number) {
  const pct = stats !== undefined && stats.had > 0 ? Math.round((stats.done / stats.had) * 100) : undefined;
  const cameUp = stats?.cameUp ?? 0;
  const done = pct === undefined ? "—" : `${pct}%`;
  const last = lastText(kind, stats?.last, today);
  const out: PoolRow = {
    id,
    text: missionText(id),
    short: shortLabel(id),
    points: `+${goalPoints(id)?.points ?? 0}`,
    cameUp: stats === undefined ? "—" : String(cameUp),
    swapped: stats === undefined ? "—" : String(stats.swapped),
    done,
    last,
    line: `Came up ${stats === undefined ? "—" : cameUp} · done ${done} · last ${last}`,
    off: setting.off,
    often: setting.often,
  };
  if (pct !== undefined) out.donePct = pct;
  return out;
}

function tile(p: PlannedPeriod, today: number): DayTile {
  const t: DayTile = {
    n: p.n,
    label: shortDay(p.n),
    locked: p.locked,
    changed: p.changed,
    missions: p.plan.map((id) => ({ short: shortLabel(id), pvp: isPvp(id) })),
  };
  if (p.n === today) t.note = "today";
  else if (p.n === today + 1) t.note = "tomorrow";
  return t;
}

function weekTile(p: PlannedPeriod, s: Schedule, timeZone: string): WeekTile {
  const t: WeekTile = {
    n: p.n,
    title: weekTitle(p.n, s, timeZone),
    pve: p.plan
      .slice(0, 3)
      .map((id) => shortLabel(id))
      .join(" · "),
    locked: p.locked,
    changed: p.changed,
  };
  if (p.plan[3] !== undefined) t.bounty = `Bounty: ${missionText(p.plan[3]).replace(/^./, (c) => c.toLowerCase())}`;
  return t;
}

function editor(
  input: MissionPoolInput,
  period: Period,
  n: number,
  timeZone: string,
  nameOf: (owner: string) => string,
): Editor | undefined {
  const list = period === "day" ? input.plan.days : input.plan.weeks;
  const p = list.find((x) => x.n === n);
  if (p === undefined || (period === "day" ? n < input.today : n <= input.week)) return undefined;
  const overrides = input.overrides[period][n] ?? {};
  const label = (m: number) => (period === "day" ? shortDay(m) : `Week ${weekNumber(m)}`);
  // Where else a mission is planned: the other days or weeks shown.
  const shown = list.filter((x) => (period === "day" ? x.n >= input.today : x.n > input.week));
  const elsewhere = (id: string) => shown.find((x) => x.n !== n && x.plan.includes(id));
  const slots: EditorSlot[] = p.plan.map((id, slot) => {
    const kind = SLOTS[period][slot]!;
    const o = overrides[slot];
    const s: EditorSlot = {
      slot,
      name: slotName(period, slot),
      id,
      text: missionText(id),
      options: pool(kind)
        .filter((x) => x !== id && !settingOf(input.settings, x).off)
        .map((x) => {
          const other = elsewhere(x);
          return other !== undefined
            ? { id: x, text: missionText(x), also: `also ${label(other.n)}` }
            : { id: x, text: missionText(x) };
        }),
    };
    if (o !== undefined && o.id === id) s.tag = o.kind === "pin" ? "pinned" : "rerolled";
    return s;
  });
  const warnings: string[] = [];
  for (const id of p.plan) {
    const near = list.find((x) => (x.n === n - 1 || x.n === n + 1) && x.plan.includes(id));
    if (near !== undefined) warnings.push(`${missionText(id)} is also on ${label(near.n)}`);
  }
  const e: Editor = {
    period,
    n,
    title: "",
    changed: p.changed,
    locked: p.locked,
    slots,
    warnings,
    canReset: !p.locked && Object.keys(overrides).length > 0,
    sawNormal: (input.sawNormal.find((x) => x.period === period && x.n === n)?.owners ?? []).map(nameOf),
  };
  if (period === "day") {
    const start = dayStart(n, input.s);
    const a = clock(start, timeZone);
    const b = clock(start + DAY, timeZone);
    e.title = `${dayLabel(n)} · ${partOfDay(a.hour)}`;
    e.span = `${a.weekday} ${a.time} → ${b.weekday} ${b.time}`;
  } else {
    e.title = weekTitle(n, input.s, timeZone);
    if (!p.locked) e.locks = `Locks ${at(dayStart(weekStart(n), input.s) - DAY, timeZone)}`;
  }
  return e;
}

/** The page. `select`: the day or week whose editor is open. */
export function missionPoolView(
  input: MissionPoolInput,
  timeZone: string,
  nameOf: (owner: string) => string = (o) => o.split("#")[0]!,
  select?: { period: Period; n: number },
): MissionPoolView {
  const days = input.plan.days.filter((d) => d.n >= input.today);
  const weeks = input.plan.weeks.filter((w) => w.n > input.week);
  const changed = days.filter((d) => d.changed).length;
  const groups = KINDS.map((k) => {
    const rows = pool(k.kind).map((id) =>
      row(id, k.kind, settingOf(input.settings, id), input.stats.get(id), input.today),
    );
    return { kind: k.kind, title: `${k.title} · ${rows.length}`, rows };
  });
  const all = groups.flatMap((g) => g.rows);
  const view: MissionPoolView = {
    counts: [
      ...KINDS.map((k, i) => ({ label: k.count, count: groups[i]!.rows.filter((r) => !r.off).length })),
      { label: "Off", count: all.filter((r) => r.off).length },
    ],
    days: days.map((d) => tile(d, input.today)),
    weeks: weeks.map((w) => weekTile(w, input.s, timeZone)),
    since: `since launch · ${Math.max(0, input.today - input.fromDay)} days`,
    groups,
    missionCount: all.length,
    offFrom: `Won’t come up from ${shortDay(input.today + 2)}.`,
  };
  if (changed > 0) view.changedText = `${changed} changed`;
  if (select !== undefined) {
    const e = editor(input, select.period, select.n, timeZone, nameOf);
    if (e !== undefined) view.editor = e;
  }
  return view;
}

/** The Admin page's box: missions, changed days in the next 14 days, today. */
export function missionPoolBox(input: MissionPoolInput): {
  missions: number;
  changed: number;
  today: string;
} {
  return {
    missions: KINDS.reduce((a, k) => a + pool(k.kind).length, 0),
    changed: input.plan.days.filter((d) => d.n >= input.today && d.changed).length,
    today: shortDay(input.today),
  };
}
