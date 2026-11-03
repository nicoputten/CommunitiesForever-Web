import { WEEKDAY_SHORT } from "../names";
import type { GoalRecord } from "./record";
import {
  DAY,
  dayStart,
  draw,
  drawWeek,
  goal,
  type GoalSlot,
  type MissionSchedule,
  pick,
  pool,
  type Schedule,
  weekStart,
} from "./rules";

// The Mission pool (WEB-78): the owner's steering of future Doomsday days and weeks. The site plans the next 14 days
// and 2 weeks from the normal draw, the settings per mission (off, Rare, Normal, Often) and the owner's pins and
// rerolls, and sends the days and weeks that differ from the normal draw as the schedule (addon CF-68). Today,
// tomorrow and a week from 24 h before its start are locked: their plan is frozen as it was. Pure: the server
// (src/server/missionPool.ts) stores the settings, the owner's changes and the plan.

/** How often a mission comes up on a redrawn day or week. */
export type Often = "rare" | "normal" | "often";
/** The weights of the redraw (WEB-78): Rare 1, Normal 2, Often 4. */
export const WEIGHT: Readonly<Record<Often, number>> = { rare: 1, normal: 2, often: 4 };

/** A mission's setting; a mission without one is on and Normal. */
export interface MissionSetting {
  off: boolean;
  often: Often;
}
export type Settings = Readonly<Record<string, MissionSetting>>;

export type Period = "day" | "week";
/** A day's plan: the 3 PvE dailies then the Skirmish; a week's: the 3 PvE weeklies then the Bounty. */
export type Plan = readonly string[];

/** The owner's change to one slot (0..3) of a day or week. A reroll is random and stored, so it never changes. */
export interface Override {
  id: string;
  kind: "pin" | "reroll";
}
export type Overrides = Readonly<Record<number, Readonly<Record<number, Override>>>>;

/** The slot kinds of a day and a week, by slot index. */
export const SLOTS: Readonly<Record<Period, readonly GoalSlot[]>> = {
  day: ["daily", "daily", "daily", "skirmish"],
  week: ["weekly", "weekly", "weekly", "bounty"],
};

/** "Daily 3", "Skirmish", "Weekly 1", "Bounty": a slot's name. */
export function slotName(period: Period, slot: number): string {
  const kind = SLOTS[period][slot];
  if (kind === "daily" || kind === "weekly") return `${kind === "daily" ? "Daily" : "Weekly"} ${slot + 1}`;
  return kind === "skirmish" ? "Skirmish" : "Bounty";
}

/** The site's own salts for the redraw: never the draw's (rules.ts SALT), so a redraw isn't the normal draw again. */
const REDRAW_SALT: Readonly<Record<Period, readonly number[]>> = { day: [31, 32, 33, 34], week: [41, 42, 43, 44] };

/** The normal draw of a day or week as a plan. */
export function normalPlan(period: Period, n: number): Plan {
  if (period === "day") {
    const d = draw(n);
    return [...d.dailies, ...(d.skirmish !== undefined ? [d.skirmish] : [])];
  }
  const w = drawWeek(n);
  return [...w.weeklies, ...(w.bounty !== undefined ? [w.bounty] : [])];
}

export function settingOf(settings: Settings, id: string): MissionSetting {
  return settings[id] ?? { off: false, often: "normal" };
}

const isOn = (settings: Settings, id: string) => !settingOf(settings, id).off;
const category = (id: string) => goal(id)?.category;

/** Whether a slot kind is weighted: some mission of it that is on is set to Rare or Often. */
function weighted(kind: GoalSlot, settings: Settings): boolean {
  return pool(kind).some((id) => isOn(settings, id) && settingOf(settings, id).often !== "normal");
}

/** Whether `id` may go in `slot` next to the other slots' missions: different missions, 3 categories for dailies. */
function fits(period: Period, slot: number, id: string, others: readonly (string | undefined)[]): boolean {
  if (others.some((o, i) => i !== slot && o === id)) return false;
  if (SLOTS[period][slot] !== "daily") return true;
  return !others.some((o, i) => i !== slot && o !== undefined && i < 3 && category(o) === category(id));
}

/** The missions that may fill a slot: of its kind, on, fitting the day, not on the day before or after. */
export function candidates(
  period: Period,
  slot: number,
  others: readonly (string | undefined)[],
  settings: Settings,
  neighbours: readonly string[] = [],
): string[] {
  const kind = SLOTS[period][slot]!;
  const list = pool(kind).filter((id) => isOn(settings, id) && fits(period, slot, id, others));
  const fresh = list.filter((id) => !neighbours.includes(id));
  return fresh.length > 0 ? fresh : list;
}

function weightedPick(list: readonly string[], n: number, salt: number, settings: Settings): string | undefined {
  if (list.length === 0) return undefined;
  const total = list.reduce((a, id) => a + WEIGHT[settingOf(settings, id).often], 0);
  let k = pick(n, salt, total);
  for (const id of list) {
    k -= WEIGHT[settingOf(settings, id).often];
    if (k <= 0) return id;
  }
  return list[list.length - 1];
}

/**
 * The plan of one free day or week from the settings and the owner's changes, after `previous` (the plan of the day
 * or week before). Without settings or changes it is the normal draw. A slot kind with a Rare or Often mission is
 * redrawn weighted; otherwise the normal draw stays, and only a mission that is off, or on the day before, is
 * replaced. Pins and rerolls win; a reroll of a mission switched off since is replaced too. Deterministic.
 */
export function planOne(
  period: Period,
  n: number,
  previous: Plan,
  settings: Settings,
  overrides: Readonly<Record<number, Override>> = {},
): Plan {
  const normal = normalPlan(period, n);
  const slots = SLOTS[period];
  const out: (string | undefined)[] = slots.map((_, i) => {
    const o = overrides[i];
    return o !== undefined && (o.kind === "pin" || isOn(settings, o.id)) ? o.id : undefined;
  });
  const fixed = out.map((x) => x !== undefined);
  // The normal draw's missions stay where their kind isn't weighted and they still fit. Twice running counts only
  // against a changed day before: where the normal draw itself repeats (at the epoch), it stays the draw.
  const normalBefore = normalPlan(period, n - 1);
  for (let i = 0; i < slots.length; i++) {
    const id = normal[i];
    if (fixed[i] || id === undefined || weighted(slots[i]!, settings)) continue;
    const twice = previous.includes(id) && !normalBefore.includes(id);
    if (isOn(settings, id) && !twice && fits(period, i, id, out)) out[i] = id;
  }
  for (let i = 0; i < slots.length; i++) {
    if (out[i] !== undefined) continue;
    out[i] = weightedPick(candidates(period, i, out, settings, previous), n, REDRAW_SALT[period][i]!, settings);
    // Nothing on fits (everything switched off): the normal draw's mission stays.
    out[i] ??= normal[i];
  }
  return out.filter((x): x is string => x !== undefined);
}

export function samePlan(a: Plan | undefined, b: Plan | undefined): boolean {
  return a !== undefined && b !== undefined && a.length === b.length && a.every((x, i) => x === b[i]);
}

// --- the window ------------------------------------------------------------------------------------------------

/** Days shown and planned: today and the 13 after it. Weeks: this week and the 2 after it. */
export const PLAN_DAYS = 14;
export const PLAN_WEEKS = 3;
/** A week locks this long before it starts. */
export const WEEK_LOCK = DAY;

/** Today and tomorrow are locked (and every day before them). */
export function dayLocked(n: number, today: number): boolean {
  return n <= today + 1;
}

/** A week is locked from 24 h before its start. */
export function weekLocked(week: number, now: number, s: Schedule): boolean {
  return now >= dayStart(weekStart(week), s) - WEEK_LOCK;
}

/** The days and weeks the plan covers: from yesterday and last week (what the schedule holds) to the last planned. */
export function window(today: number, week: number): { days: number[]; weeks: number[] } {
  const days: number[] = [];
  for (let n = today - 1; n < today + PLAN_DAYS; n++) days.push(n);
  const weeks: number[] = [];
  for (let w = week - 1; w < week + PLAN_WEEKS; w++) weeks.push(w);
  return { days, weeks };
}

export interface PoolState {
  settings: Settings;
  overrides: Readonly<Record<Period, Overrides>>;
  /** The plan as stored: frozen when locked, as last computed when free. */
  stored: Readonly<Record<Period, Readonly<Record<number, Plan>>>>;
}

export interface PlanInput extends PoolState {
  now: number;
  /** The realm clock. */
  s: Schedule;
  today: number;
  week: number;
}

export interface PlannedPeriod {
  n: number;
  plan: Plan;
  normal: Plan;
  locked: boolean;
  changed: boolean;
}

export interface FullPlan {
  days: PlannedPeriod[];
  weeks: PlannedPeriod[];
}

/**
 * The plan over the window. A locked day or week keeps its stored plan; a free one is computed from the settings and
 * changes. A day without a stored plan (it entered the window after the last change) follows from the one before it,
 * so the plan never changes by itself: only a change by the owner moves a free day.
 */
export function fullPlan(input: PlanInput, recompute = false): FullPlan {
  const { days, weeks } = window(input.today, input.week);
  const run = (period: Period, list: number[], locked: (n: number) => boolean): PlannedPeriod[] => {
    const first = list[0]!;
    let previous: Plan = input.stored[period][first - 1] ?? normalPlan(period, first - 1);
    return list.map((n) => {
      const isLocked = locked(n);
      const stored = input.stored[period][n];
      const plan =
        stored !== undefined && (isLocked || !recompute)
          ? stored
          : planOne(period, n, previous, input.settings, input.overrides[period][n]);
      previous = plan;
      const normal = normalPlan(period, n);
      return { n, plan, normal, locked: isLocked, changed: !samePlan(plan, normal) };
    });
  };
  return {
    days: run("day", days, (n) => dayLocked(n, input.today)),
    weeks: run("week", weeks, (w) => weekLocked(w, input.now, input.s)),
  };
}

/**
 * The schedule for the runs answer (CF-68): the changed days and weeks, every slot. Undefined while nothing was ever
 * changed; `{ v }` alone once everything is back to the normal draw, so the addons drop the old one. `v` is the last
 * change, or today's reset when later: a day that entered the window since follows the settings, and is new to the
 * addons.
 */
export function scheduleOf(plan: FullPlan, lastChange: number, todayStart: number): MissionSchedule | undefined {
  if (lastChange <= 0) return undefined;
  const out: MissionSchedule = { v: Math.max(lastChange, todayStart) };
  const days = plan.days.filter((d) => d.changed && d.plan.length === 4);
  if (days.length > 0)
    out.days = Object.fromEntries(days.map((d) => [String(d.n), { daily: d.plan.slice(0, 3), skirmish: d.plan[3]! }]));
  const weeks = plan.weeks.filter((w) => w.changed && w.plan.length === 4);
  if (weeks.length > 0)
    out.weeks = Object.fromEntries(weeks.map((w) => [String(w.n), { weekly: w.plan.slice(0, 3), bounty: w.plan[3]! }]));
  return out;
}

// --- steering ----------------------------------------------------------------------------------------------------

/** The plans around a day or week: the one before and after, for "never twice running". */
export function neighbours(plan: readonly PlannedPeriod[], n: number): string[] {
  return plan.filter((p) => p.n === n - 1 || p.n === n + 1).flatMap((p) => [...p.plan]);
}

/** A random reroll of one slot: another mission that fits; undefined when none does. `random` in [0, 1). */
export function rerollSlot(
  period: Period,
  current: Plan,
  slot: number,
  settings: Settings,
  around: readonly string[],
  random: () => number,
): string | undefined {
  const list = candidates(period, slot, current, settings, around).filter((id) => id !== current[slot]);
  return list.length === 0 ? undefined : list[Math.floor(random() * list.length)];
}

// --- stats -------------------------------------------------------------------------------------------------------

export interface StoredGoals {
  owner: string;
  period: Period;
  n: number;
  data: GoalRecord;
}

export interface MissionStats {
  /** Days or weeks it was in a set at least one friend recorded (before swaps). */
  cameUp: number;
  /** How often a friend got another mission instead of it. */
  swapped: number;
  /** Friends who had it (after swaps), per day or week, and how many of them finished it. */
  had: number;
  done: number;
  /** The last day or week it came up. */
  last?: number;
}

/** A recorded set before swaps. */
export function unswapped(r: GoalRecord): string[] {
  return r.set.map((id) => r.swapped[id] ?? id);
}

/** Stats per mission id from the stored goal records, from a day and week on (the launch cut-off). */
export function missionStats(
  records: readonly StoredGoals[],
  from: { day: number; week: number },
): Map<string, MissionStats> {
  const stats = new Map<string, MissionStats>();
  const of = (id: string) => {
    let s = stats.get(id);
    if (s === undefined) stats.set(id, (s = { cameUp: 0, swapped: 0, had: 0, done: 0 }));
    return s;
  };
  const cameUp = new Map<string, Set<string>>();
  for (const r of records) {
    if (r.n < (r.period === "day" ? from.day : from.week)) continue;
    for (const id of unswapped(r.data)) {
      const key = `${r.period}:${r.n}`;
      let seen = cameUp.get(id);
      if (seen === undefined) cameUp.set(id, (seen = new Set()));
      if (!seen.has(key)) {
        seen.add(key);
        const s = of(id);
        s.cameUp++;
        if (s.last === undefined || r.n > s.last) s.last = r.n;
      }
    }
    for (const original of Object.values(r.data.swapped)) of(original).swapped++;
    for (const id of r.data.set) {
      const s = of(id);
      s.had++;
      if (r.data.done[id] !== undefined) s.done++;
    }
  }
  return stats;
}

/**
 * For a changed day or week, the friends whose recorded set (before swaps) is the normal draw instead of the plan:
 * their addon didn't have the schedule. Their points still count for the missions they had.
 */
export function sawNormalDraw(records: readonly StoredGoals[], period: Period, n: number, plan: Plan): string[] {
  const normal = normalPlan(period, n);
  if (samePlan(plan, normal)) return [];
  const sorted = (x: readonly string[]) => [...x].sort().join(",");
  const want = sorted(normal);
  return records
    .filter((r) => r.period === period && r.n === n)
    .filter((r) => {
      // The Hunt isn't planned: compare the planned slots only.
      const set = unswapped(r.data).filter((id) => goal(id) !== undefined);
      return sorted(set) === want && sorted(set) !== sorted(plan);
    })
    .map((r) => r.owner)
    .sort();
}

// --- names -------------------------------------------------------------------------------------------------------

/** "Fri 7": a Doomsday day by the realm date it starts on. */
export function shortDay(n: number): string {
  return `${WEEKDAY_SHORT[(n + 4) % 7]} ${new Date(n * DAY * 1000).getUTCDate()}`;
}

/** A mission's name; an id this version doesn't know shows as such. */
export function missionName(id: string): string {
  return goal(id)?.text ?? "a mission from a newer version";
}

/** "day:20767:2" → "Fri 7"; "week:2968" → "the week of Sun 15" (the admin log's detail). */
export function missionPlace(detail: string | undefined): string {
  const [period, n] = (detail ?? "").split(":");
  const num = Number(n);
  if (!Number.isInteger(num)) return "a day";
  return period === "week" ? `the week of ${shortDay(weekStart(num))}` : shortDay(num);
}

/** "day:20767:2" → "Daily 3". */
export function missionSlot(detail: string | undefined): string {
  const [period, , slot] = (detail ?? "").split(":");
  const i = Number(slot);
  return (period === "day" || period === "week") && Number.isInteger(i) && i >= 0 && i < 4
    ? slotName(period, i)
    : "a slot";
}
