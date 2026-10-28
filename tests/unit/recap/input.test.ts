import { describe, expect, it } from "vitest";
import { MAP_ZONES, mapZone } from "@/core/recap/input";
import { recapDates, recapDue } from "@/core/recap/when";

// WEB-41c: the recap's zones by map name, and its dates in the recap's time zone.

describe("map zones", () => {
  it("counts the map's zones and names a sighting by its map zone", () => {
    expect(MAP_ZONES).toBeGreaterThan(30);
    expect(mapZone("Duskwood")).toBe("Duskwood");
    expect(mapZone("Warsong Gulch")).toBeUndefined();
    expect(mapZone("Somewhere Else")).toBeUndefined();
  });
});

describe("recap dates", () => {
  const t = (iso: string) => Date.parse(iso) / 1000;
  it("names the week's first and last day", () => {
    expect(recapDates("Europe/Amsterdam", t("2026-10-18T11:00:00Z"), t("2026-10-25T12:00:00Z"))).toBe("18–25 Oct");
    expect(recapDates("UTC", t("2026-10-28T13:00:00Z"), t("2026-11-04T13:00:00Z"))).toBe("28 Oct – 4 Nov");
    expect(recapDue("Europe/Amsterdam", t("2026-11-01T12:00:00Z"))).toBe("Sunday 1 Nov, 13:00 (Europe/Amsterdam)");
  });
});
