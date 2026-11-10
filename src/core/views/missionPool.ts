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
  POOL_VERSION,
  type Schedule,
  shortLabel,
  weekStart,
} from "../doomsday/rules";
import { MONTH_SHORT, WEEKDAY_SHORT } from "../names";
import { dayTarget, type HuntData, HUNTERS, hunted, inDrawCount, type Quarry, quarry } from "./hunt";

// The Mission pool page (WEB-79, boards `mission-pool`, `mission-pool-steering`, `mission-pool-states`; v2 WEB-109,
// boards `mission-pool-v2-overview`, `mission-pool-v2-pvp`) and the Admin page's box (`mission-pool-admin-entry`), from
// WEB-78's and WEB-108's data. Times in the viewer's zone; day names ("Fri 7") are the
// Doomsday day's, the realm date it starts on. Pure.

export type Theme = "questing" | "loot" | "social" | "professions" | "exploration" | "combat";

/** The PvE themes in the boards' order, with their labels (pool version 6 contract). */
export const THEMES: readonly { theme: Theme; name: string }[] = [
  { theme: "questing", name: "Questing" },
  { theme: "loot", name: "Loot & gold" },
  { theme: "social", name: "Social" },
  { theme: "professions", name: "Professions" },
  { theme: "exploration", name: "Exploration" },
  { theme: "combat", name: "Combat & character" },
];

/** Pool version 6's catalogue and draw as the site has them (WEB-108). */
export interface PoolData {
  /** A daily PvE mission's theme. */
  themeOf: (id: string) => Theme | undefined;
  /** The Duel slot's missions (they rotate). */
  duel: readonly string[];
  /** New in pool version 6: the Skirmish card's "50 new". */
  isNew: (id: string) => boolean;
  /** Needs a test on Forever first ("check"), else "easy"; undefined: no tag (the older missions). */
  check: (id: string) => boolean | undefined;
  /** The Duel slot's mission per day, when the plan doesn't carry it. */
  duels: ReadonlyMap<number, string>;
  hunt: HuntData;
}

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
  data: PoolData;
}

export interface DayTile {
  n: number;
  /** "Fri 7". */
  label: string;
  /** "today", "tomorrow". */
  note?: string;
  locked: boolean;
  changed: boolean;
  /** Short names: the 3 PvE, then the Hunt's target ("Gnome Mage"), then the PvP slots. */
  pve: string[];
  hunt?: string;
  pvp: string[];
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

/** A tile of the recipe bar. */
export interface RecipeTile {
  /** "Daily PvE". */
  label: string;
  /** "3". */
  count: string;
  /** "a day", "a week", "". */
  per: string;
  /** "108 in pool · back every ~36 d". */
  line: string;
  /** Its missions come back within ~6 weeks. */
  warn: boolean;
  hunt: boolean;
}

export interface PoolRow {
  id: string;
  text: string;
  short: string;
  points: string;
  /** "came up 2× · 75% · Tue", "—". */
  history: string;
  /** The phone's line: "+3 · came up 2× · 75% · Tue". */
  line: string;
  /** 0..100, undefined without records. */
  donePct?: number;
  cameUp: number;
  /** "easy" or "check" (the new PvP missions). */
  tag?: "easy" | "check";
  off: boolean;
  often: Often;
}

export type CardKind = "pve" | "pvp" | "weekly";

export interface ThemeCard {
  key: string;
  /** "Questing". */
  name: string;
  /** "Daily PvE", "PvP", "Weekly". */
  tag: string;
  kind: CardKind;
  count: number;
  /** "64 came up · 71% done". */
  history: string;
  /** "50 new". */
  fresh?: string;
  rows: PoolRow[];
}

export type PoolFilter = "all" | "never" | "hard" | "off";

export interface FilterChipView {
  filter: PoolFilter;
  label: string;
  count: number;
}

export interface MissionPoolView {
  /** "Every day" … "3 Weekly + a Bounty". */
  recipe: { day: string; week: string };
  tiles: RecipeTile[];
  quarry: Quarry;
  /** "1 changed", or nothing. */
  changedText?: string;
  days: DayTile[];
  weeks: WeekTile[];
  /** "since launch · 34 days". */
  since: string;
  filters: FilterChipView[];
  cards: ThemeCard[];
  /** Missions in the pool. */
  missionCount: number;
  editor?: Editor;
  /** "Won't come up from Thu 6.": the first free day. */
  offFrom: string;
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

/** The kinds of the pool's non-theme cards. */
const KINDS = ["daily", "skirmish", "weekly", "bounty"] as const;

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

function history(stats: MissionStats | undefined, kind: string, today: number): { text: string; pct?: number } {
  if (stats === undefined || stats.cameUp === 0) return { text: "—" };
  const pct = stats.had > 0 ? Math.round((stats.done / stats.had) * 100) : undefined;
  const parts = [`came up ${stats.cameUp}×`];
  if (pct !== undefined) parts.push(`${pct}%`);
  const last = lastText(kind, stats.last, today);
  if (last !== "—") parts.push(last);
  return pct === undefined ? { text: parts.join(" · ") } : { text: parts.join(" · "), pct };
}

function row(
  id: string,
  kind: string,
  setting: MissionSetting,
  stats: MissionStats | undefined,
  today: number,
  data: PoolData,
): PoolRow {
  const h = history(stats, kind, today);
  // In the site's pool version: flat in pool version 1, each mission's own points from version 2 (WEB-80).
  const points = `+${goalPoints(id, POOL_VERSION)?.points ?? 0}`;
  const r: PoolRow = {
    id,
    text: missionText(id),
    short: shortLabel(id),
    points,
    history: h.text,
    line: `${points} · ${h.text}`,
    cameUp: stats?.cameUp ?? 0,
    off: setting.off,
    often: setting.often,
  };
  if (h.pct !== undefined) r.donePct = h.pct;
  const check = data.check(id);
  if (check !== undefined) r.tag = check ? "check" : "easy";
  return r;
}

function tile(p: PlannedPeriod, today: number, data: PoolData): DayTile {
  const pvp = p.plan.filter(isPvp);
  const duel = data.duels.get(p.n);
  if (duel !== undefined && !pvp.includes(duel)) pvp.push(duel);
  const t: DayTile = {
    n: p.n,
    label: shortDay(p.n),
    locked: p.locked,
    changed: p.changed,
    pve: p.plan.filter((id) => !isPvp(id)).map(shortLabel),
    pvp: pvp.map(shortLabel),
  };
  const hunt = dayTarget(data.hunt, p.n);
  if (hunt !== undefined) t.hunt = hunt;
  if (p.n === today) t.note = "today";
  else if (p.n === today + 1) t.note = "tomorrow";
  return t;
}

/** "every ~36 d", "every 6 wk": how often a mission of a slot comes back (pool ÷ slots). */
function backEvery(pool: number, slots: number, unit: "d" | "wk"): { text: string; days: number } {
  const every = slots > 0 && pool > 0 ? pool / slots : 0;
  const approx = Number.isInteger(every) && slots === 1 ? "" : "~";
  return { text: `every ${approx}${Math.round(every)} ${unit}`, days: every * (unit === "wk" ? 7 : 1) };
}

/** A weekly slot whose missions come back within ~6 weeks turns orange (board `mission-pool-v2-overview`). */
const WARN_DAYS = 42;

function recipe(onCount: (ids: readonly string[]) => number, data: PoolData, offCount: number): RecipeTile[] {
  const pve = onCount(pool("daily"));
  const pvp = onCount([...new Set([...pool("skirmish"), ...data.duel])]);
  const weekly = onCount(pool("weekly"));
  const bounty = onCount(pool("bounty"));
  const tiles: RecipeTile[] = [];
  const add = (label: string, count: number, per: string, line: string, warn = false, hunt = false) =>
    tiles.push({ label, count: String(count), per, line, warn, hunt });
  add("Daily PvE", 3, "a day", `${pve} in pool · back ${backEvery(pve, 3, "d").text}`);
  const targets = inDrawCount(data.hunt.targets[hunted(HUNTERS[0]!)]);
  add("The Hunt", 1, "a day", `${targets} targets · weighted`, false, true);
  add("Daily PvP", 2, "a day", `${pvp} in pool · ${backEvery(pvp, 2, "d").text}`);
  const w = backEvery(weekly, 3, "wk");
  add("Weekly", 3, "a week", `${weekly} in pool · ${w.text}`, w.days <= WARN_DAYS);
  const b = backEvery(bounty, 1, "wk");
  add("Bounty", 1, "a week", `${bounty} in pool · ${b.text}`, b.days <= WARN_DAYS);
  add("Off", offCount, "", "switched off");
  return tiles;
}

/** "64 came up · 71% done": a card's history over its missions. */
function cardHistory(rows: readonly PoolRow[], stats: ReadonlyMap<string, MissionStats>): string {
  let cameUp = 0;
  let had = 0;
  let done = 0;
  for (const r of rows) {
    const s = stats.get(r.id);
    if (s === undefined) continue;
    cameUp += s.cameUp;
    had += s.had;
    done += s.done;
  }
  return had > 0 ? `${cameUp} came up · ${Math.round((done / had) * 100)}% done` : `${cameUp} came up`;
}

/** The nine cards: the six PvE themes, Skirmish (with the Duel slot's missions), Weekly, Bounty. */
function cards(input: MissionPoolInput): ThemeCard[] {
  const { data, settings, stats, today } = input;
  const card = (key: string, name: string, kind: CardKind, slot: string, ids: readonly string[]): ThemeCard => {
    const rows = ids.map((id) => row(id, slot, settingOf(settings, id), stats.get(id), today, data));
    return {
      key,
      name,
      tag: kind === "pve" ? "Daily PvE" : kind === "pvp" ? "PvP" : "Weekly",
      kind,
      count: rows.length,
      history: cardHistory(rows, stats),
      rows,
    };
  };
  const daily = pool("daily");
  const out = THEMES.map((t) =>
    card(
      t.theme,
      t.name,
      "pve",
      "daily",
      daily.filter((id) => data.themeOf(id) === t.theme),
    ),
  );
  const skirmish = card("skirmish", "Skirmish", "pvp", "skirmish", [...new Set([...pool("skirmish"), ...data.duel])]);
  const fresh = skirmish.rows.filter((r) => data.isNew(r.id)).length;
  if (fresh > 0) skirmish.fresh = `${fresh} new`;
  out.push(skirmish, card("weekly", "Weekly", "weekly", "weekly", pool("weekly")));
  out.push(card("bounty", "Bounty", "pvp", "bounty", pool("bounty")));
  return out;
}

/** Hard: done by under 30 % of the friends who had it. */
export const HARD_PCT = 30;

export function matches(r: PoolRow, filter: PoolFilter): boolean {
  if (filter === "never") return r.cameUp === 0;
  if (filter === "hard") return r.donePct !== undefined && r.donePct < HARD_PCT;
  if (filter === "off") return r.off;
  return true;
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
  const all = cards(input);
  const rows = [...new Map(all.flatMap((c) => c.rows).map((r) => [r.id, r])).values()];
  const on = (ids: readonly string[]) => ids.filter((id) => !settingOf(input.settings, id).off).length;
  const off = rows.filter((r) => r.off).length;
  const filters: FilterChipView[] = [
    { filter: "all", label: "All", count: rows.length },
    { filter: "never", label: "Never came up", count: rows.filter((r) => matches(r, "never")).length },
    { filter: "hard", label: "Hard", count: rows.filter((r) => matches(r, "hard")).length },
    { filter: "off", label: "Off", count: off },
  ];
  const view: MissionPoolView = {
    recipe: { day: "3 PvE + the Hunt + 2 PvP", week: "3 Weekly + a Bounty" },
    tiles: recipe(on, input.data, off),
    quarry: quarry(input.data.hunt, input.today),
    days: days.map((d) => tile(d, input.today, input.data)),
    weeks: weeks.map((w) => weekTile(w, input.s, timeZone)),
    since: `since launch · ${Math.max(0, input.today - input.fromDay)} days`,
    filters,
    cards: all,
    missionCount: rows.length,
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
    missions: KINDS.reduce((a, k) => a + pool(k).length, 0),
    changed: input.plan.days.filter((d) => d.n >= input.today && d.changed).length,
    today: shortDay(input.today),
  };
}
