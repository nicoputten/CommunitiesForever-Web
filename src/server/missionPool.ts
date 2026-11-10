import { and, eq, max } from "drizzle-orm";
import { scheduleAt } from "@/core/doomsday/engine";
import {
  fullPlan,
  type FullPlan,
  type MissionSetting,
  type MissionStats,
  missionStats,
  neighbours,
  type Often,
  type Override,
  type Period,
  type PoolState,
  rerollSlot,
  sawNormalDraw,
  scheduleOf,
  SLOTS,
  type StoredGoals,
} from "@/core/doomsday/missionPool";
import {
  dayOf,
  dayStart,
  distinctCategories,
  EPOCH,
  goal,
  type MissionSchedule,
  pool,
  type Schedule,
  weekOf,
} from "@/core/doomsday/rules";
import { AccessError } from "./access";
import { logChange, requireOwner } from "./admins";
import { cutoffAt } from "./cutoff";
import type { Db } from "./db";
import { doomsdayGoals, missionOverrides, missionPlan, missionSettings } from "./db/schema";
import { doomsdayResetSetting, getBotSettings } from "./discord";
import { scheduleHunt } from "./hunt";

// The Mission pool (WEB-78): the owner's settings and changes, the plan they make (src/core/doomsday/missionPool.ts)
// and the schedule for the runs answer (addon CF-68). Every change is the owner's only (rule 6: the page hides the
// controls, these refuse them), refused for a locked day or week, logged, and stores the whole plan, so it never
// changes by itself. The page reaches the game only through the schedule, and it changes no points.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** A change to a day or week that is locked: today, tomorrow, or a week within 24 h of its start. */
export class MissionLockedError extends AccessError {
  constructor() {
    super("That day is locked. Nothing was changed.");
    this.name = "MissionLockedError";
  }
}

function clock(db: Db | Tx, now: number) {
  const settings = getBotSettings(db);
  const s = scheduleAt(settings.realmTimeZone, doomsdayResetSetting(settings), now);
  const today = dayOf(now, s);
  return { s, today, week: weekOf(today), todayStart: dayStart(today, s) };
}

function loadState(db: Db | Tx): PoolState {
  const settings: Record<string, MissionSetting> = {};
  for (const r of db.select().from(missionSettings).all()) settings[r.id] = { off: r.off, often: r.often };
  const overrides: Record<Period, Record<number, Record<number, Override>>> = { day: {}, week: {} };
  for (const r of db.select().from(missionOverrides).all())
    (overrides[r.period][r.n] ??= {})[r.slot] = { id: r.id, kind: r.kind };
  const stored: Record<Period, Record<number, string[]>> = { day: {}, week: {} };
  for (const r of db.select().from(missionPlan).all()) stored[r.period][r.n] = r.plan;
  return { settings, overrides, stored };
}

/** When the owner last changed anything; 0 before the first change. */
function lastChange(db: Db | Tx): number {
  const plan =
    db
      .select({ at: max(missionPlan.at) })
      .from(missionPlan)
      .get()?.at ?? 0;
  const setting =
    db
      .select({ at: max(missionSettings.changedAt) })
      .from(missionSettings)
      .get()?.at ?? 0;
  return Math.max(plan, setting);
}

function planAt(db: Db | Tx, now: number, recompute = false): FullPlan {
  const c = clock(db, now);
  return fullPlan({ ...loadState(db), now, s: c.s, today: c.today, week: c.week }, recompute);
}

function storePlan(tx: Tx, plan: FullPlan, now: number, only?: (p: Period, locked: boolean) => boolean): void {
  for (const period of ["day", "week"] as const) {
    for (const p of period === "day" ? plan.days : plan.weeks) {
      if (only !== undefined && !only(period, p.locked)) continue;
      const where = and(eq(missionPlan.period, period), eq(missionPlan.n, p.n));
      const old = tx.select({ plan: missionPlan.plan }).from(missionPlan).where(where).get();
      const same = old !== undefined && old.plan.join() === p.plan.join();
      if (same) continue;
      tx.insert(missionPlan)
        .values({ period, n: p.n, plan: [...p.plan], at: now })
        .onConflictDoUpdate({ target: [missionPlan.period, missionPlan.n], set: { plan: [...p.plan], at: now } })
        .run();
    }
  }
}

/**
 * One owner change: freeze what is locked as it is, make the change, then plan the free days and weeks again and
 * store them. `change` returns the log line (or nothing when nothing changed).
 */
function change(
  db: Db,
  by: string,
  now: number,
  owner: string | undefined,
  make: (
    tx: Tx,
    before: FullPlan,
  ) => { action: Parameters<typeof logChange>[2]; target?: string; detail?: string } | void,
): void {
  db.transaction((tx) => {
    requireOwner(tx, by, owner);
    const before = planAt(tx, now);
    storePlan(tx, before, now, (_, locked) => locked);
    const line = make(tx, before);
    if (line === undefined) return;
    storePlan(tx, planAt(tx, now, true), now);
    logChange(tx, by, line.action, now, line.target, line.detail);
  });
}

function find(plan: FullPlan, period: Period, n: number) {
  const p = (period === "day" ? plan.days : plan.weeks).find((x) => x.n === n);
  if (p === undefined || p.locked) throw new MissionLockedError();
  return p;
}

function checkSlot(period: Period, slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS[period].length) throw new AccessError("No such slot.");
}

/** "day:20767:2" / "week:2968": what a log line is about, for the view to name. */
function where(period: Period, n: number, slot?: number): string {
  return slot === undefined ? `${period}:${n}` : `${period}:${n}:${slot}`;
}

function setOverride(tx: Tx, period: Period, n: number, slot: number, o: Override, by: string, now: number): void {
  const row = { period, n, slot, id: o.id, kind: o.kind, at: now, by };
  tx.insert(missionOverrides)
    .values(row)
    .onConflictDoUpdate({ target: [missionOverrides.period, missionOverrides.n, missionOverrides.slot], set: row })
    .run();
}

/** Switches a mission on or off, or sets how often it comes up. */
export function setMission(
  db: Db,
  by: string,
  id: string,
  to: { off?: boolean; often?: Often },
  now: number,
  owner?: string,
): void {
  const g = goal(id);
  if (g === undefined || !pool(g.slot).includes(id)) throw new AccessError("No such mission.");
  if (to.often !== undefined && !["rare", "normal", "often"].includes(to.often))
    throw new AccessError("No such setting.");
  change(db, by, now, owner, (tx) => {
    const old = tx.select().from(missionSettings).where(eq(missionSettings.id, id)).get();
    const next = { off: to.off ?? old?.off ?? false, often: to.often ?? old?.often ?? "normal" };
    if (old !== undefined ? old.off === next.off && old.often === next.often : !next.off && next.often === "normal")
      return;
    tx.insert(missionSettings)
      .values({ id, ...next, changedAt: now, changedBy: by })
      .onConflictDoUpdate({ target: missionSettings.id, set: { ...next, changedAt: now, changedBy: by } })
      .run();
    if (to.off !== undefined && to.off !== (old?.off ?? false))
      return { action: to.off ? "missionOff" : "missionOn", target: id };
    return { action: "missionOften", target: id, detail: next.often };
  });
}

/** Pins a mission in a slot of a free day or week. */
export function pinMission(
  db: Db,
  by: string,
  period: Period,
  n: number,
  slot: number,
  id: string,
  now: number,
  owner?: string,
): void {
  checkSlot(period, slot);
  const g = goal(id);
  if (g === undefined || g.slot !== SLOTS[period][slot] || !pool(g.slot).includes(id))
    throw new AccessError("That mission doesn't fit that slot.");
  change(db, by, now, owner, (tx, before) => {
    const p = find(before, period, n);
    // Another slot with the same mission, or a daily (from pool version 2 also a weekly) of the same category, can't
    // stay.
    const clash = p.plan.findIndex(
      (x, i) =>
        i !== slot &&
        (x === id || (i < 3 && distinctCategories(SLOTS[period][slot]!) && goal(x)?.category === g.category)),
    );
    if (clash !== -1)
      tx.delete(missionOverrides)
        .where(and(eq(missionOverrides.period, period), eq(missionOverrides.n, n), eq(missionOverrides.slot, clash)))
        .run();
    setOverride(tx, period, n, slot, { id, kind: "pin" }, by, now);
    return { action: "missionPinned", target: id, detail: where(period, n, slot) };
  });
}

/** Rerolls one slot of a free day or week: another mission that fits, at random, stored. */
export function rerollMission(
  db: Db,
  by: string,
  period: Period,
  n: number,
  slot: number,
  now: number,
  owner?: string,
  random: () => number = Math.random,
): void {
  checkSlot(period, slot);
  change(db, by, now, owner, (tx, before) => {
    const p = find(before, period, n);
    const around = neighbours(period === "day" ? before.days : before.weeks, n);
    const id = rerollSlot(period, p.plan, slot, loadState(tx).settings, around, random);
    if (id === undefined) return;
    setOverride(tx, period, n, slot, { id, kind: "reroll" }, by, now);
    return { action: "missionRerolled", target: id, detail: where(period, n, slot) };
  });
}

/** Rerolls every slot of a free day or week that isn't pinned. */
export function rerollDay(
  db: Db,
  by: string,
  period: Period,
  n: number,
  now: number,
  owner?: string,
  random: () => number = Math.random,
): void {
  change(db, by, now, owner, (tx, before) => {
    const p = find(before, period, n);
    const state = loadState(tx);
    const pins = state.overrides[period][n] ?? {};
    const around = neighbours(period === "day" ? before.days : before.weeks, n);
    const plan = [...p.plan];
    let any = false;
    for (let slot = 0; slot < plan.length; slot++) {
      if (pins[slot]?.kind === "pin") continue;
      const id = rerollSlot(period, plan, slot, state.settings, around, random);
      if (id === undefined) continue;
      plan[slot] = id;
      setOverride(tx, period, n, slot, { id, kind: "reroll" }, by, now);
      any = true;
    }
    if (!any) return;
    return { action: "missionDayRerolled", detail: where(period, n) };
  });
}

/** Removes the owner's pins and rerolls of a free day or week: back to the draw (with the settings). */
export function backToNormal(db: Db, by: string, period: Period, n: number, now: number, owner?: string): void {
  change(db, by, now, owner, (tx, before) => {
    find(before, period, n);
    const removed = tx
      .delete(missionOverrides)
      .where(and(eq(missionOverrides.period, period), eq(missionOverrides.n, n)))
      .run();
    if (removed.changes === 0) return;
    return { action: "missionDayNormal", detail: where(period, n) };
  });
}

// --- reading -----------------------------------------------------------------------------------------------------

/** The schedule for the runs answer (CF-68). */
export function doomsdaySchedule(db: Db | Tx, now: number): MissionSchedule | undefined {
  // From pool version 6 the site decides every day (WEB-108): always a schedule, with the Hunt. The days that entered
  // the window since the last change are stored, so they freeze as they lock.
  const plan = planAt(db, now);
  storePlan(db as Tx, plan, now, (_, locked) => locked);
  return scheduleOf(plan, lastChange(db), clock(db, now).todayStart, scheduleHunt(db, now));
}

export interface MissionPoolData {
  now: number;
  /** The realm clock now. */
  s: Schedule;
  /** The first day the stats count (the launch cut-off's day, or the first Doomsday day). */
  fromDay: number;
  today: number;
  week: number;
  plan: FullPlan;
  settings: Readonly<Record<string, MissionSetting>>;
  overrides: PoolState["overrides"];
  stats: Map<string, MissionStats>;
  /** Per changed day or week that has records: the friends (person keys) who saw the normal draw. */
  sawNormal: { period: Period; n: number; owners: string[] }[];
}

/** Everything the page shows (WEB-79). Owner only. */
export function missionPool(db: Db, by: string, now: number, owner?: string): MissionPoolData {
  requireOwner(db, by, owner);
  const c = clock(db, now);
  const state = loadState(db);
  const plan = fullPlan({ ...state, now, s: c.s, today: c.today, week: c.week });
  const records: StoredGoals[] = db
    .select()
    .from(doomsdayGoals)
    .all()
    .map((r) => ({ owner: r.owner, period: r.period, n: r.n, data: r.data }));
  const cutoff = cutoffAt(db);
  const fromDay = cutoff > 0 ? Math.max(dayOf(cutoff, c.s), EPOCH) : EPOCH;
  const sawNormal: MissionPoolData["sawNormal"] = [];
  for (const period of ["day", "week"] as const) {
    const changed = Object.entries(state.stored[period])
      .map(([n, p]) => ({ n: Number(n), plan: p }))
      .filter((p) => (period === "day" ? p.n <= c.today : p.n <= c.week));
    for (const p of changed) {
      const owners = sawNormalDraw(records, period, p.n, p.plan);
      if (owners.length > 0) sawNormal.push({ period, n: p.n, owners });
    }
  }
  return {
    now,
    s: c.s,
    fromDay,
    today: c.today,
    week: c.week,
    plan,
    settings: state.settings,
    overrides: state.overrides,
    stats: missionStats(records, { day: fromDay, week: weekOf(fromDay) }),
    sawNormal,
  };
}
