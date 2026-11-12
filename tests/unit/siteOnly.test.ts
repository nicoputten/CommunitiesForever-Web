import { describe, expect, it } from "vitest";
import { fullPlan, type PlanInput, scheduleOf, settingOf } from "@/core/doomsday/missionPool";
import {
  checkSchedule,
  dayStart,
  draw,
  drawPool,
  drawWeek,
  EPOCH,
  goal,
  goalsForDay,
  pool,
  scheduledDraw,
  scheduledWeek,
} from "@/core/doomsday/rules";

// WEB-113 (addon CF-121): the site-only missions Bargain (d.auctionBuy), Avenger (p.avenge) and Avenge x3 (b.avenge3).
// The addon tracks them but never draws them nor swaps to them; only the site's schedule switches one on. Day 20766 is
// Mon 9 Nov 2026; the realm is CET, reset 19:00.

const S = { offset: 3600, reset: 68400 };
const TODAY = 20766;
const NOW = dayStart(TODAY, S) + 3600;
const SITE_ONLY = ["d.auctionBuy", "p.avenge", "b.avenge3"];

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    settings: {},
    overrides: { day: {}, week: {} },
    stored: { day: {}, week: {} },
    now: NOW,
    s: S,
    today: TODAY,
    week: 2967,
    ...over,
  };
}

describe("site-only missions (CF-121)", () => {
  it("are in the pool from version 6, never in the draw's pool, and Off until the owner switches them on", () => {
    for (const id of SITE_ONLY) {
      const g = goal(id)!;
      expect(g, id).toMatchObject({ since: 6, siteOnly: true });
      expect(g.check, id).toBeUndefined();
      expect(pool(g.slot), id).toContain(id);
      expect(drawPool(g.slot), id).not.toContain(id);
      expect(settingOf({}, id), id).toEqual({ off: true, often: "normal" });
    }
    expect([goal("d.auctionBuy")!.short, goal("p.avenge")!.short, goal("b.avenge3")!.short]).toEqual([
      "Bargain",
      "Avenger",
      "Avenge x3",
    ]);
  });

  it("the normal draw and a swap never take one", () => {
    for (let n = EPOCH; n < EPOCH + 400; n++) {
      const d = draw(n);
      expect([...d.dailies, d.skirmish]).not.toContain("d.auctionBuy");
      expect(d.skirmish).not.toBe("p.avenge");
      // A friend who can't do anything social: every swap's replacement is a drawable mission.
      const set = goalsForDay(n, { friends: 0, chars: 1, below60: 0 }).set;
      for (const id of SITE_ONLY) expect(set, `${n}`).not.toContain(id);
    }
    for (let w = 2966; w < 2966 + 60; w++) expect(drawWeek(w).bounty).not.toBe("b.avenge3");
  });

  it("the site's plan leaves them out while Off; switched on (Normal), they come up like any other", () => {
    const off = fullPlan(input(), true);
    for (const d of off.days) for (const id of SITE_ONLY) expect(d.plan).not.toContain(id);
    const settings = Object.fromEntries(SITE_ONLY.map((id) => [id, { off: false, often: "normal" as const }]));
    const plan = fullPlan(input({ settings }), true);
    const free = plan.days.filter((d) => !d.locked);
    expect(free.some((d) => d.plan.includes("p.avenge")) || free.some((d) => d.plan.includes("d.auctionBuy"))).toBe(
      true,
    );
    // Locked days keep the normal draw.
    for (const d of plan.days.filter((x) => x.locked)) for (const id of SITE_ONLY) expect(d.plan).not.toContain(id);
  });

  it("a schedule may name them: d.auctionBuy in the dailies, b.avenge3 as the Bounty, p.avenge as the Skirmish", () => {
    const daily = ["d.auctionBuy", "d.quests10", "d.dungeon"];
    const raw = {
      v: NOW,
      days: { [String(TODAY + 2)]: { daily, skirmish: "p.avenge", pool: 6 } },
      weeks: { "2968": { weekly: ["w.days3", "w.cap", "w.fullClear"], bounty: "b.avenge3" } },
    };
    const checked = checkSchedule(raw, TODAY, 2967)!;
    const d = scheduledDraw(TODAY + 2, checked);
    expect(d.dailies).toEqual(daily);
    expect(d.skirmish).toBe("p.avenge");
    expect(scheduledWeek(2968, checked).bounty).toBe("b.avenge3");
  });

  it("switched on, the site's schedule sends them to the addons", () => {
    const settings = Object.fromEntries(SITE_ONLY.map((id) => [id, { off: false, often: "often" as const }]));
    const plan = fullPlan(input({ settings }), true);
    const schedule = scheduleOf(plan, NOW, NOW, { days: {}, rare: [] })!;
    const sent = Object.values(schedule.days!).flatMap((d) => [...(d.daily ?? []), d.skirmish]);
    expect(sent.some((id) => id === "d.auctionBuy" || id === "p.avenge")).toBe(true);
  });
});
