import { describe, expect, it } from "vitest";
import { clockAt, doomsdayDay, gridCount, partOfDay, resetsText } from "@/core/doomsday/rules";

// WEB-66 (Nico's live test of 2026-10-29): the day named by its reset, clock times within the day, the grid's count.

// Wed 2026-11-18 19:00 in Paris (18:00 UTC) to Thu 19:00.
const START = Date.UTC(2026, 10, 18, 18, 0) / 1000;
const END = START + 86400;
const PARIS = "Europe/Paris";

describe("the day by its reset", () => {
  it("names the part of the day by the reset hour", () => {
    expect([5, 11, 12, 16, 17, 22, 23, 0, 4].map(partOfDay)).toEqual([
      "morning",
      "morning",
      "afternoon",
      "afternoon",
      "evening",
      "evening",
      "night",
      "night",
      "night",
    ]);
  });

  it("names the day by its start, with its span, in the zone given", () => {
    expect(doomsdayDay(START, END, PARIS)).toEqual({ name: "Wed evening", span: "Wed 19:00 → Thu 19:00" });
    // The same day in London starts at 18:00: still the evening.
    expect(doomsdayDay(START, END, "Europe/London")).toEqual({ name: "Wed evening", span: "Wed 18:00 → Thu 18:00" });
    // In Bangkok it starts at 01:00 on Thursday.
    expect(doomsdayDay(START, END, "Asia/Bangkok").name).toBe("Thu night");
  });

  it("gives times after midnight their weekday", () => {
    expect(clockAt(START + 4 * 3600 + 13 * 60, START, PARIS)).toBe("23:13");
    expect(clockAt(START + 5 * 3600 + 4 * 60, START, PARIS)).toBe("Thu 00:04");
  });

  it("says when the day resets", () => {
    expect(resetsText(END, END - (6 * 3600 + 51 * 60), PARIS)).toBe("resets Thu 19:00 · in 6 h 51 m");
  });
});

describe("N of M done", () => {
  it("counts the grid: the dailies, the Hunt, the Skirmish and the Duel slot", () => {
    const goals = [{ doneAt: 1 }, {}, { doneAt: 2 }, {}, {}];
    expect(gridCount(goals, 0)).toEqual({ done: 2, total: 6 });
    // The Duel slot is done after its first duel.
    expect(gridCount(goals, 2)).toEqual({ done: 3, total: 6 });
    // Both Hunts of a friend with characters on both factions: 7.
    expect(gridCount([...goals, {}], 1).total).toBe(7);
  });
});
