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
  drawWeek,
  duels,
  duration,
  EPOCH,
  goalsForDay,
  goalsForWeek,
  ladder,
  pick,
  points,
  pool,
  POOL_VERSION,
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
    for (const slot of ["daily", "weekly", "skirmish", "bounty"] as const)
      expect(pool(slot)).toEqual(golden.pools[slot]);
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

  it("draws days, weeks, hunts and zones", () => {
    for (const c of golden.draws.days) {
      const d = draw(c.day);
      expect({ dailies: d.dailies, skirmish: d.skirmish }, `day ${c.day}`).toEqual(c.expect);
    }
    for (const c of golden.draws.weeks) expect(drawWeek(c.week), `week ${c.week}`).toEqual(c.expect);
    for (const c of golden.draws.hunts) expect(draw(c.day, POOL_VERSION, true).hunt, `hunt ${c.day}`).toEqual(c.expect);
    for (const c of golden.draws.zones) {
      expect(zoneFor(c.n, c.salt, c.level) ?? null, `zone ${c.n} ${c.salt} ${c.level}`).toBe(c.expect);
    }
  });

  it.each(cases(golden.swaps))("swaps: $note", (c: any) => {
    const got = c.day !== undefined ? goalsForDay(c.day, c.situation) : goalsForWeek(c.week, c.situation);
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

  it("skips only the addon's own cases", () => {
    expect(golden.progress.every((c: any) => c.addonOnly === true)).toBe(true);
  });
});
