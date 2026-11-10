import { describe, expect, it } from "vitest";
import { fullPlan, type PlanInput } from "@/core/doomsday/missionPool";
import { dayStart } from "@/core/doomsday/rules";
import { type MissionPoolInput, missionPoolBox, missionPoolView, weekNumber } from "@/core/views/missionPool";

// WEB-79: the Mission pool page's view on WEB-78's plan. Day 20766 is Mon 9 Nov 2026; the realm is CET, reset 19:00.

const S = { offset: 3600, reset: 68400 };
const TODAY = 20766;
const NOW = dayStart(TODAY, S) + 3600;

function input(over: Partial<PlanInput> = {}, extra: Partial<MissionPoolInput> = {}): MissionPoolInput {
  const plan: PlanInput = {
    settings: {},
    overrides: { day: {}, week: {} },
    stored: { day: {}, week: {} },
    now: NOW,
    s: S,
    today: TODAY,
    week: 2967,
    ...over,
  };
  return {
    now: NOW,
    s: S,
    fromDay: 20761,
    today: TODAY,
    week: 2967,
    plan: fullPlan(plan, true),
    settings: plan.settings,
    overrides: plan.overrides,
    stats: new Map(),
    sawNormal: [],
    ...extra,
  };
}

describe("the Mission pool page", () => {
  it("counts, 14 days from today with today and tomorrow locked, the next 2 weeks", () => {
    const v = missionPoolView(
      input({ settings: { "d.quests10": { off: true, often: "normal" } } }),
      "Europe/Amsterdam",
    );
    expect(v.counts).toEqual([
      { label: "Daily PvE", count: 107 },
      // Pool version 6 (WEB-108): 41 new PvP dailies in the Skirmish, 8 of them "check" ones that start Off.
      { label: "Skirmish", count: 39 },
      { label: "Duel", count: 8 },
      { label: "Weekly", count: 49 },
      { label: "Bounty", count: 6 },
      { label: "Off", count: 9 },
    ]);
    expect(v.days).toHaveLength(14);
    expect(v.days[0]).toMatchObject({ label: "Mon 9", note: "today", locked: true });
    expect(v.days[1]).toMatchObject({ label: "Tue 10", note: "tomorrow", locked: true });
    expect(v.days[2]).toMatchObject({ label: "Wed 11", locked: false });
    expect(v.days[0]!.missions.at(-1)).toMatchObject({ pvp: true });
    expect(v.weeks.map((w) => w.title)).toEqual(["Week 47 · from Sun 15 19:00", "Week 48 · from Sun 22 19:00"]);
    expect(v.since).toBe("since launch · 5 days");
    expect(v.offFrom).toBe("Won’t come up from Wed 11.");
    expect(v.groups.map((g) => g.title)).toEqual([
      "Daily · PvE · 108",
      "Skirmish · PvP · 47",
      "Duel · PvP · 8",
      "Weekly · 49",
      "Bounty · PvP · 6",
    ]);
    expect(v.groups[0]!.rows[0]).toMatchObject({ text: "Finish 10 quests", off: true, cameUp: "—", done: "—" });
  });

  it("stats: done share, last day or week, the phone's line", () => {
    const stats = new Map([
      ["d.level", { cameUp: 18, swapped: 2, had: 14, done: 10, last: TODAY - 1 }],
      ["w.days3", { cameUp: 3, swapped: 0, had: 4, done: 2, last: 2966 }],
    ]);
    const v = missionPoolView(input({}, { stats }), "UTC");
    const level = v.groups[0]!.rows.find((r) => r.id === "d.level")!;
    expect(level).toMatchObject({ cameUp: "18", swapped: "2", donePct: 71, done: "71%", last: "Sun" });
    expect(level.line).toBe("Came up 18 · done 71% · last Sun");
    expect(v.groups[3]!.rows.find((r) => r.id === "w.days3")!.last).toBe(`wk ${weekNumber(2966)}`);
  });

  it("a free day's editor: slots, pinned, the Duel stays, a mission also on the day before", () => {
    const n = TODAY + 3;
    const prev = input().plan.days.find((d) => d.n === n - 1)!.plan[0]!;
    const v = missionPoolView(
      input({ overrides: { day: { [n]: { 0: { id: "d.secondary", kind: "pin" } } }, week: {} } }),
      "Europe/Amsterdam",
      undefined,
      { period: "day", n },
    );
    const e = v.editor!;
    expect(e.title).toBe("Thu 12 Nov · evening");
    expect(e.span).toBe("Thu 19:00 → Fri 19:00");
    expect(e.changed).toBe(true);
    expect(e.canReset).toBe(true);
    expect(e.slots.map((s) => s.name)).toEqual(["Daily 1", "Daily 2", "Daily 3", "Skirmish", "Duel"]);
    expect(e.slots[0]).toMatchObject({ text: "Raise Cooking, First Aid or Fishing", tag: "pinned" });
    expect(e.slots[0]!.options.some((o) => o.id === "d.secondary")).toBe(false);
    expect(e.slots[0]!.options.find((o) => o.id === prev)?.also).toBe(
      `also ${v.days.find((d) => d.n === n - 1)!.label}`,
    );
    expect(v.days.find((d) => d.n === n)!.changed).toBe(true);
    expect(v.changedText).toBe("1 changed");
  });

  it("a locked day has no editor buttons; a week editor says when it locks", () => {
    const locked = missionPoolView(input(), "UTC", undefined, { period: "day", n: TODAY })!.editor!;
    expect(locked).toMatchObject({ locked: true, canReset: false });
    const week = missionPoolView(input(), "Europe/Amsterdam", undefined, { period: "week", n: 2968 }).editor!;
    expect(week.slots.map((s) => s.name)).toEqual(["Weekly 1", "Weekly 2", "Weekly 3", "Bounty"]);
    expect(week.locks).toBe("Locks Sat 14 19:00");
    // A day before today or this week doesn't open.
    expect(missionPoolView(input(), "UTC", undefined, { period: "week", n: 2967 }).editor).toBeUndefined();
  });

  it("who saw the normal draw, by name", () => {
    const v = missionPoolView(
      input({}, { sawNormal: [{ period: "day", n: TODAY, owners: ["Bob#2002"] }] }),
      "UTC",
      undefined,
      { period: "day", n: TODAY },
    );
    expect(v.editor!.sawNormal).toEqual(["Bob"]);
  });

  it("the Admin page's box", () => {
    expect(missionPoolBox(input())).toEqual({ missions: 218, changed: 0, today: "Mon 9" });
  });
});
