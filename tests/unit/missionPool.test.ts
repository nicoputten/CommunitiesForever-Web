import { describe, expect, it } from "vitest";
import {
  dayLocked,
  fullPlan,
  missionPlace,
  missionSlot,
  missionStats,
  normalPlan,
  type Overrides,
  type Plan,
  planOne,
  type PlanInput,
  rerollSlot,
  sawNormalDraw,
  scheduleOf,
  type Settings,
  shortDay,
  type StoredGoals,
  weekLocked,
} from "@/core/doomsday/missionPool";
import { dayStart, goal, pool, weekStart } from "@/core/doomsday/rules";

// WEB-78: the Mission pool's plan. Days 20766 (Mon 9 Nov) and on, week 2967; the realm clock is CET, reset 19:00.

const S = { offset: 3600, reset: 68400 };
const TODAY = 20766;
const WEEK = 2967;
const NOW = dayStart(TODAY, S) + 3600;

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    settings: {},
    overrides: { day: {}, week: {} },
    stored: { day: {}, week: {} },
    now: NOW,
    s: S,
    today: TODAY,
    week: WEEK,
    ...over,
  };
}

/** The plans of a run of days from the settings alone, chained as the site does. */
function chain(from: number, count: number, settings: Settings, overrides: Overrides = {}): Plan[] {
  const out: Plan[] = [];
  let previous = normalPlan("day", from - 1);
  for (let n = from; n < from + count; n++) {
    previous = planOne("day", n, previous, settings, overrides[n]);
    out.push(previous);
  }
  return out;
}

function expectDrawRules(plans: Plan[]): void {
  plans.forEach((p, i) => {
    expect(new Set(p.slice(0, 3).map((id) => goal(id)!.category)).size, `day ${i} categories`).toBe(3);
    expect(new Set(p).size, `day ${i} distinct`).toBe(4);
    if (i > 0)
      expect(
        p.filter((id) => plans[i - 1]!.includes(id)),
        `day ${i} twice running`,
      ).toEqual([]);
  });
}

describe("the plan", () => {
  it("is the normal draw without settings or changes, and no schedule is sent", () => {
    const plan = fullPlan(input());
    expect(plan.days.map((d) => d.n)).toEqual(Array.from({ length: 15 }, (_, i) => TODAY - 1 + i));
    expect(plan.weeks.map((w) => w.n)).toEqual([WEEK - 1, WEEK, WEEK + 1, WEEK + 2]);
    expect([...plan.days, ...plan.weeks].every((p) => !p.changed)).toBe(true);
    expect(scheduleOf(plan, 0, NOW)).toBeUndefined();
  });

  it("once something was changed, an unchanged plan still sends { v }, so addons drop an old schedule", () => {
    expect(scheduleOf(fullPlan(input()), NOW - 10, NOW - 100)).toEqual({ v: NOW - 10 });
    // A day that entered the window since the last change: v moves to today's reset.
    expect(scheduleOf(fullPlan(input()), NOW - 100, NOW - 10)).toEqual({ v: NOW - 10 });
  });

  it("an off mission doesn't come up on free days; the rest of the day stays the normal draw", () => {
    const off: Settings = { "d.nostalgia": { off: true, often: "normal" } };
    const plan = fullPlan(input({ settings: off }));
    const free = plan.days.filter((d) => !d.locked);
    expect(free.some((d) => d.normal.includes("d.nostalgia"))).toBe(true);
    for (const d of free) {
      expect(d.plan).not.toContain("d.nostalgia");
      if (!d.normal.includes("d.nostalgia")) expect(d.plan).toEqual(d.normal);
      else expect(d.plan.filter((id, i) => id !== d.normal[i]).length).toBeLessThanOrEqual(2);
    }
    expectDrawRules(free.map((d) => d.plan));
    const schedule = scheduleOf(plan, NOW, NOW)!;
    expect(Object.keys(schedule.days!).map(Number)).toEqual(free.filter((d) => d.changed).map((d) => d.n));
    expect(schedule.days![String(free.find((d) => d.changed)!.n)]!.daily).toHaveLength(3);
  });

  it("Often comes up more and Rare less than Normal, always with the draw's rules", () => {
    const count = (settings: Settings, id: string) => chain(21000, 400, settings).filter((p) => p.includes(id)).length;
    const normal = count({}, "d.dungeon");
    const often = count({ "d.dungeon": { off: false, often: "often" } }, "d.dungeon");
    const rare = count({ "d.dungeon": { off: false, often: "rare" } }, "d.dungeon");
    expect(often).toBeGreaterThan(normal * 1.3);
    expect(rare).toBeLessThan(normal * 0.8);
    expectDrawRules(chain(21000, 400, { "d.dungeon": { off: false, often: "often" } }));
    expectDrawRules(chain(21000, 400, { "d.quests10": { off: true, often: "normal" } }));
  });

  it("a pin wins and stays when the settings change; a reroll of a mission switched off since is replaced", () => {
    const n = TODAY + 5;
    const overrides = { [n]: { 0: { id: "d.secondary", kind: "pin" as const } } };
    expect(chain(n, 1, {}, overrides)[0]![0]).toBe("d.secondary");
    const off: Settings = { "d.secondary": { off: true, often: "normal" } };
    expect(chain(n, 1, off, overrides)[0]![0]).toBe("d.secondary");
    const rerolled = { [n]: { 0: { id: "d.secondary", kind: "reroll" as const } } };
    expect(chain(n, 1, {}, rerolled)[0]![0]).toBe("d.secondary");
    expect(chain(n, 1, off, rerolled)[0]).not.toContain("d.secondary");
  });

  it("a pin pushes the normal mission of its category to another one", () => {
    const n = TODAY + 3;
    const normal = normalPlan("day", n);
    // Pinned in the first slot: a daily of the third slot's category.
    const pin = pool("daily").find((id) => id !== normal[2] && goal(id)?.category === goal(normal[2]!)?.category)!;
    const plan = chain(n, 1, {}, { [n]: { 0: { id: pin, kind: "pin" } } })[0]!;
    expect(plan[0]).toBe(pin);
    expect(plan).not.toContain(normal[2]);
    expectDrawRules([plan]);
  });

  it("back to the normal draw: without the owner's changes the day follows the settings again", () => {
    const n = TODAY + 5;
    expect(chain(n, 1, {}, {})[0]).toEqual(normalPlan("day", n));
  });

  it("a reroll is another mission that fits the day and isn't on the day before or after", () => {
    const current = normalPlan("day", TODAY + 5);
    const around = [...normalPlan("day", TODAY + 4), ...normalPlan("day", TODAY + 6)];
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const id = rerollSlot("day", current, 1, {}, around, () => r)!;
      expect(id).not.toBe(current[1]);
      expect(around).not.toContain(id);
      const next = [...current];
      next[1] = id;
      expectDrawRules([next]);
    }
    expect(pool("skirmish")).toContain(rerollSlot("day", current, 3, {}, around, () => 0));
  });

  it("only missions that are on: a reroll never picks one that is off", () => {
    const current = normalPlan("week", WEEK + 2);
    const off: Settings = Object.fromEntries(
      pool("bounty")
        .filter((id) => id !== current[3] && id !== "b.spree10")
        .map((id) => [id, { off: true, often: "normal" as const }]),
    );
    expect(rerollSlot("week", current, 3, off, [], () => 0.5)).toBe("b.spree10");
  });
});

describe("the lock window", () => {
  it("today and tomorrow are locked, the day after isn't", () => {
    expect(dayLocked(TODAY - 1, TODAY)).toBe(true);
    expect(dayLocked(TODAY, TODAY)).toBe(true);
    expect(dayLocked(TODAY + 1, TODAY)).toBe(true);
    expect(dayLocked(TODAY + 2, TODAY)).toBe(false);
  });

  it("a week locks 24 h before it starts", () => {
    const start = dayStart(weekStart(WEEK + 1), S);
    expect(weekLocked(WEEK, NOW, S)).toBe(true);
    expect(weekLocked(WEEK + 1, start - 86400 - 1, S)).toBe(false);
    expect(weekLocked(WEEK + 1, start - 86400, S)).toBe(true);
  });

  it("a locked day keeps its stored plan whatever the settings; a free one follows them", () => {
    const frozen = normalPlan("day", TODAY + 1);
    const off: Settings = Object.fromEntries(frozen.map((id) => [id, { off: true, often: "normal" as const }]));
    const plan = fullPlan(
      input({ settings: off, stored: { day: { [TODAY + 1]: frozen, [TODAY + 2]: frozen }, week: {} } }),
      true,
    );
    expect(plan.days.find((d) => d.n === TODAY + 1)!.plan).toEqual(frozen);
    expect(plan.days.find((d) => d.n === TODAY + 2)!.plan).not.toEqual(frozen);
  });

  it("a day without a stored plan follows the last stored one: the plan doesn't change by itself", () => {
    const settings: Settings = { "d.secondary": { off: false, often: "often" } };
    const first = fullPlan(input({ settings }), true);
    const stored = { day: Object.fromEntries(first.days.map((d) => [d.n, d.plan])), week: {} };
    // Three days later, without a change: the days stored earlier stay, the new ones follow on from them.
    const later = fullPlan(input({ settings, stored, today: TODAY + 3, now: NOW + 3 * 86400 }));
    for (const d of later.days) {
      const before = first.days.find((x) => x.n === d.n);
      if (before !== undefined) expect(d.plan, `day ${d.n}`).toEqual(before.plan);
    }
    expectDrawRules(later.days.map((d) => d.plan));
  });
});

describe("stats", () => {
  const rec = (owner: string, period: "day" | "week", n: number, set: string[], swapped = {}, done = {}) =>
    ({ owner, period, n, data: { set, swapped, done } }) as StoredGoals;

  it("came up, swapped, done and last, from the cut-off on", () => {
    const records = [
      rec("Ada#1001", "day", 20761, ["d.altLevel", "d.chars2", "d.skill5", "p.frontLine"], {}, { "d.chars2": 1 }),
      rec("Bob#1002", "day", 20761, ["d.quests10", "d.chars2", "d.skill5", "p.loneWolf"], {
        "d.quests10": "d.altLevel",
        "p.loneWolf": "p.frontLine",
      }),
      rec("Ada#1001", "day", 20763, ["d.shared3", "d.chars2", "d.level", "p.untouchable"], {}, { "d.chars2": 2 }),
      rec("Ada#1001", "day", 20700, ["d.chars2"], {}, { "d.chars2": 3 }),
      rec("Ada#1001", "week", 2966, ["w.ilvl3", "w.chars3", "w.altLevels2", "b.kills50"], {}, { "b.kills50": 4 }),
    ];
    const stats = missionStats(records, { day: 20761, week: 2966 });
    expect(stats.get("d.chars2")).toEqual({ cameUp: 2, swapped: 0, had: 3, done: 2, last: 20763 });
    expect(stats.get("d.altLevel")).toEqual({ cameUp: 1, swapped: 1, had: 1, done: 0, last: 20761 });
    expect(stats.get("p.frontLine")).toMatchObject({ cameUp: 1, swapped: 1, had: 1 });
    expect(stats.get("d.quests10")).toEqual({ cameUp: 0, swapped: 0, had: 1, done: 0 });
    expect(stats.get("b.kills50")).toEqual({ cameUp: 1, swapped: 0, had: 1, done: 1, last: 2966 });
    expect(stats.get("d.secondary")).toBeUndefined();
  });

  it("saw the normal draw: friends whose set before swaps is the normal draw instead of the plan", () => {
    const n = 20763;
    const normal = normalPlan("day", n);
    // Two dailies the normal draw doesn't have: the plan's and Cy's swap.
    const [planned, swap] = pool("daily").filter((id) => !normal.includes(id));
    const plan = [planned!, normal[1]!, normal[2]!, normal[3]!];
    const records = [
      rec("Bob#1002", "day", n, [...normal]),
      rec("Cy#1003", "day", n, [swap!, ...normal.slice(1)], { [swap!]: normal[0]! }),
      rec("Ada#1001", "day", n, plan),
      rec("Dee#1004", "day", n + 1, [...normal]),
    ];
    expect(sawNormalDraw(records, "day", n, plan)).toEqual(["Bob#1002", "Cy#1003"]);
    expect(sawNormalDraw(records, "day", n, normal)).toEqual([]);
  });
});

describe("names", () => {
  it("days, weeks and slots for the log", () => {
    expect(shortDay(20767)).toBe("Tue 10");
    expect(missionPlace("day:20767:2")).toBe("Tue 10");
    expect(missionPlace("week:2968")).toBe("the week of Sun 15");
    expect(missionSlot("day:20767:2")).toBe("Daily 3");
    expect(missionSlot("week:2968:3")).toBe("Bounty");
  });
});
