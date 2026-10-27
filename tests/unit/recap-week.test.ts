import { describe, expect, it } from "vitest";
import { localTime, nextRecapMoment, recapMomentAtOrBefore, recapWeek, zonedToUtc } from "@/core/recap/week";

// WEB-41: the recap moment (Sunday 13:00 in the admin's time zone) as UTC, around daylight saving.

const AMS = { timeZone: "Europe/Amsterdam", weekday: 0, time: "13:00" };
const utc = (iso: string) => Date.parse(iso) / 1000;

describe("zonedToUtc", () => {
  it("turns a wall clock into UTC with the offset of that day", () => {
    expect(zonedToUtc("Europe/Amsterdam", 2026, 1, 4, 13, 0)).toBe(utc("2026-01-04T12:00:00Z"));
    expect(zonedToUtc("Europe/Amsterdam", 2026, 7, 5, 13, 0)).toBe(utc("2026-07-05T11:00:00Z"));
    expect(zonedToUtc("UTC", 2026, 7, 5, 13, 0)).toBe(utc("2026-07-05T13:00:00Z"));
  });

  it("handles the hour that is skipped or happens twice", () => {
    // 2026-03-29 02:30 doesn't exist in Amsterdam: an hour later on the new clock.
    expect(zonedToUtc("Europe/Amsterdam", 2026, 3, 29, 2, 30)).toBe(utc("2026-03-29T01:30:00Z"));
    // 2026-10-25 02:30 happens twice: the first one (still summer time).
    expect(zonedToUtc("Europe/Amsterdam", 2026, 10, 25, 2, 30)).toBe(utc("2026-10-25T00:30:00Z"));
  });
});

describe("recap moments", () => {
  it("is the latest Sunday 13:00 at or before now", () => {
    // Wednesday 28 Oct 2026: the Sunday before, 25 Oct 13:00 CET (12:00 UTC, after the autumn change).
    expect(recapMomentAtOrBefore(AMS, utc("2026-10-28T10:00:00Z"))).toBe(utc("2026-10-25T12:00:00Z"));
    // The moment itself counts; a second before it, the week before.
    expect(recapMomentAtOrBefore(AMS, utc("2026-10-25T12:00:00Z"))).toBe(utc("2026-10-25T12:00:00Z"));
    expect(recapMomentAtOrBefore(AMS, utc("2026-10-25T11:59:59Z"))).toBe(utc("2026-10-18T11:00:00Z"));
  });

  it("stays at 13:00 local across daylight saving, so that week is an hour longer or shorter", () => {
    const week = recapWeek(AMS, utc("2026-10-26T00:00:00Z"));
    expect(week).toEqual({ start: utc("2026-10-18T11:00:00Z"), end: utc("2026-10-25T12:00:00Z") });
    expect(week.end - week.start).toBe(7 * 86400 + 3600);
    expect(nextRecapMoment(AMS, utc("2026-03-22T12:00:00Z"))).toBe(utc("2026-03-29T11:00:00Z"));
    for (const at of [utc("2026-03-29T11:00:00Z"), utc("2026-10-25T12:00:00Z")]) {
      expect(localTime("Europe/Amsterdam", at)).toMatchObject({ weekday: 0, hour: 13, minute: 0 });
    }
  });

  it("follows another weekday, time and zone", () => {
    const ny = { timeZone: "America/New_York", weekday: 5, time: "20:00" };
    expect(recapMomentAtOrBefore(ny, utc("2026-11-02T12:00:00Z"))).toBe(utc("2026-10-31T00:00:00Z"));
  });
});
