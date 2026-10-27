import { describe, expect, it } from "vitest";
import {
  giveAnswer,
  group,
  mayDelete,
  mayEdit,
  openSlots,
  phase,
  planRun,
  slotRole,
  type AnswerOutcome,
  type RunAnswer,
} from "@/core/runs";
import {
  dayLabel,
  localDate,
  localTime,
  nextDays,
  offsetSeconds,
  runWhen,
  untilStart,
  weekEnd,
  zonedToUtc,
} from "@/core/runTime";

// WEB-40: slots from roles, who may answer what, moving up from Maybe, rights, and time zones around daylight saving.

const AMS = "Europe/Amsterdam";
const LON = "Europe/London";
const NY = "America/New_York";
/** Tue 27 Oct 2026, 17:00 in Amsterdam (16:00 UTC). */
const NOW = Date.UTC(2026, 9, 27, 16, 0) / 1000;
const HOUR = 3600;

const run = { dungeonId: "sm-armory", startsAt: NOW + 3 * HOUR, organiser: "Nico#2201", range: { min: 32, max: 42 } };
const levels: Record<string, number> = { VES: 39, LIA: 37, BOB: 41, TOK: 33, RUK: 27, GROM: 34, KEL: 35, MIRA: 40 };
const levelOf = (guid: string) => levels[guid];

let clock = NOW;
function answer(
  answers: RunAnswer[],
  battleTag: string,
  a: "in" | "maybe" | "cant",
  guid?: string,
  role?: "tank" | "heal" | "dps",
) {
  clock += 60;
  const result = giveAnswer(
    run,
    answers,
    {
      battleTag,
      answer: a,
      source: "website",
      ...(guid === undefined ? {} : { character: { guid, level: levels[guid], ...(role ? { role } : {}) } }),
    },
    clock,
    levelOf,
  );
  if (typeof result === "string") throw new Error(result);
  return result;
}
const slots = (answers: RunAnswer[]) => {
  const g = group(answers);
  return { tank: g.tank.map((a) => a.guid), healer: g.healer.map((a) => a.guid), damage: g.damage.map((a) => a.guid) };
};

describe("slots and answers", () => {
  it("fills slots from the role the addon knows; unknown role is damage", () => {
    expect([slotRole("tank"), slotRole("heal"), slotRole("dps"), slotRole(undefined)]).toEqual([
      "tank",
      "healer",
      "damage",
      "damage",
    ]);
    let a: RunAnswer[] = [];
    a = answer(a, "Nico#2201", "in", "VES", "dps").answers;
    a = answer(a, "Femke#3307", "in", "LIA", "heal").answers;
    a = answer(a, "Bob#2002", "in", "BOB").answers;
    expect(slots(a)).toEqual({ tank: [], healer: ["LIA"], damage: ["VES", "BOB"] });
    expect(openSlots(a)).toEqual({ tank: 1, healer: 0, damage: 1 });
    expect(phase(run, a, NOW)).toBe("open");
  });

  it("refuses I'm in without a character or out of range; Maybe and Can't always go", () => {
    const tryAnswer = (input: Parameters<typeof giveAnswer>[2], at = NOW) => giveAnswer(run, [], input, at, levelOf);
    expect(tryAnswer({ battleTag: "Jorrit#4410", answer: "in", source: "website" })).toBe("no_character");
    expect(
      tryAnswer({ battleTag: "Jorrit#4410", answer: "in", source: "discord", character: { guid: "RUK", level: 27 } }),
    ).toBe("out_of_range");
    const maybe = tryAnswer({
      battleTag: "Jorrit#4410",
      answer: "maybe",
      source: "website",
      character: { guid: "RUK", level: 27 },
    });
    expect((maybe as AnswerOutcome).stored).toMatchObject({ answer: "maybe", guid: "RUK" });
    expect(tryAnswer({ battleTag: "Jorrit#4410", answer: "cant", source: "website" }, run.startsAt)).toBe("closed");
  });

  it("replaces a friend's earlier answer (BattleTags compared without case)", () => {
    let a: RunAnswer[] = [];
    a = answer(a, "Bob#2002", "maybe", "BOB").answers;
    a = answer(a, "bob#2002", "in", "TOK", "heal").answers;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ guid: "TOK", answer: "in", role: "healer" });
  });

  it("I'm in on a full role is kept as Maybe, first in line, and moves up when the run is full and someone drops", () => {
    let a: RunAnswer[] = [];
    a = answer(a, "Nico#2201", "in", "VES").answers;
    a = answer(a, "Bob#2002", "in", "BOB").answers;
    a = answer(a, "Mira#1188", "in", "MIRA").answers;
    a = answer(a, "Kai#5005", "maybe", "KEL").answers; // an earlier plain Maybe, damage
    const late = answer(a, "Femke#3307", "in", "LIA"); // a 4th damage
    expect(late.stored).toMatchObject({ answer: "maybe", waitlisted: true });
    a = late.answers;
    expect(slots(a).damage).toEqual(["VES", "BOB", "MIRA"]);

    // Bob drops: the first Maybe for damage in answer order (Kai) moves up.
    const drop = answer(a, "Bob#2002", "cant", "BOB");
    expect(drop.movedUp).toMatchObject({ battleTag: "Kai#5005", answer: "in", movedUp: true });
    expect(slots(drop.answers).damage).toEqual(["VES", "MIRA", "KEL"]);
  });

  it("a Maybe out of range is skipped; a role that wasn't full pulls nobody in", () => {
    let a: RunAnswer[] = [];
    a = answer(a, "Nico#2201", "in", "VES").answers;
    a = answer(a, "Bob#2002", "in", "BOB").answers;
    a = answer(a, "Jorrit#4410", "maybe", "RUK").answers; // 27: below 32
    a = answer(a, "Kai#5005", "maybe", "KEL").answers;
    // Damage has 2 of 3: Bob leaving pulls nobody in.
    expect(answer(a, "Bob#2002", "cant").movedUp).toBeUndefined();
    a = answer(a, "Mira#1188", "in", "MIRA").answers; // now full
    const drop = answer(a, "Mira#1188", "maybe", "MIRA");
    expect(drop.movedUp?.battleTag).toBe("Kai#5005");
  });

  it("is full when all five slots are taken, started at start, past 2 hours after", () => {
    let a: RunAnswer[] = [];
    a = answer(a, "A#1", "in", "GROM", "tank").answers;
    a = answer(a, "B#1", "in", "LIA", "heal").answers;
    for (const [tag, guid] of [
      ["C#1", "VES"],
      ["D#1", "BOB"],
      ["E#1", "TOK"],
    ] as const)
      a = answer(a, tag, "in", guid).answers;
    expect(phase(run, a, NOW)).toBe("full");
    expect(phase(run, a, run.startsAt)).toBe("started");
    expect(phase(run, a, run.startsAt + 2 * HOUR)).toBe("past");
    expect(phase({ ...run, cancelledAt: NOW }, a, NOW)).toBe("cancelled");
  });
});

describe("planning and rights", () => {
  const lead = { guid: "VES", level: 39, role: "dps" as const, owner: "Nico#2201" };
  const plan = { dungeonId: "sm-armory", startsAt: NOW + HOUR, organiser: "Nico#2201", source: "website" as const };

  it("the organiser's lead character takes its slot; without one they organise without a slot", () => {
    expect(planRun({ ...plan, lead }, NOW)).toEqual({
      answers: [
        { battleTag: "Nico#2201", guid: "VES", answer: "in", role: "damage", source: "website", answeredAt: NOW },
      ],
    });
    expect(planRun(plan, NOW)).toEqual({ answers: [] });
  });

  it("refuses what can't be planned", () => {
    expect(planRun({ ...plan, dungeonId: "sm" }, NOW)).toBe("unknown_dungeon");
    expect(planRun({ ...plan, startsAt: NOW }, NOW)).toBe("time_passed");
    expect(planRun({ ...plan, note: "x".repeat(201) }, NOW)).toBe("note_too_long");
    expect(planRun({ ...plan, lead: { ...lead, owner: "Bob#2002" } }, NOW)).toBe("lead_not_yours");
    expect(planRun({ ...plan, lead: { ...lead, level: 24 } }, NOW)).toBe("lead_out_of_range");
  });

  it("only the organiser edits; the organiser and the admin delete", () => {
    expect([mayEdit(run, "nico#2201"), mayEdit(run, "Bob#2002")]).toEqual([true, false]);
    expect([
      mayDelete(run, "Bob#2002", false),
      mayDelete(run, "Bob#2002", true),
      mayDelete(run, "Nico#2201", false),
    ]).toEqual([false, true, true]);
  });
});

describe("run times", () => {
  it("shows a UTC moment in each viewer's zone", () => {
    const start = NOW + 3.5 * HOUR; // 19:30 UTC
    expect(runWhen(start, AMS, NOW)).toBe("Today 20:30");
    expect(runWhen(start, LON, NOW)).toBe("Today 19:30");
    expect(runWhen(start, NY, NOW)).toBe("Today 15:30");
    expect(runWhen(NOW + 2 * 24 * HOUR, AMS, NOW)).toBe("Thu 29 Oct 17:00");
    expect(dayLabel(NOW + 24 * HOUR, AMS, NOW)).toBe("Tomorrow");
    expect([untilStart(NOW + 3 * HOUR, NOW), untilStart(NOW + 25 * 60, NOW), untilStart(NOW - 20 * 60, NOW)]).toEqual([
      "in 3 hours",
      "in 25 min",
      "started 20 min ago",
    ]);
  });

  it("turns a typed day and time into UTC, across daylight saving", () => {
    // Amsterdam: CEST (+2) until Sun 25 Oct 2026 03:00, then CET (+1).
    expect(zonedToUtc("2026-10-24", "20:30", AMS)).toBe(Date.UTC(2026, 9, 24, 18, 30) / 1000);
    expect(zonedToUtc("2026-10-26", "20:30", AMS)).toBe(Date.UTC(2026, 9, 26, 19, 30) / 1000);
    expect(offsetSeconds(AMS, Date.UTC(2026, 9, 24, 12) / 1000)).toBe(7200);
    expect(offsetSeconds(AMS, Date.UTC(2026, 9, 26, 12) / 1000)).toBe(3600);
    // Spring forward (Sun 29 Mar 2026, 02:00 → 03:00): 02:30 doesn't exist there.
    expect(zonedToUtc("2026-03-29", "02:30", AMS)).toBeUndefined();
    expect(zonedToUtc("2026-03-29", "03:30", AMS)).toBe(Date.UTC(2026, 2, 29, 1, 30) / 1000);
    // Fall back: 02:30 happens twice; the first one.
    expect(zonedToUtc("2026-10-25", "02:30", AMS)).toBe(Date.UTC(2026, 9, 25, 0, 30) / 1000);
    // Round trip, and the other zones' clocks for the same moment.
    const t = zonedToUtc("2026-11-04", "20:00", AMS)!;
    expect([localDate(t, AMS), localTime(t, AMS), localTime(t, LON), localTime(t, NY)]).toEqual([
      "2026-11-04",
      "20:00",
      "19:00",
      "14:00",
    ]);
    for (const bad of [
      ["2026-13-01", "20:00"],
      ["2026-10-27", "24:00"],
      ["27-10-2026", "20:00"],
    ] as const) {
      expect(zonedToUtc(bad[0], bad[1], AMS)).toBeUndefined();
    }
  });

  it("this week ends at the next Monday 00:00 in the zone; the next seven days for the day chips", () => {
    expect(weekEnd(NOW, AMS)).toBe(Date.UTC(2026, 10, 1, 23, 0) / 1000);
    expect(nextDays(NOW, AMS).map((d) => d.label)).toEqual([
      "Today · Tue 27",
      "Wed 28",
      "Thu 29",
      "Fri 30",
      "Sat 31",
      "Sun 1",
      "Mon 2",
    ]);
    expect(nextDays(NOW, AMS)[5]!.date).toBe("2026-11-01");
  });
});
