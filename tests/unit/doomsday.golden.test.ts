import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  crossedOut,
  crown,
  dayLabel,
  dayOf,
  dayStart,
  draw,
  drawPool,
  type Combo,
  type DayDraw,
  drawWeek,
  duels,
  duration,
  entryPool,
  EPOCH,
  GOALS,
  goalsForDay,
  goalsForWeek,
  ladder,
  checkSchedule,
  scheduledDraw,
  scheduledWeek,
  pick,
  points,
  pointsFor,
  POOL_VERSION,
  themeOf,
  realmOffset,
  resetsIn,
  SALT,
  scoreKills,
  streak,
  weekOf,
  zoneFor,
} from "@/core/doomsday/rules";

// WEB-58: the addon's golden cases (tests/fixtures/doomsday/README.md), unchanged. The site's copy of the rules must
// give exactly what the addon's Doomsday.lua gives.

/* eslint-disable @typescript-eslint/no-explicit-any */
const golden: any = JSON.parse(
  readFileSync(path.join(__dirname, "..", "fixtures", "doomsday", "doomsday-cases.json"), "utf8"),
);

/** Pool version 6 (CF-118): a Hunt as ids ({ race, class } per hunting faction); before, as tokens. */
function huntOf(h: DayDraw["hunt"], version: number): unknown {
  if (h === undefined || version < 6) return h;
  const ids = (c: Combo | undefined) => (c === undefined ? undefined : { race: c.raceId, class: c.classId });
  return { Horde: ids(h.Horde), Alliance: ids(h.Alliance) };
}

/** A day's draw as the golden case lists it: the Duel and the Hunt only where the case has them. */
function daySet(d: DayDraw, expect: Record<string, unknown>, version = 6): Record<string, unknown> {
  const out: Record<string, unknown> = { dailies: d.dailies, skirmish: d.skirmish };
  if ("duel" in expect) out.duel = d.duel;
  if ("hunt" in expect) out.hunt = huntOf(d.hunt, version);
  return out;
}

/** A list of cases, for it.each. */
const cases = (list: unknown) => list as any[];

describe("Doomsday golden cases", () => {
  it("constants", () => {
    expect(POOL_VERSION).toBe(golden.poolVersion);
    expect(EPOCH).toBe(golden.epoch);
    expect(SALT.hunt).toBe(golden.salts.hunt);
    expect(SALT.skirmish).toBe(golden.salts.skirmish);
    expect(SALT.bounty).toBe(golden.salts.bounty);
    expect(SALT.dailies).toEqual(golden.salts.dailies);
    expect(SALT.weeklies).toEqual(golden.salts.weeklies);
    // The golden pools are what the draw takes: the `check` missions (Off until tested, CF-118) left out.
    for (const slot of ["daily", "weekly", "skirmish", "bounty", "duel"] as const)
      expect(drawPool(slot)).toEqual(golden.pools[slot]);
  });

  // CF-70, CF-79: the catalogue, in pool order, as the addon's Doomsday.GOALS.
  it("catalogue", () => {
    const list = GOALS.map((g) => {
      const out: Record<string, unknown> = { id: g.id, slot: g.slot };
      for (const [key, value] of [
        ["category", g.category],
        ["since", g.since],
        ["points", g.points],
        ["text", g.text],
        ["short", g.short],
        ["retired", g.retired],
        ["needs", g.needs],
        ["can", g.can],
        ["fallback", g.fallback],
        ["canFrom", g.canFrom],
        // Pool version 6 (CF-118): the PvE dailies' theme, and the missions that wait for a test.
        ["theme", themeOf(g.id)],
        ["check", g.check],
        ["siteOnly", g.siteOnly],
      ] as const)
        if (value !== undefined) out[key] = value;
      return out;
    });
    expect(list).toEqual(golden.pools.catalogue);
  });

  it.each(cases(golden.pick))("pick($n, $salt, $count)", (c: any) => {
    expect(pick(c.n, c.salt, c.count)).toBe(c.expect);
  });

  it.each(cases(golden.realmOffset))("realm offset: $note", (c: any) => {
    expect(realmOffset(c.hour, c.minute, c.serverTime)).toBe(c.expect);
  });

  it.each(cases(golden.schedule))("schedule: $note", (c: any) => {
    const s = { offset: c.offset, reset: c.reset };
    const day = dayOf(c.serverTime, s);
    expect({
      day,
      week: weekOf(day),
      dayStart: dayStart(day, s),
      resetsIn: resetsIn(c.serverTime, s),
      label: dayLabel(day),
    }).toEqual(c.expect);
  });

  it.each(cases(golden.duration))("duration $seconds", (c: any) => {
    expect(duration(c.seconds)).toBe(c.expect);
  });

  // CF-77: a case with `pool` is of that pool version; a case without it of pool version 1.
  const poolOf = (c: any): number => c.pool ?? 1;

  it("draws days, weeks, hunts and zones", () => {
    for (const c of golden.draws.days) {
      const d = draw(c.day, poolOf(c));
      expect(daySet(d, c.expect), `day ${c.day} pool ${poolOf(c)}`).toEqual(c.expect);
    }
    for (const c of golden.draws.weeks)
      expect(drawWeek(c.week, poolOf(c)), `week ${c.week} pool ${poolOf(c)}`).toEqual(c.expect);
    for (const c of golden.draws.hunts)
      expect(huntOf(draw(c.day, poolOf(c), true).hunt, poolOf(c)), `hunt ${c.day}`).toEqual(c.expect);
    for (const c of golden.draws.zones) {
      expect(zoneFor(c.n, c.salt, c.level) ?? null, `zone ${c.n} ${c.salt} ${c.level}`).toBe(c.expect);
    }
  });

  it.each(cases(golden.swaps))("swaps: $note", (c: any) => {
    const got =
      c.day !== undefined ? goalsForDay(c.day, c.situation, poolOf(c)) : goalsForWeek(c.week, c.situation, poolOf(c));
    const { zone, ...rest } = c.expect;
    expect({ set: got.set, swapped: got.swapped }).toEqual(rest);
    if (zone !== undefined) expect(got.zone).toBe(zone);
  });

  it.each(cases(golden.kills))("kills: $note", (c: any) => {
    const scored = scoreKills(c.kills, c.schedule, new Set(c.community));
    expect(
      scored.map((s) => ({
        counted: s.counted,
        points: s.points,
        track: s.track,
        day: s.day,
        ...(s.reason !== undefined ? { reason: s.reason } : {}),
      })),
    ).toEqual(c.expect.kills);
    const sum = (track: string) => scored.filter((s) => s.track === track).reduce((a, s) => a + s.points, 0);
    expect(sum("pvp")).toBe(c.expect.pvp);
    expect(sum("bg")).toBe(c.expect.bg);
    expect(scored.filter((s) => s.counted && s.track === "pvp").length).toBe(c.expect.counted);
  });

  it.each(cases(golden.duels))("duels: $note", (c: any) => {
    const got = duels(c.duels, new Map(Object.entries(c.owner)), c.schedule);
    expect(got.points).toEqual(c.expect.points);
    const shown = got.duels.map((d) => {
      const out: Record<string, unknown> = { day: d.day, a: d.a, b: d.b, disputed: d.disputed };
      if (d.winner !== undefined) out.winner = d.winner;
      return out;
    });
    expect(shown).toEqual(c.expect.duels);
  });

  it.each(cases(golden.points))("points $#", (c: any) => {
    expect(points(c.done, c.killPoints, c.duelPoints)).toEqual(c.expect);
  });

  // CF-69: points per goal in the pool version of each day and week.
  it.each(cases(golden.pointsPerGoal))("points per goal: $note", (c: any) => {
    const pool = entryPool(c.entry, c.goalsPool);
    expect(pool).toBe(c.expect.pool);
    expect(points(c.done, 0, 0, pool)).toEqual({ pve: c.expect.pve, pvp: c.expect.pvp });
    for (const id of Object.keys(c.done)) expect(pointsFor(id, pool), id).toBe(c.expect.goals[id]);
  });

  it.each(cases(golden.crown))("crown $#", (c: any) => {
    for (const f of c.friends) expect(crossedOut(f.set, f.done), f.friend).toBe(c.expect.crossedOut[f.friend]);
    expect(crown(c.friends)?.friend).toBe(c.expect.crown);
  });

  it.each(cases(golden.streak))("streak: $note", (c: any) => {
    expect(streak(c.days, c.today, c.best)).toEqual(c.expect);
  });

  it.each(cases(golden.ladder))("ladder: $note", (c: any) => {
    expect(ladder(c.friends, c.previous)).toEqual(c.expect);
  });

  it.each(cases(golden.scheduleCheck))("schedule check: $note", (c: any) => {
    const day = dayOf(c.serverTime, { offset: c.offset, reset: c.reset });
    expect(checkSchedule(c.input, day, weekOf(day)) ?? null).toEqual(c.expect);
  });

  it.each(cases(golden.scheduled.filter((c: any) => c.addonOnly !== true)))("scheduled: $note", (c: any) => {
    if (c.situation !== undefined) {
      const got = goalsForDay(c.day, c.situation, poolOf(c), c.schedule);
      expect({ set: got.set, swapped: got.swapped }).toEqual(c.expect);
    } else if (c.day !== undefined) {
      const d = scheduledDraw(c.day, c.schedule, poolOf(c));
      expect(daySet(d, c.expect, poolOf(c))).toEqual(c.expect);
    } else expect(scheduledWeek(c.week, c.schedule, poolOf(c))).toEqual(c.expect);
  });

  it("skips only the addon's own cases", () => {
    expect(golden.scheduled.filter((c: any) => c.addonOnly === true).length).toBe(1);
    expect(golden.progress.every((c: any) => c.addonOnly === true)).toBe(true);
  });
});
