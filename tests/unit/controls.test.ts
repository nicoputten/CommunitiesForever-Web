import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayLabel,
  dayLabelLong,
  filterOptions,
  isIsoDate,
  monthGrid,
  monthLabel,
  parseTime,
  searchKey,
  stepTime,
  weekdayOf,
} from "@/core/controls";

describe("dropdown search", () => {
  const options = [
    { label: "Scarlet Monastery: Graveyard", meta: "26–36", group: "Fits your characters" },
    { label: "Scarlet Monastery: Library", meta: "29–39" },
    { label: "Shadowfang Keep", meta: "22–30" },
    { label: "São Paulo", meta: "UTC-03:00", group: "America" },
  ];

  it("finds every word in label, meta or group, in order, ignoring case, accents and underscores", () => {
    expect(filterOptions(options, "scar").map((o) => o.label)).toEqual([
      "Scarlet Monastery: Graveyard",
      "Scarlet Monastery: Library",
    ]);
    expect(filterOptions(options, "scarlet lib")).toHaveLength(1);
    expect(filterOptions(options, "sao_paulo")).toHaveLength(1);
    expect(filterOptions(options, "america")).toHaveLength(1);
    expect(filterOptions(options, "fits")).toHaveLength(1);
    expect(filterOptions(options, "  ")).toHaveLength(4);
    expect(filterOptions(options, "stormwind")).toEqual([]);
    expect(searchKey("Europe/Isle_of_Man")).toBe("europe/isle of man");
  });
});

describe("parseTime", () => {
  it("reads the ways people type a time, 24-hour", () => {
    expect(
      ["2030", "20:30", "20.30", "20h30", "20 30", "830", "8:30", "20", "8", "0000", "23:59"].map(parseTime),
    ).toEqual(["20:30", "20:30", "20:30", "20:30", "20:30", "08:30", "08:30", "20:00", "08:00", "00:00", "23:59"]);
  });

  it("refuses what isn't a time", () => {
    expect(["", "24:00", "20:60", "2560", "abc", "20:3", "12345", "-1"].map(parseTime)).toEqual(
      Array(8).fill(undefined),
    );
  });

  it("steps by minutes around the clock", () => {
    expect(stepTime("20:30", 15)).toBe("20:45");
    expect(stepTime("23:50", 15)).toBe("00:05");
    expect(stepTime("00:05", -15)).toBe("23:50");
    expect(stepTime(undefined, 15)).toBe("00:15");
  });
});

describe("calendar", () => {
  it("adds days and months, clamping to the month's last day", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
  });

  it("starts weeks on Monday and fills the first and last week", () => {
    expect(weekdayOf("2026-10-26")).toBe(0);
    expect(weekdayOf("2026-11-01")).toBe(6);
    const october = monthGrid("2026-10-28");
    expect(october).toHaveLength(5);
    expect(october[0]?.[0]).toEqual({ date: "2026-09-28", inMonth: false });
    expect(october[0]?.[3]).toEqual({ date: "2026-10-01", inMonth: true });
    expect(october[4]?.[6]).toEqual({ date: "2026-11-01", inMonth: false });
    expect(monthGrid("2027-02-01")).toHaveLength(4);
    expect(monthGrid("2026-11-01")).toHaveLength(6);
  });

  it("labels days and months in English, without a time zone shift", () => {
    expect(dayLabel("2026-10-30")).toBe("Fri 30 Oct");
    expect(dayLabelLong("2026-10-30")).toBe("Friday 30 October 2026");
    expect(monthLabel("2026-10-30")).toBe("October 2026");
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });
});
