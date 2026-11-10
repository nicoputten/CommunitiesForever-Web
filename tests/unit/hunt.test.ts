import { describe, expect, it } from "vitest";
import {
  type Census,
  drawTarget,
  entryTarget,
  friendHunt,
  HUNT_FEATS,
  huntFeats,
  huntKills,
  huntTargets,
  huntTargetsView,
  huntToday,
  huntWeek,
  MIN_SEEN,
  mergeCensus,
  parseCensusImport,
  parsePopulation,
  planHunts,
  rareTargets,
  scheduleHuntDays,
  targetOf,
} from "@/core/doomsday/hunt";
import { fullPlan, scheduleOf } from "@/core/doomsday/missionPool";
import {
  checkSchedule,
  dailyKind,
  dayStart,
  draw,
  drawDuel,
  EPOCH,
  goal,
  pool,
  POOL_VERSION,
  scheduledDraw,
} from "@/core/doomsday/rules";
import type { HuntKill } from "@/core/views/pool6";

// WEB-108: pool version 6's catalogue and the site's draw, the census-weighted Hunt, the census, the schedule's new
// fields and the Hunt kills. Day 20766 is Mon 9 Nov 2026; the realm is CET, reset 19:00. Census numbers are made up.

const S = { offset: 3600, reset: 68400 };
const TODAY = 20766;
const NOW = dayStart(TODAY, S) + 3600;
const noOff = new Set<string>();

/** A census where every target of both factions has `n` (or its own count). */
function census(n: number, own: Record<string, number> = {}, characters = 16400): Census {
  const counts: Record<string, number> = {};
  for (const f of ["Alliance", "Horde"] as const) for (const t of huntTargets(f)) counts[t.key] = own[t.key] ?? n;
  for (const [k, v] of Object.entries(own)) if (v < 0) delete counts[k];
  return { asOf: NOW, source: "everloot", characters, installs: 13, counts };
}

describe("pool version 6: the catalogue", () => {
  it("is the current pool version, with themes on every PvE daily", () => {
    expect(POOL_VERSION).toBe(6);
    const themes = new Set(pool("daily").map((id) => dailyKind(id)));
    expect([...themes].sort()).toEqual(["combat", "exploration", "loot", "professions", "questing", "social"]);
    expect(pool("daily").every((id) => dailyKind(id) !== undefined)).toBe(true);
  });

  it("50 new PvP dailies: 41 in the Skirmish, 8 in the Duel slot with the first duel of each friend", () => {
    expect(pool("skirmish")).toHaveLength(6 + 41);
    expect(pool("duel")).toHaveLength(8);
    expect(pool("duel")).toContain("p.duelFriends");
    expect(pool("duel")).toContain("p.duelWin");
    for (const v of [1, 2, 3, 4, 5]) expect(pool("duel", v)).toEqual([]);
    for (const slot of ["daily", "skirmish", "weekly", "bounty"] as const) expect(pool(slot, 5)).not.toContain("p.hk3");
  });

  it("the check missions are in the pool, never in the draw", () => {
    const check = pool("skirmish").filter((id) => goal(id)!.check === true);
    expect(check.sort()).toEqual(
      [
        "p.closeCall",
        "p.guardDown",
        "p.townRaid",
        "p.assist",
        "p.guardian",
        "p.selfDefense",
        "p.narrowEscape",
        "p.outnumbered",
      ].sort(),
    );
    for (let n = EPOCH; n < EPOCH + 300; n++) expect(check).not.toContain(draw(n).skirmish);
  });

  it("the draw: 3 PvE dailies of 3 different themes, the Skirmish, the Duel rotating through its pool", () => {
    for (let n = EPOCH; n < EPOCH + 200; n++) {
      const d = draw(n);
      expect(new Set(d.dailies.map((id) => dailyKind(id))).size, `${n}`).toBe(3);
      expect(d.duel).toBe(drawDuel(n));
    }
    const week = Array.from({ length: 8 }, (_, i) => drawDuel(EPOCH + i));
    expect(new Set(week).size).toBe(8);
    expect(drawDuel(EPOCH + 8)).toBe(drawDuel(EPOCH));
  });
});

describe("Hunt targets", () => {
  it("28 per faction from the game files, the Skyborne included, by race and class ids", () => {
    const alliance = huntTargets("Alliance");
    const horde = huntTargets("Horde");
    expect([alliance.length, horde.length]).toEqual([28, 28]);
    expect(alliance.filter((t) => t.raceId === 95).map((t) => t.className)).toEqual([
      "Warrior",
      "Hunter",
      "Rogue",
      "Mage",
      "Druid",
    ]);
    expect(horde.filter((t) => t.raceId === 96).map((t) => t.className)).toEqual([
      "Warrior",
      "Hunter",
      "Rogue",
      "Shaman",
      "Druid",
    ]);
    expect(targetOf("4:3")?.name).toBe("Night Elf Hunter");
    expect(targetOf("5:2")?.name).toBe("Undead Paladin");
    expect(targetOf("95:11")).toMatchObject({ faction: "Alliance", name: "Skyborne Druid" });
    expect(targetOf("2:2")).toBeUndefined(); // no Orc Paladin
  });
});

describe("the Hunt draw", () => {
  it("weights by the census: a target with 10× the count comes up about 10× as often", () => {
    const c = census(100, { "7:8": 1000 });
    let gnome = 0;
    let human = 0;
    for (let n = 21000; n < 23000; n++) {
      const k = drawTarget("Alliance", n, [], noOff, c);
      if (k === "7:8") gnome++;
      if (k === "1:8") human++;
    }
    expect(gnome / human).toBeGreaterThan(6);
    expect(gnome / human).toBeLessThan(15);
  });

  it("skips a target seen fewer than 30 times, or not counted at all, until its count grows", () => {
    const low = census(200, { "95:8": MIN_SEEN - 1, "1:9": -1 });
    const drawn = new Set(Array.from({ length: 3000 }, (_, i) => drawTarget("Alliance", 21000 + i, [], noOff, low)));
    expect(drawn.has("95:8")).toBe(false);
    expect(drawn.has("1:9")).toBe(false);
    const grown = census(200, { "95:8": MIN_SEEN });
    const again = new Set(Array.from({ length: 3000 }, (_, i) => drawTarget("Alliance", 21000 + i, [], noOff, grown)));
    expect(again.has("95:8")).toBe(true);
  });

  it("never the same target twice within 7 days", () => {
    const plan = planHunts({
      today: TODAY,
      days: Array.from({ length: 60 }, (_, i) => TODAY - 1 + i),
      stored: {},
      pins: {},
      off: noOff,
      census: census(100, { "7:8": 50000 }),
    });
    for (const f of ["Alliance", "Horde"] as const) {
      const keys = plan.map((d) => d.pick[f]!);
      for (let i = 0; i < keys.length; i++) {
        const window = keys.slice(Math.max(0, i - 6), i);
        expect(window, `${f} day ${plan[i]!.n}`).not.toContain(keys[i]);
      }
    }
  });

  it("an owner's off never comes up; a pin wins, also over off and the 7-day rule", () => {
    const off = new Set(
      huntTargets("Alliance")
        .filter((t) => t.raceId === 1)
        .map((t) => t.key),
    );
    const days = Array.from({ length: 18 }, (_, i) => TODAY - 1 + i);
    const plan = planHunts({ today: TODAY, days, stored: {}, pins: {}, off, census: census(100) });
    expect(plan.every((d) => !off.has(d.pick.Alliance!))).toBe(true);
    const pinned = planHunts({
      today: TODAY,
      days,
      stored: {},
      pins: { [TODAY + 3]: { Alliance: "1:8" }, [TODAY + 4]: { Alliance: "1:8" } },
      off,
      census: census(100),
    });
    expect(pinned.find((d) => d.n === TODAY + 3)!).toMatchObject({
      pick: { Alliance: "1:8" },
      pinned: { Alliance: true },
    });
    expect(pinned.find((d) => d.n === TODAY + 4)!.pick.Alliance).toBe("1:8");
    // A pin of the wrong faction is ignored.
    const wrong = planHunts({
      today: TODAY,
      days,
      stored: {},
      pins: { [TODAY + 3]: { Horde: "1:8" } },
      off,
      census: census(100),
    });
    expect(wrong.find((d) => d.n === TODAY + 3)!.pick.Horde).not.toBe("1:8");
  });

  it("today and tomorrow are locked: a new census or a pin doesn't move them; a free day is drawn again", () => {
    const days = Array.from({ length: 18 }, (_, i) => TODAY - 1 + i);
    const first = planHunts({ today: TODAY, days, stored: {}, pins: {}, off: noOff, census: census(100) });
    const stored = Object.fromEntries(first.map((d) => [d.n, d.pick]));
    const changed = census(100, { [first[1]!.pick.Alliance!]: 1, [first[2]!.pick.Alliance!]: 1 });
    const pins = { [TODAY]: { Alliance: "1:8" }, [TODAY + 1]: { Alliance: "1:8" } };
    const later = planHunts({ today: TODAY, days, stored, pins, off: noOff, census: changed }, true);
    for (const n of [TODAY - 1, TODAY, TODAY + 1]) {
      const d = later.find((x) => x.n === n)!;
      expect(d.locked).toBe(true);
      expect(d.pick).toEqual(stored[n]);
    }
    expect(later.find((d) => d.n === TODAY + 2)!.locked).toBe(false);
    // Free days follow the new census: the targets now under 30 are gone from them.
    for (const d of later.filter((x) => !x.locked))
      expect([first[1]!.pick.Alliance, first[2]!.pick.Alliance]).not.toContain(d.pick.Alliance);
    // Without recompute a stored free day stays (the plan never changes by itself).
    const still = planHunts({ today: TODAY, days, stored, pins: {}, off: noOff, census: changed });
    expect(still.map((d) => d.pick)).toEqual(first.map((d) => d.pick));
  });

  it("without a census: every target alike; if everything is off or skipped, the draw still has a quarry", () => {
    const days = Array.from({ length: 18 }, (_, i) => TODAY - 1 + i);
    const none = planHunts({ today: TODAY, days, stored: {}, pins: {}, off: noOff });
    expect(none.every((d) => d.pick.Alliance !== undefined && d.pick.Horde !== undefined)).toBe(true);
    const allOff = new Set(huntTargets("Horde").map((t) => t.key));
    expect(drawTarget("Horde", TODAY, [], allOff, census(100))).toBeDefined();
    expect(drawTarget("Horde", TODAY, [], noOff, census(5))).toBeDefined();
  });

  it("is deterministic for a day and a census", () => {
    expect(drawTarget("Alliance", TODAY + 9, [], noOff, census(80))).toBe(
      drawTarget("Alliance", TODAY + 9, [], noOff, census(80)),
    );
  });
});

/** An Everloot population answer as /api/tools/population returns it (values made up). */
function answer(faction: string, cells: [string, string, number][]) {
  return {
    tool: "population",
    arguments: { faction, class: "Mage", window: "week" },
    answer: {
      connected: true,
      dataAsOf: "2026-11-10T15:00:24.711Z",
      url: "https://everloot.app/census",
      page: {
        window: { id: "week", from: "2026-11-04T23:00:00.000Z", to: "2026-11-10T15:00:24.711Z" },
        characters: 16400,
        installs: 13,
        rule: { minCharacters: 10, minInstalls: 3, minReporters: 3, roundTo: 5 },
        cells: cells.map(([race, cls, count]) => ({ slice: "raceClass", faction, race, class: cls, count, share: 0 })),
      },
    },
  };
}

describe("the census", () => {
  it("reads Everloot's population answer: race and class cells of valid targets, with the window and size", () => {
    const c = parsePopulation(
      answer("Alliance", [
        ["Gnome", "MAGE", 235],
        ["Human", "MAGE", 155],
        ["Skyborne", "MAGE", 35],
        ["Night Elf", "MAGE", 40], // not a valid target: dropped
      ]),
    )!;
    expect(c.counts).toEqual({ "7:8": 235, "1:8": 155, "95:8": 35 });
    expect(c).toMatchObject({ characters: 16400, installs: 13, roundTo: 5, source: "everloot" });
    expect(c.asOf).toBe(Date.parse("2026-11-10T15:00:24.711Z") / 1000 - 0.711);
    expect(c.from).toBe(Date.parse("2026-11-04T23:00:00.000Z") / 1000);
    const horde = parsePopulation(
      answer("Horde", [
        ["Skyborne", "SHAMAN", 60],
        ["Undead", "PALADIN", 90],
      ]),
    )!;
    expect(horde.counts).toEqual({ "96:7": 60, "5:2": 90 });
    expect(mergeCensus([c, horde])!.counts).toEqual({ ...c.counts, ...horde.counts });
  });

  it("drops anything that isn't a count of a valid target; a non-answer is undefined", () => {
    const c = parsePopulation(
      answer("Alliance", [
        ["Gnome", "MAGE", -5],
        ["Gnome", "MAGE", 1.5],
        ["Gnome", "DEATHKNIGHT", 50],
        ["Orc", "WARRIOR", 50],
      ]),
    )!;
    expect(c.counts).toEqual({});
    expect(parsePopulation({ page: {} })).toBeUndefined();
    expect(parsePopulation("census")).toBeUndefined();
  });

  it("the owner's import: Everloot answers, or counts by key or by faction, race and class", () => {
    const fromAnswers = parseCensusImport(JSON.stringify([answer("Alliance", [["Gnome", "MAGE", 235]])]), NOW);
    expect(fromAnswers).toMatchObject({ source: "import", counts: { "7:8": 235 } });
    const byKey = parseCensusImport(JSON.stringify({ characters: 9000, counts: { "4:3": 230, "2:2": 5 } }), NOW);
    expect(byKey).toMatchObject({ source: "import", asOf: NOW, characters: 9000, counts: { "4:3": 230 } });
    const nested = parseCensusImport(
      JSON.stringify({ counts: { Horde: { Troll: { Mage: 270 }, Skyborne: { Druid: 40 } } } }),
      NOW,
    );
    expect(nested).toMatchObject({ counts: { "8:8": 270, "96:11": 40 } });
    expect(parseCensusImport("{", NOW)).toEqual({ error: "That isn't JSON." });
    expect(parseCensusImport(JSON.stringify({ counts: { "2:2": 5 } }), NOW)).toEqual({
      error: "No counts of Hunt targets in that file.",
    });
    expect(parseCensusImport("x".repeat(300_000), NOW)).toEqual({ error: "That file is too big." });
  });

  it("rare targets: under 1% of the census characters", () => {
    expect(rareTargets(census(500, { "95:11": 150, "96:11": 170 }))).toEqual(["95:11"]);
    expect(rareTargets(undefined)).toEqual([]);
  });
});

describe("the schedule from pool version 6", () => {
  const plan = fullPlan(
    {
      settings: {},
      overrides: { day: {}, week: {} },
      stored: { day: {}, week: {} },
      now: NOW,
      s: S,
      today: TODAY,
      week: 2967,
    },
    true,
  );
  const hunts = planHunts({
    today: TODAY,
    days: plan.days.map((d) => d.n),
    stored: {},
    pins: {},
    off: noOff,
    census: census(100, { "95:11": 60 }),
  });

  it("every day from yesterday to 16 ahead, with the Duel, the Hunt by ids, the pool, rare and the census", () => {
    const schedule = scheduleOf(plan, 0, NOW, {
      days: scheduleHuntDays(hunts),
      rare: ["95:11"],
      census: { at: NOW, characters: 16400 },
    })!;
    expect(schedule.v).toBe(NOW);
    expect(Object.keys(schedule.days!)).toHaveLength(18);
    const day = schedule.days![String(TODAY + 5)]!;
    const p = plan.days.find((d) => d.n === TODAY + 5)!.plan;
    const h = hunts.find((d) => d.n === TODAY + 5)!.pick;
    expect(day).toEqual({
      daily: p.slice(0, 3),
      skirmish: p[3],
      duel: p[4],
      hunt: {
        Alliance: { race: targetOf(h.Alliance)!.raceId, class: targetOf(h.Alliance)!.classId },
        Horde: { race: targetOf(h.Horde)!.raceId, class: targetOf(h.Horde)!.classId },
      },
      pool: 6,
    });
    expect(schedule.rare).toEqual(["95:11"]);
    expect(schedule.census).toEqual({ at: NOW, characters: 16400 });
  });

  it("passes the check as the addon reads it (CF-68), and the draw follows it", () => {
    const raw = JSON.parse(
      JSON.stringify(scheduleOf(plan, 0, NOW, { days: scheduleHuntDays(hunts), rare: ["95:11"] })),
    ) as unknown;
    const checked = checkSchedule(raw, TODAY, 2967)!;
    expect(checked.days![String(TODAY + 5)]!.hunt).toBeDefined();
    expect(checked.rare).toEqual(["95:11"]);
    const d = scheduledDraw(TODAY + 5, checked);
    const p = plan.days.find((x) => x.n === TODAY + 5)!.plan;
    expect([...d.dailies, d.skirmish, d.duel]).toEqual(p);
    const h = hunts.find((x) => x.n === TODAY + 5)!.pick;
    // The draw's Hunt is keyed by the hunting faction: Horde hunts the Alliance target.
    expect(d.hunt!.Horde!.raceId).toBe(targetOf(h.Alliance)!.raceId);
    expect(d.hunt!.Alliance!.classId).toBe(targetOf(h.Horde)!.classId);
  });

  it("the check drops a broken Hunt, Duel or pool on its own and keeps the rest", () => {
    const checked = checkSchedule(
      {
        v: NOW,
        days: {
          [String(TODAY + 2)]: {
            skirmish: "p.loneWolf",
            duel: "p.x;y",
            hunt: { Alliance: { race: "4", class: 3 }, Horde: { race: 8, class: 8 } },
            pool: "6",
          },
        },
        rare: ["95:11", "Skyborne:DRUID", 7],
        census: { at: "today" },
      },
      TODAY,
      2967,
    )!;
    expect(checked).toEqual({
      v: NOW,
      days: { [String(TODAY + 2)]: { skirmish: "p.loneWolf", hunt: { Horde: { race: 8, class: 8 } } } },
      rare: ["95:11"],
    });
  });
});

describe("Hunt kills and the pages' data", () => {
  const quarry = { [TODAY]: { Alliance: "4:3", Horde: "8:8" }, [TODAY + 1]: { Alliance: "7:8", Horde: "2:1" } };
  const quarryOf = (day: number) => quarry[day] ?? {};
  const entry = (owner: string, day: number, hunt: object, faction = "Horde") => ({
    owner,
    guid: `G-${owner}`,
    day,
    faction,
    hunt,
  });

  it("reads ids when sent, tokens otherwise; a quarry is that day's target of the hunted faction", () => {
    const kills = huntKills(
      [
        entry("Ada#1001", TODAY, { raceId: 4, classId: 3, at: NOW + 60, zone: "Ashenvale" }),
        entry("Bob#2002", TODAY, { race: "NightElf", class: "HUNTER", at: NOW + 30 }),
        entry("Bob#2002", TODAY, { race: "Gnome", class: "MAGE" }),
        entry("Cy#3003", TODAY, { race: "Troll", class: "MAGE" }, "Alliance"),
        entry("Cy#3003", TODAY, { raceId: 2, classId: 2 }, "Alliance"), // no Orc Paladin
      ],
      quarryOf,
    );
    // Oldest first: by day, then time (a kill without one first), then person.
    expect(kills.map((k) => [k.owner, k.target?.name, k.quarry])).toEqual([
      ["Bob#2002", "Gnome Mage", false],
      ["Cy#3003", "Troll Mage", true],
      ["Cy#3003", undefined, false],
      ["Bob#2002", "Night Elf Hunter", true],
      ["Ada#1001", "Night Elf Hunter", true],
    ]);
    expect(entryTarget(entry("x", TODAY, { race: "Skyborne", class: "DRUID" }))?.key).toBe("95:11");
    expect(entryTarget(entry("x", TODAY, { race: "Skyborne", class: "DRUID" }, "Alliance"))?.key).toBe("96:11");
  });

  it("per friend: today's Hunt, bagged, trophies, the week; The Hunt today; the targets grid", () => {
    const kills = huntKills(
      [
        entry("Ada#1001", TODAY - 1, { raceId: 1, classId: 8 }),
        entry("Ada#1001", TODAY, { raceId: 4, classId: 3, at: NOW + 600, zone: "Ashenvale" }),
        entry("Ada#1001", TODAY, { raceId: 4, classId: 3, at: NOW + 900 }),
      ],
      (d) => (d === TODAY - 1 ? { Alliance: "1:8" } : quarryOf(d)),
    );
    const c = census(200, { "4:3": 40 });
    const ada = friendHunt({ friend: { owner: "Ada#1001", factions: ["Horde"] }, kills, today: TODAY, census: c });
    const bob = friendHunt({ friend: { owner: "Bob#2002", factions: ["Horde"] }, kills, today: TODAY, census: c });
    expect(ada).toMatchObject({
      todayDone: true,
      todayKill: { at: NOW + 600, zone: "Ashenvale" },
      hunts: ["Alliance"],
    });
    expect(ada.bagged.map((k) => k.day)).toEqual([TODAY, TODAY, TODAY - 1]);
    expect(ada.trophies).toMatchObject({ distinct: 2, total: 28, quarries: 3, rarest: { seen: 40 } });
    const hunter = ada.trophies.races.flatMap((r) => r.cells).find((x) => x.key === "4:3")!;
    expect(hunter).toMatchObject({ count: 2, scarce: true, seen: 40, last: TODAY });
    expect(bob.todayDone).toBe(false);
    expect(huntWeek([ada, bob])).toEqual([{ owner: "Ada#1001", days: ada.weekDays }]);
    // A friend whose addon has no hunts[] yet: the goal record's done still counts.
    const cy = friendHunt({
      friend: { owner: "Cy#3003", factions: ["Alliance"] },
      kills,
      today: TODAY,
      doneDays: new Set([TODAY]),
    });
    expect(cy).toMatchObject({ todayDone: true, hunts: ["Horde"] });

    const today = huntToday(TODAY, quarry, [bob, ada, cy], c);
    expect(today).toMatchObject({ bagged: 2, total: 3, tomorrow: { Alliance: { key: "7:8" } } });
    expect(today.friends.map((f) => f.owner)).toEqual(["Ada#1001", "Cy#3003", "Bob#2002"]);
    expect(today.quarry.Alliance).toMatchObject({ target: { key: "4:3" }, points: 5, seen: 40, doneToday: 0.5 });

    const view = huntTargetsView({ today: TODAY, census: c, off: new Set(["1:1"]), days: quarry });
    const cells = view.factions.Alliance.races.flatMap((r) => r.cells);
    expect(view.factions.Alliance).toMatchObject({ hunter: "Horde", total: 28, inDraw: 27 });
    expect(cells.find((x) => x.key === "1:1")!.state).toBe("off");
    expect(cells.find((x) => x.key === "4:3")).toMatchObject({ state: "on", today: true, count: 40 });
    expect(cells.find((x) => x.key === "3:7")!.forever).toBe(true); // Dwarf Shaman
    expect(cells.reduce((a, x) => a + x.drawShare, 0)).toBeCloseTo(1);
    expect(view.census).toMatchObject({
      characters: 16400,
      url: "https://everloot.app/census",
      licence: "CC BY-SA 4.0",
    });
  });

  it("the six Hunt feats with their progress", () => {
    const k = (day: number, key: string, quarry = true): HuntKill => ({
      owner: "Ada#1001",
      guid: "G",
      day,
      at: dayStart(day, S) + 100,
      target: targetOf(key)!,
      quarry,
    });
    const week = Array.from({ length: 7 }, (_, i) => k(TODAY + i, "1:8"));
    const feats = huntFeats([...week, k(TODAY + 9, "95:11", false)], ["Alliance"], new Set(["95:11"]));
    expect(feats.map((f) => f.id)).toEqual(HUNT_FEATS.map((f) => f.id));
    const by = Object.fromEntries(feats.map((f) => [f.id, f]));
    expect(by["f.huntFirst"]).toMatchObject({ done: true, value: 1, target: 1, kill: { day: TODAY } });
    expect(by["f.hunt10"]).toMatchObject({ done: false, value: 7, target: 10 });
    expect(by["f.huntClasses"]).toMatchObject({ done: false, value: 2, target: 9 });
    expect(by["f.huntAll"]).toMatchObject({ done: false, value: 2, target: 28 });
    expect(by["f.huntRare"]).toMatchObject({ done: true, kill: { day: TODAY + 9 } });
    expect(by["f.huntWeek"]).toMatchObject({ done: true, value: 7, kill: { day: TODAY + 6 } });
    expect(huntFeats([], ["Alliance"], new Set()).every((f) => !f.done && f.value === 0)).toBe(true);
  });
});
