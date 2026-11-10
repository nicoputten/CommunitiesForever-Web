import { describe, expect, it } from "vitest";
import { fullPlan, type PlanInput } from "@/core/doomsday/missionPool";
import { dayStart, pool } from "@/core/doomsday/rules";
import {
  matches,
  type MissionPoolInput,
  missionPoolBox,
  missionPoolView,
  type PoolData,
} from "@/core/views/missionPool";
import type { ThemeCardView } from "@/core/views/pool6";
import { target, targetsView } from "./pool6Fixture";

// WEB-79: the Mission pool page's view on WEB-78's plan; v2 (WEB-109, board `mission-pool-v2-overview`): the recipe
// bar, the quarry, 6-line days, the pool as themes, from WEB-108's pool 6 view models. Day 20766 is Mon 9 Nov 2026;
// the realm is CET, reset 19:00.

const S = { offset: 3600, reset: 68400 };
const TODAY = 20766;
const NOW = dayStart(TODAY, S) + 3600;

const card = (
  id: ThemeCardView["id"],
  label: string,
  kind: ThemeCardView["kind"],
  missions: string[],
  over: Partial<ThemeCardView> = {},
): ThemeCardView => ({
  id,
  label,
  kind,
  count: missions.length,
  off: 0,
  cameUp: 0,
  fresh: 0,
  missions,
  ...over,
});

/** Made-up pool version 6 view models: two themes, Skirmish with the Duel pool, Weekly, Bounty; a Gnome Mage day. */
export function poolData(over: Partial<PoolData> = {}): PoolData {
  const daily = pool("daily");
  return {
    recipe: [
      { id: "pve", label: "Daily PvE", perPeriod: 3, period: "day", pool: 108, backEveryDays: 36, soon: false },
      { id: "hunt", label: "The Hunt", perPeriod: 1, period: "day", pool: 25, backEveryDays: 25, soon: false },
      { id: "pvp", label: "Daily PvP", perPeriod: 2, period: "day", pool: 56, backEveryDays: 28, soon: false },
      { id: "weekly", label: "Weekly", perPeriod: 3, period: "week", pool: 49, backEveryDays: 114.33, soon: false },
      { id: "bounty", label: "Bounty", perPeriod: 1, period: "week", pool: 6, backEveryDays: 42, soon: true },
      { id: "off", label: "Off", perPeriod: 0, period: "day", pool: 1, soon: false },
    ],
    days: [
      {
        n: TODAY,
        pve: ["d.quests10", "d.quests20", "d.zone5"],
        skirmish: "p.loneWolf",
        duel: "p.duelWin",
        hunt: {
          n: TODAY,
          targets: { Alliance: target("Alliance", 7, 8), Horde: target("Horde", 5, 4) },
          pinned: {},
          locked: true,
        },
        locked: true,
        changed: false,
      },
      {
        n: TODAY + 1,
        pve: ["d.zone5"],
        hunt: { n: TODAY + 1, targets: { Alliance: target("Alliance", 4, 11) }, pinned: {}, locked: true },
        locked: true,
        changed: false,
      },
    ],
    quarry: { Alliance: { n: TODAY, target: target("Alliance", 7, 8), points: 5, seen: 235, doneToday: 0.09 } },
    cards: [
      card("questing", "Questing", "Daily PvE", daily.slice(0, 4), { cameUp: 64, donePct: 0.71 }),
      card("loot", "Loot & gold", "Daily PvE", daily.slice(4)),
      card("skirmish", "Skirmish", "PvP", pool("skirmish"), { cameUp: 16, donePct: 0.31, fresh: 49 }),
      card("duel", "Duel", "PvP", ["p.duelWin", "p.duels3"], { cameUp: 2, fresh: 1 }),
      card("weekly", "Weekly", "Weekly", pool("weekly")),
      card("bounty", "Bounty", "PvP", pool("bounty")),
    ],
    targets: targetsView(),
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
  it("the recipe bar from WEB-108's tiles: per slot its pool and how often a mission comes back", () => {
    const v = missionPoolView(input(), "UTC");
    expect(v.recipe).toEqual({ day: "3 PvE + the Hunt + 2 PvP", week: "3 Weekly + a Bounty" });
    expect(v.tiles).toEqual([
      {
        label: "Daily PvE",
        count: "3",
        per: "a day",
        line: "108 in pool · back every ~36 d",
        warn: false,
        hunt: false,
      },
      { label: "The Hunt", count: "1", per: "a day", line: "25 targets · weighted", warn: false, hunt: true },
      { label: "Daily PvP", count: "2", per: "a day", line: "56 in pool · every ~28 d", warn: false, hunt: false },
      { label: "Weekly", count: "3", per: "a week", line: "49 in pool · every ~16 wk", warn: false, hunt: false },
      { label: "Bounty", count: "1", per: "a week", line: "6 in pool · every 6 wk", warn: true, hunt: false },
      { label: "Off", count: "1", per: "", line: "switched off", warn: false, hunt: false },
    ]);
  });

  it("14 days from today with today and tomorrow locked; a day's lines: 3 PvE, the Hunt, Skirmish and Duel", () => {
    const v = missionPoolView(input(), "Europe/Amsterdam");
    expect(v.days).toHaveLength(14);
    expect(v.days[0]).toMatchObject({
      label: "Mon 9",
      note: "today",
      locked: true,
      pve: ["10 quests", "20 quests", "5 in zone"],
      hunt: "Gnome Mage",
      pvp: ["Lone wolf", "Duel win"],
    });
    expect(v.days[1]).toMatchObject({ label: "Tue 10", note: "tomorrow", locked: true, hunt: "Night Elf Druid" });
    // A day WEB-108 doesn't have: the plan's slots, no Hunt line.
    expect(v.days[2]).toMatchObject({ label: "Wed 11", locked: false });
    expect(v.days[2]!.hunt).toBeUndefined();
    expect(v.days[2]!.pve).toHaveLength(3);
    // The plan's Skirmish and Duel slots (pool version 6, WEB-108).
    expect(v.days[2]!.pvp).toHaveLength(2);
    expect(v.weeks.map((w) => w.title)).toEqual(["Week 47 · from Sun 15 19:00", "Week 48 · from Sun 22 19:00"]);
    expect(v.since).toBe("since launch · 5 days");
    expect(v.offFrom).toBe("Won’t come up from Wed 11.");
  });

  it("today's quarry: the Horde's target with census and done; no other faction's without its quarry", () => {
    const q = missionPoolView(input(), "UTC").quarry;
    expect(q).toMatchObject({
      kicker: "Today’s quarry · Mon 9",
      hunter: "Horde hunts",
      points: "+5",
      done: "9%",
      seen: "235",
      target: { raceShort: "Gn", name: "Gnome Mage" },
    });
    expect(q.other).toBeUndefined();
    expect(q.next.map((d) => d.name)).toEqual(["Night Elf Druid"]);
  });

  it("WEB-112: an Alliance-only group sees the Alliance's quarry and the days' Horde targets", () => {
    const quarry = { Horde: { n: TODAY, target: target("Horde", 5, 4), points: 5 } };
    const v = missionPoolView(input({}, { data: poolData({ quarry, hunters: ["Alliance"] }) }), "UTC");
    expect(v.quarry).toMatchObject({ hunter: "Alliance hunts", target: { name: "Undead Rogue" } });
    expect(v.quarry.other).toBeUndefined();
    expect(v.days[0]!.hunt).toBe("Undead Rogue");
    expect(missionPoolView(input(), "UTC").days[0]!.hunt).toBe("Gnome Mage");
  });

  it("the cards: WEB-108's themes, the Duel pool under Skirmish with its history and new missions", () => {
    const stats = new Map([
      ["d.quests10", { cameUp: 2, swapped: 0, had: 4, done: 3, last: TODAY - 6 }],
      ["d.quests20", { cameUp: 1, swapped: 1, had: 2, done: 0, last: TODAY - 9 }],
    ]);
    const v = missionPoolView(input({}, { stats }), "UTC");
    expect(v.cards.map((c) => `${c.name} · ${c.tag} · ${c.history}${c.fresh ? ` · ${c.fresh}` : ""}`)).toEqual([
      "Questing · Daily PvE · 64 came up · 71% done",
      "Loot & gold · Daily PvE · 0 came up",
      "Skirmish · PvP · 18 came up · 31% done · 50 new",
      "Weekly · Weekly · 0 came up",
      "Bounty · PvP · 0 came up",
    ]);
    expect(v.cards[0]!.rows[0]).toMatchObject({
      text: "Finish 10 quests",
      short: "10 quests",
      points: "+3",
      history: "came up 2× · 75% · Tue",
      line: "+3 · came up 2× · 75% · Tue",
      donePct: 75,
    });
    expect(v.cards[0]!.rows.find((r) => r.id === "d.zone5")!.history).toBe("—");
    const skirmish = v.cards[2]!;
    expect(skirmish.count).toBe(new Set([...pool("skirmish"), "p.duelWin", "p.duels3"]).size);
    expect(skirmish.rows.map((r) => r.text)).toContain("Win a duel");
  });

  it("the new PvP missions carry their easy or check tag", () => {
    const v = missionPoolView(
      input({}, { data: poolData({ check: (id) => (id.startsWith("p.") ? id === "p.loneWolf" : undefined) }) }),
      "UTC",
    );
    const rows = v.cards[2]!.rows;
    expect(rows.find((r) => r.id === "p.loneWolf")!.tag).toBe("check");
    expect(rows.find((r) => r.id === "p.duelWin")!.tag).toBe("easy");
    expect(v.cards[0]!.rows[0]!.tag).toBeUndefined();
  });

  it("filters: never came up, hard (under 30 % done), off; their counts over every card", () => {
    const stats = new Map([
      ["d.quests10", { cameUp: 2, swapped: 0, had: 4, done: 3, last: TODAY - 1 }],
      ["d.quests20", { cameUp: 1, swapped: 1, had: 5, done: 1, last: TODAY - 2 }],
    ]);
    const v = missionPoolView(input({ settings: { "d.zone5": { off: true, often: "normal" } } }, { stats }), "UTC");
    const all = v.filters[0]!.count;
    expect(v.filters).toEqual([
      { filter: "all", label: "All", count: all },
      { filter: "never", label: "Never came up", count: all - 2 },
      { filter: "hard", label: "Hard", count: 1 },
      // d.zone5 and the 9 "check" missions, Off until tested (WEB-108).
      { filter: "off", label: "Off", count: 10 },
    ]);
    const rows = v.cards.flatMap((c) => c.rows);
    expect(rows.filter((r) => matches(r, "hard")).map((r) => r.id)).toEqual(["d.quests20"]);
  });

  it("weeks: last as the week number", () => {
    const stats = new Map([["w.days3", { cameUp: 3, swapped: 0, had: 4, done: 2, last: 2966 }]]);
    const v = missionPoolView(input({}, { stats }), "UTC");
    expect(v.cards[3]!.rows.find((r) => r.id === "w.days3")!.history).toBe("came up 3× · 50% · wk 45");
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

  it("the Admin page's box: the 217 missions of pool version 6", () => {
    expect(missionPoolBox(input())).toEqual({ missions: 217, changed: 0, today: "Mon 9" });
    // The page counts its cards' missions (the fixture's cards).
    expect(missionPoolView(input(), "UTC").missionCount).toBe(
      new Set(poolData().cards.flatMap((c) => c.missions)).size,
    );
  });
});
