// The uploader page (board `uploader-page`, WEB-34): the viewer's uploaders and the messages around connecting one.

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
