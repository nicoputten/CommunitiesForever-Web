import { describe, expect, it } from "vitest";
import { D, H } from "./sample";
import { DEFAULT_SITE_NAME, dataAge, daysOld, isOld, rowAge, siteName, staleBanner } from "@/core/views";

const NOW = 1_000_000;

describe("data age scale", () => {
  it.each([
    [0, "live"],
    [32 * H - 1, "live"],
    [32 * H, "recent"],
    [3 * D - 1, "recent"],
    [3 * D, "days"],
    [7 * D - 1, "days"],
    [7 * D, "week"],
    [60 * D, "week"],
  ] as const)("%i seconds old is %s", (age, state) => {
    expect(dataAge(NOW - age, NOW)).toBe(state);
  });

  it("is unknown without a time", () => {
    expect(dataAge(undefined, NOW)).toBe("unknown");
  });

  it("treats a time in the future as now", () => {
    expect(dataAge(NOW + 5 * H, NOW)).toBe("live");
    expect(daysOld(NOW + 5 * D, NOW)).toBe(0);
  });

  it("turns old at 7 days", () => {
    expect(isOld(NOW - 7 * D + 1, NOW)).toBe(false);
    expect(isOld(NOW - 7 * D, NOW)).toBe(true);
    expect(isOld(undefined, NOW)).toBe(false);
    expect(daysOld(NOW - 9 * D - 5 * H, NOW)).toBe(9);
  });
});

describe("site name", () => {
  const admin = "Nico#2201";

  it("is the community name of the newest admin upload", () => {
    expect(
      siteName(
        [
          { uploadedBy: admin, uploadedAt: 10, communityName: "Old Name" },
          { uploadedBy: admin, uploadedAt: 30, communityName: "Doombringers" },
          { uploadedBy: admin, uploadedAt: 20, communityName: "Middle Name" },
        ],
        admin,
      ),
    ).toBe("Doombringers");
  });

  it("ignores other people's uploads and uploads without a name", () => {
    expect(
      siteName(
        [
          { uploadedBy: admin, uploadedAt: 10, communityName: "Doombringers" },
          { uploadedBy: admin, uploadedAt: 20 },
          { uploadedBy: "Bob#2002", uploadedAt: 30, communityName: "Bob's Club" },
        ],
        admin,
      ),
    ).toBe("Doombringers");
  });

  it("falls back to CommunitiesForever", () => {
    expect(DEFAULT_SITE_NAME).toBe("CommunitiesForever");
    expect(siteName([], admin)).toBe("CommunitiesForever");
    expect(siteName([{ uploadedBy: "Bob#2002", uploadedAt: 1, communityName: "X" }], admin)).toBe("CommunitiesForever");
  });
});

describe("stale-site banner", () => {
  it("shows when the last upload is 7 days old or more", () => {
    expect(staleBanner(NOW - 7 * D + 1, NOW)).toBeUndefined();
    expect(staleBanner(NOW - 7 * D, NOW)).toEqual({ lastUploadAt: NOW - 7 * D, days: 7 });
    expect(staleBanner(NOW - 12 * D - H, NOW)).toEqual({ lastUploadAt: NOW - 12 * D - H, days: 12 });
  });

  it("does not show before the first upload", () => {
    expect(staleBanner(undefined, NOW)).toBeUndefined();
  });
});

describe("short age (roll call rows)", () => {
  it.each([
    [NOW, "now"],
    [NOW + 60, "now"],
    [NOW - 59, "now"],
    [NOW - 60, "1 min"],
    [NOW - H + 1, "59 min"],
    [NOW - H, "1 h"],
    [NOW - D + 1, "23 h"],
    [NOW - D, "1 d"],
    [NOW - 9 * D, "9 d"],
  ])("%i is %s", (at, label) => {
    expect(rowAge(at, NOW)).toBe(label);
  });
});
