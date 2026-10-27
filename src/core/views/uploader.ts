import { rejectionLine, type StoredUpload, storedOutcome, summaryParts } from "./upload";

// The uploader page (board `uploader-page`, WEB-34): the viewer's uploaders, the messages around connecting one and
// the viewer's own upload history.

/** An uploader shows "● active" when it was used in the last 7 days (the data age scale's week, DESIGN.md §4). */
export const ACTIVE_SECONDS = 7 * 24 * 60 * 60;

/** An uploader as src/server/uploader.ts lists it. */
export interface UploaderDevice {
  id: number;
  deviceName: string;
  createdAt: number;
  lastUsedAt?: number;
  lastUploadAt?: number;
}

export interface UploaderRow {
  id: number;
  name: string;
  connectedAt: number;
  lastUploadAt?: number;
  active: boolean;
}

/** "Your uploaders", in the order given (newest first). */
export function uploaderRows(devices: readonly UploaderDevice[], now: number): UploaderRow[] {
  return devices.map((d) => {
    const row: UploaderRow = {
      id: d.id,
      name: d.deviceName,
      connectedAt: d.createdAt,
      active: d.lastUsedAt !== undefined && now - d.lastUsedAt < ACTIVE_SECONDS,
    };
    if (d.lastUploadAt !== undefined) row.lastUploadAt = d.lastUploadAt;
    return row;
  });
}

/** What the page says after a step of connecting (`?notice=`), decided with Nico (WEB-34). */
export const NOTICES = {
  allowed: "Connected. The app finishes by itself; you can close this tab.",
  denied: "Denied. The app will say so.",
  "bad-code": "This code doesn't work anymore. Click Connect in the app to get a new one.",
  "too-many": "You have 5 uploaders. Revoke one first.",
  "too-many-tries": "Too many tries. Wait a few minutes and try again.",
} as const;

export type Notice = keyof typeof NOTICES;

export function parseNotice(value: string | string[] | undefined): Notice | undefined {
  return typeof value === "string" && Object.hasOwn(NOTICES, value) ? (value as Notice) : undefined;
}

/** A notice that went well (green) or not (amber). */
export function noticeOk(notice: Notice): boolean {
  return notice === "allowed";
}

// --- your upload history ------------------------------------------------------------------------------------------

/** Skipped and Retried on the board are not known to the site (decided with Nico): Done, Nothing new, Rejected. */
export type OwnStatus = "done" | "nothing-new" | "rejected";

export const OWN_STATUS: Record<OwnStatus, string> = {
  done: "Done",
  "nothing-new": "Nothing new",
  rejected: "Rejected",
};

export interface OwnRow {
  id: number;
  uploadedAt: number;
  /** The uploader app's device; undefined for a manual upload. */
  device?: string;
  status: OwnStatus;
  /** The summary line's parts (the first one gold), "Nothing new", or the rejection's short reason. */
  pills: string[];
}

export function ownRow(u: StoredUpload): OwnRow {
  const status: OwnStatus =
    u.status === "rejected" ? "rejected" : storedOutcome(u)?.kind === "nothing-new" ? "nothing-new" : "done";
  const pills =
    status === "rejected"
      ? [rejectionLine(u)]
      : status === "nothing-new"
        ? ["Nothing new"]
        : summaryParts(u.summary, u.first);
  const row: OwnRow = { id: u.id, uploadedAt: u.uploadedAt, status, pills };
  if (u.device !== undefined) row.device = u.device;
  return row;
}

/** The history's filter (`?show=`): all, one device, manual uploads, or problems (rejected). */
export type OwnFilter = { kind: "all" } | { kind: "device"; name: string } | { kind: "manual" } | { kind: "problems" };

export function parseOwnFilter(value: string | null | undefined): OwnFilter {
  if (value === "manual" || value === "problems") return { kind: value };
  if (value?.startsWith("device:") && value.length > 7) return { kind: "device", name: value.slice(7) };
  return { kind: "all" };
}

export function ownFilterParam(filter: OwnFilter): string | undefined {
  return filter.kind === "all" ? undefined : filter.kind === "device" ? `device:${filter.name}` : filter.kind;
}

export function matchesOwnFilter(row: OwnRow, filter: OwnFilter): boolean {
  switch (filter.kind) {
    case "all":
      return true;
    case "device":
      return row.device === filter.name;
    case "manual":
      return row.device === undefined;
    case "problems":
      return row.status === "rejected";
  }
}

/** How many uploads the history shows (`?older=`), 20 more per "Show older uploads". */
export const OWN_PAGE = 20;
export const OWN_MAX = 500;

export function parseOlder(value: string | string[] | undefined): number {
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(n) && n > OWN_PAGE ? Math.min(n, OWN_MAX) : OWN_PAGE;
}
