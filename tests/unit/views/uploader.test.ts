import { describe, expect, it } from "vitest";
import { clockDay, clockParts, dayGroup } from "@/core/views/clock";
import { historyLine } from "@/core/views/upload";
import {
  ACTIVE_SECONDS,
  matchesOwnFilter,
  NOTICES,
  noticeOk,
  ownFilterParam,
  ownRow,
  parseNotice,
  parseOlder,
  parseOwnFilter,
  uploaderRows,
} from "@/core/views/uploader";

// WEB-34: the uploader page's view model, its dates and "via" in the upload history.

const NOW = Date.UTC(2026, 9, 27, 21, 14) / 1000;
const DAY = 24 * 60 * 60;

describe("uploader rows", () => {
  it("is active when used in the last 7 days", () => {
    const rows = uploaderRows(
      [
        { id: 2, deviceName: "DESKTOP-NICO", createdAt: NOW - DAY, lastUsedAt: NOW - 60, lastUploadAt: NOW - 60 },
        { id: 1, deviceName: "NICO-LAPTOP", createdAt: NOW - 15 * DAY, lastUsedAt: NOW - ACTIVE_SECONDS },
      ],
      NOW,
    );
    expect(rows).toEqual([
      { id: 2, name: "DESKTOP-NICO", connectedAt: NOW - DAY, lastUploadAt: NOW - 60, active: true },
      { id: 1, name: "NICO-LAPTOP", connectedAt: NOW - 15 * DAY, active: false },
    ]);
  });

  it("reads only known notices", () => {
    expect(parseNotice("allowed")).toBe("allowed");
    expect(parseNotice("toString")).toBeUndefined();
    expect(parseNotice(["allowed"])).toBeUndefined();
    expect(noticeOk("allowed")).toBe(true);
    expect(noticeOk("bad-code")).toBe(false);
    expect(NOTICES["too-many"]).toBe("You have 5 uploaders. Revoke one first.");
  });
});

describe("clockDay", () => {
  it("says today, yesterday or the date, with the time only when asked", () => {
    expect(clockDay(NOW - 60, NOW, false, "UTC")).toBe("today");
    expect(clockDay(NOW - 60, NOW, true, "UTC")).toBe("today 21:13");
    expect(clockDay(NOW - DAY, NOW, true, "UTC")).toBe("yesterday 21:14");
    expect(clockDay(NOW - 13 * DAY, NOW, true, "UTC")).toBe("14 Oct");
    expect(clockDay(NOW - 365 * DAY, NOW, false, "UTC")).toBe("27 Oct 2025");
  });
});

describe("history via", () => {
  it("names the device an uploader app upload came from", () => {
    const base = { id: 1, uploadedAt: NOW, uploadedBy: "Nico#2201", status: "rejected" as const, first: false };
    expect(historyLine({ ...base, device: "DESKTOP-NICO" }, new Map()).via).toBe("via DESKTOP-NICO");
    expect(historyLine(base, new Map()).via).toBeUndefined();
  });
});

describe("your upload history", () => {
  const counts = {
    levelsGained: 5,
    skillGains: 4,
    itemLevelGains: 0,
    newCharacters: 1,
    sightings: 7,
    peopleWithNewData: 1,
  };
  const summary = {
    newPeople: [],
    newCharacters: [{ guid: "c", name: "Zul Kazrek", hasRecord: true }],
    removedCharacters: [],
    levelUps: [{ guid: "a", name: "Ves Doombringer", from: 37, to: 42 }],
    professionGains: [],
    itemLevelGains: [],
    sightings: [],
    senders: [],
    counts,
  };
  const base = { id: 7, uploadedAt: NOW, uploadedBy: "Nico#2201", first: false };

  it("turns uploads into rows with pills and a status", () => {
    expect(ownRow({ ...base, status: "ok", summary, device: "DESKTOP-NICO" })).toEqual({
      id: 7,
      uploadedAt: NOW,
      device: "DESKTOP-NICO",
      status: "done",
      pills: ["5 levels gained", "4 skill gains", "1 new character"],
    });
    expect(ownRow({ ...base, status: "ok" })).toMatchObject({ status: "nothing-new", pills: ["Nothing new"] });
    expect(ownRow({ ...base, status: "rejected", unreadable: "not-ledger" })).toMatchObject({
      status: "rejected",
      pills: ["Wrong file: another addon's data"],
    });
    expect(ownRow({ ...base, status: "ok", summary, first: true }).pills).toEqual(["First upload", "1 character"]);
  });

  it("filters by device, manual and problems", () => {
    const app = ownRow({ ...base, status: "ok", summary, device: "DESKTOP-NICO" });
    const manual = ownRow({ ...base, status: "rejected", unreadable: "damaged" });
    expect(parseOwnFilter("device:DESKTOP-NICO")).toEqual({ kind: "device", name: "DESKTOP-NICO" });
    expect(parseOwnFilter("device:")).toEqual({ kind: "all" });
    expect(parseOwnFilter(null)).toEqual({ kind: "all" });
    expect(ownFilterParam({ kind: "all" })).toBeUndefined();
    expect(matchesOwnFilter(app, parseOwnFilter("device:DESKTOP-NICO"))).toBe(true);
    expect(matchesOwnFilter(manual, parseOwnFilter("manual"))).toBe(true);
    expect(matchesOwnFilter(app, parseOwnFilter("manual"))).toBe(false);
    expect(matchesOwnFilter(manual, parseOwnFilter("problems"))).toBe(true);
    expect(matchesOwnFilter(app, parseOwnFilter("problems"))).toBe(false);
  });

  it("pages by 20, at most 500", () => {
    expect(parseOlder(undefined)).toBe(20);
    expect(parseOlder("40")).toBe(40);
    expect(parseOlder("x")).toBe(20);
    expect(parseOlder("100000")).toBe(500);
  });

  it("groups by day and splits time and date", () => {
    expect(dayGroup(NOW - 60, NOW, "UTC")).toBe("today");
    expect(dayGroup(NOW - 4 * DAY, NOW, "UTC")).toBe("week");
    expect(dayGroup(NOW - 7 * DAY, NOW, "UTC")).toBe("earlier");
    expect(clockParts(NOW, NOW, "UTC")).toEqual({ time: "21:14", date: "Tue 27 Oct" });
    expect(clockParts(NOW - 365 * DAY, NOW, "UTC").date).toBe("Mon 27 Oct 2025");
  });
});
