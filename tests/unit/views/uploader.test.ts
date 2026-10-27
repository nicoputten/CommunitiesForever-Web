import { describe, expect, it } from "vitest";
import { clockDay } from "@/core/views/clock";
import { historyLine } from "@/core/views/upload";
import { ACTIVE_SECONDS, NOTICES, noticeOk, parseNotice, uploaderRows } from "@/core/views/uploader";

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
