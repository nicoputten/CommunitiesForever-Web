import { describe, expect, it } from "vitest";
import { fullPlan, type PlanInput } from "@/core/doomsday/missionPool";
import { dayStart, goal, pool } from "@/core/doomsday/rules";
import type { HuntData } from "@/core/views/hunt";
import {
  matches,
  type MissionPoolInput,
  missionPoolBox,
  missionPoolView,
  type PoolData,
  type Theme,
} from "@/core/views/missionPool";

// WEB-79: the Mission pool page's view on WEB-78's plan; v2 (WEB-109, board `mission-pool-v2-overview`): the recipe
// bar, the quarry, 6-line days, the pool as themes. Day 20766 is Mon 9 Nov 2026; the realm is CET, reset 19:00.

const S = { offset: 3600, reset: 68400 };
const TODAY = 20766;
const NOW = dayStart(TODAY, S) + 3600;

/** Made-up pool version 6 data: themes by the draw's category, a Gnome Mage day, a small census. */
const THEME: Record<string, Theme> = { quests: "questing", loot: "loot", social: "social", crafts: "professions" };

export function huntData(over: Partial<HuntData> = {}): HuntData {
  const days = new Map<number, HuntData["days"] extends ReadonlyMap<number, infer V> ? V : never>();
  for (let n = TODAY; n < TODAY + 16; n++)
    days.set(n, { Alliance: { race: 1, class: 2 }, Horde: { race: 2, class: 1 } });
  days.set(TODAY, { Alliance: { race: 7, class: 8 }, Horde: { race: 5, class: 4 } });
  days.set(TODAY + 1, { Alliance: { race: 4, class: 11 } });
  return {
    targets: {
      Alliance: [
        { race: 1, class: 2, count: 435 },
        { race: 7, class: 8, count: 235, lastHunted: TODAY - 7, donePct: 41 },
        { race: 4, class: 11, count: 255 },
        { race: 3, class: 4, count: 20 },
        { race: 95, class: 11, count: 75 },
        { race: 1, class: 1, count: 205, off: true },
      ],
      Horde: [
        { race: 5, class: 4, count: 690 },
        { race: 2, class: 1, count: 625 },
      ],
    },
    newRaces: [95, 96],
    census: {
      from: Date.UTC(2026, 10, 4, 23) / 1000,
      to: Date.UTC(2026, 10, 10, 15) / 1000,
      characters: 16400,
      installs: 13,
    },
    days,
    donePct: 9,
    points: 5,
    ...over,
  };
}

export function poolData(over: Partial<PoolData> = {}): PoolData {
  return {
    themeOf: (id) => (goal(id)?.slot === "daily" ? (THEME[goal(id)?.category ?? ""] ?? "combat") : undefined),
    duel: [],
    isNew: () => false,
    check: () => undefined,
    duels: new Map(),
    hunt: huntData(),
    ...over,
  };
}

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
    data: poolData(),
    ...extra,
  };
}

describe("the Mission pool page", () => {
  it("the recipe bar: per slot its pool and how often a mission comes back; Bounty within 6 weeks is orange", () => {
    const v = missionPoolView(input({ settings: { "d.quests10": { off: true, often: "normal" } } }), "UTC");
    expect(v.recipe).toEqual({ day: "3 PvE + the Hunt + 2 PvP", week: "3 Weekly + a Bounty" });
    expect(v.tiles).toEqual([
      {
        label: "Daily PvE",
        count: "3",
        per: "a day",
        line: "107 in pool · back every ~36 d",
        warn: false,
        hunt: false,
      },
      { label: "The Hunt", count: "1", per: "a day", line: "4 targets · weighted", warn: false, hunt: true },
      { label: "Daily PvP", count: "2", per: "a day", line: "6 in pool · every ~3 d", warn: false, hunt: false },
      { label: "Weekly", count: "3", per: "a week", line: "49 in pool · every ~16 wk", warn: false, hunt: false },
      { label: "Bounty", count: "1", per: "a week", line: "6 in pool · every 6 wk", warn: true, hunt: false },
      { label: "Off", count: "1", per: "", line: "switched off", warn: false, hunt: false },
    ]);
  });

  it("the Duel slot's missions count in Daily PvP", () => {
    const v = missionPoolView(input({}, { data: poolData({ duel: ["p.duelWin", "p.duels3"] }) }), "UTC");
    expect(v.tiles[2]!.line).toBe(
      `${new Set([...pool("skirmish"), "p.duelWin", "p.duels3"]).size} in pool · every ~4 d`,
    );
  });

  it("14 days from today with today and tomorrow locked; a day's 6 lines: 3 PvE, the Hunt, the PvP slots", () => {
    const v = missionPoolView(
      input({}, { data: poolData({ duels: new Map([[TODAY, "d.quests10"]]) }) }),
      "Europe/Amsterdam",
    );
    expect(v.days).toHaveLength(14);
    expect(v.days[0]).toMatchObject({ label: "Mon 9", note: "today", locked: true, hunt: "Gnome Mage" });
    expect(v.days[1]).toMatchObject({ label: "Tue 10", note: "tomorrow", locked: true, hunt: "Night Elf Druid" });
    expect(v.days[2]).toMatchObject({ label: "Wed 11", locked: false, hunt: "Human Paladin" });
    expect(v.days[0]!.pve).toHaveLength(3);
    // The Skirmish from the plan, then the Duel slot's mission.
    expect(v.days[0]!.pvp).toHaveLength(2);
    expect(v.days[0]!.pvp[1]).toBe("10 quests");
    expect(v.days[3]!.pvp).toHaveLength(1);
    expect(v.weeks.map((w) => w.title)).toEqual(["Week 47 · from Sun 15 19:00", "Week 48 · from Sun 22 19:00"]);
    expect(v.since).toBe("since launch · 5 days");
    expect(v.offFrom).toBe("Won’t come up from Wed 11.");
  });

  it("today's quarry: the Horde's target with census and done, the Alliance's, the next 7 days", () => {
    const q = missionPoolView(input(), "UTC").quarry;
    expect(q).toMatchObject({
      kicker: "Today’s quarry · Mon 9",
      hunter: "Horde hunts",
      points: "+5",
      done: "9%",
      seen: "235",
      target: { short: "Gn", name: "Gnome Mage", classFile: "MAGE", raceName: "Gnome", className: "Mage" },
      other: { hunter: "Alliance hunts", target: { short: "Ud", name: "Undead Rogue" } },
    });
    expect(q.next.map((d) => `${d.weekday} ${d.short} ${d.className}`)).toEqual([
      "Tue NE Druid",
      "Wed Hu Paladin",
      "Thu Hu Paladin",
      "Fri Hu Paladin",
      "Sat Hu Paladin",
      "Sun Hu Paladin",
      "Mon Hu Paladin",
    ]);
  });

  it("no Hunt drawn: no target, no Hunt line", () => {
    const v = missionPoolView(
      input({}, { data: poolData({ hunt: huntData({ days: new Map(), donePct: undefined }) }) }),
      "UTC",
    );
    expect(v.quarry.target).toBeUndefined();
    expect(v.quarry.done).toBeUndefined();
    expect(v.quarry.next).toEqual([]);
    expect(v.days[0]!.hunt).toBeUndefined();
  });

  it("nine cards: six PvE themes, Skirmish with the Duel slot and its new missions, Weekly, Bounty", () => {
    const stats = new Map([
      ["d.quests10", { cameUp: 2, swapped: 0, had: 4, done: 3, last: TODAY - 6 }],
      ["d.quests20", { cameUp: 1, swapped: 1, had: 2, done: 0, last: TODAY - 9 }],
    ]);
    const v = missionPoolView(
      input({}, { stats, data: poolData({ duel: ["p.duelWin"], isNew: (id) => id === "p.duelWin" }) }),
      "UTC",
    );
    expect(v.cards.map((c) => `${c.name} · ${c.tag}`)).toEqual([
      "Questing · Daily PvE",
      "Loot & gold · Daily PvE",
      "Social · Daily PvE",
      "Professions · Daily PvE",
      "Exploration · Daily PvE",
      "Combat & character · Daily PvE",
      "Skirmish · PvP",
      "Weekly · Weekly",
      "Bounty · PvP",
    ]);
    const questing = v.cards[0]!;
    expect(questing.history).toBe("3 came up · 50% done");
    expect(questing.rows[0]).toMatchObject({
      text: "Finish 10 quests",
      short: "10 quests",
      points: "+3",
      history: "came up 2× · 75% · Tue",
      line: "+3 · came up 2× · 75% · Tue",
      donePct: 75,
    });
    expect(questing.rows.find((r) => r.id === "d.zone5")!.history).toBe("—");
    expect(v.cards[4]!.history).toBe("0 came up");
    const skirmish = v.cards[6]!;
    expect(skirmish.fresh).toBe("1 new");
    expect(skirmish.count).toBe(new Set([...pool("skirmish"), "p.duelWin"]).size);
    expect(skirmish.rows.at(-1)!.text).toBe("Win a duel");
    // Every daily PvE mission is on one card.
    expect(v.cards.slice(0, 6).reduce((a, c) => a + c.count, 0)).toBe(108);
  });

  it("the new PvP missions carry their easy or check tag", () => {
    const v = missionPoolView(
      input({}, { data: poolData({ check: (id) => (id.startsWith("p.") ? id === "p.loneWolf" : undefined) }) }),
      "UTC",
    );
    const tags = v.cards[6]!.rows.map((r) => r.tag);
    expect(tags).toContain("easy");
    expect(v.cards[6]!.rows.find((r) => r.id === "p.loneWolf")!.tag).toBe("check");
    expect(v.cards[0]!.rows[0]!.tag).toBeUndefined();
  });

  it("filters: never came up, hard (under 30 % done), off; their counts", () => {
    const stats = new Map([
      ["d.quests10", { cameUp: 2, swapped: 0, had: 4, done: 3, last: TODAY - 1 }],
      ["d.quests20", { cameUp: 1, swapped: 1, had: 5, done: 1, last: TODAY - 2 }],
    ]);
    const v = missionPoolView(input({ settings: { "d.zone5": { off: true, often: "normal" } } }, { stats }), "UTC");
    expect(v.filters).toEqual([
      { filter: "all", label: "All", count: 169 },
      { filter: "never", label: "Never came up", count: 167 },
      { filter: "hard", label: "Hard", count: 1 },
      { filter: "off", label: "Off", count: 1 },
    ]);
    const rows = v.cards.flatMap((c) => c.rows);
    expect(rows.filter((r) => matches(r, "hard")).map((r) => r.id)).toEqual(["d.quests20"]);
    expect(rows.find((r) => r.id === "d.zone5")).toMatchObject({ off: true });
  });

  it("weeks: last as the week number", () => {
    const stats = new Map([["w.days3", { cameUp: 3, swapped: 0, had: 4, done: 2, last: 2966 }]]);
    const v = missionPoolView(input({}, { stats }), "UTC");
    expect(v.cards[7]!.rows.find((r) => r.id === "w.days3")!.history).toBe("came up 3× · 50% · wk 45");
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
    expect(e.slots.map((s) => s.name)).toEqual(["Daily 1", "Daily 2", "Daily 3", "Skirmish"]);
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

  it("the Admin page's box: the 169 missions of the four kinds", () => {
    expect(missionPoolBox(input())).toEqual({ missions: 169, changed: 0, today: "Mon 9" });
    expect(missionPoolView(input(), "UTC").missionCount).toBe(169);
  });
});
