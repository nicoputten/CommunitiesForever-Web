import { battleTagKey, type FileRejection } from "../access";
import type { UploadSummary } from "../diff";
import type { Dataset } from "../model";
import { SUPPORTED_SCHEMA, type Unreadable } from "../normalize";
import { uploadReport } from "./report";

// The upload screen (boards `upload`, `upload-states`, WEB-19): what the server's answer means for the screen, the
// history lines, and the counts shown while a file is read. Copy decided with Nico for WEB-19 (2026-10-26).

/** Larger files are refused and not stored (docs/ARCHITECTURE.md "Data flow"); the browser checks it first. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** The file the addon writes; any other name is another addon's file. */
export const LEDGER_FILE = "CommunitiesForever.lua";

/** What POST /api/uploads answers with status 200 (src/server/uploads.ts `UploadResult`). */
export interface UploadResponse {
  id: number;
  uploadedAt: number;
  status: "ok" | "rejected";
  duplicate: boolean;
  rejection?: FileRejection;
  unreadable?: Unreadable;
  schemaVersion?: number;
  summary?: UploadSummary;
  previousUploadAt?: number;
}

/** The screen's state after an upload; `done` goes on to the session report. */
export type UploadOutcome =
  | { kind: "done"; id: number }
  /** `fileName`: the other addon's file, when the name says so. */
  | { kind: "wrong-file"; fileName?: string }
  | { kind: "damaged" }
  | { kind: "newer-format"; format?: number; supported: number }
  /** `since`: the upload with the same data (the earlier identical file, or the uploader's previous upload). */
  | { kind: "nothing-new"; since?: number }
  | { kind: "not-your-file"; owner?: string }
  | { kind: "other-community" }
  | { kind: "no-community-yet" }
  | { kind: "too-large" }
  /** No answer, or one the screen doesn't know: the UI never shows raw error text. */
  | { kind: "failed" };

export function isLedgerName(fileName: string): boolean {
  return fileName.trim().toLowerCase() === LEDGER_FILE.toLowerCase();
}

/** A file name to show: the last path part, at most 60 characters. */
export function shownFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop()?.trim() ?? "";
  return base.length > 60 ? `${base.slice(0, 59)}…` : base;
}

/** Before sending: a file over the limit is refused in the browser. */
export function checkBeforeUpload(size: number): { kind: "too-large" } | undefined {
  return size > MAX_UPLOAD_BYTES ? { kind: "too-large" } : undefined;
}

function isResponse(body: unknown): body is UploadResponse {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.id === "number" &&
    typeof b.uploadedAt === "number" &&
    (b.status === "ok" || b.status === "rejected") &&
    typeof b.duplicate === "boolean"
  );
}

/** The screen's state for the server's answer (HTTP status and parsed JSON body) to a file named `fileName`. */
export function uploadOutcome(httpStatus: number, body: unknown, fileName: string): UploadOutcome {
  if (httpStatus === 413) return { kind: "too-large" };
  if (httpStatus !== 200 || !isResponse(body)) return { kind: "failed" };

  if (body.status === "ok") {
    if (body.duplicate) return { kind: "nothing-new", since: body.uploadedAt };
    if (body.summary !== undefined && uploadReport(body.summary, body.uploadedAt).nothingNew) {
      return body.previousUploadAt !== undefined
        ? { kind: "nothing-new", since: body.previousUploadAt }
        : { kind: "nothing-new" };
    }
    return { kind: "done", id: body.id };
  }

  if (body.unreadable === "newer-format") {
    return body.schemaVersion !== undefined
      ? { kind: "newer-format", format: body.schemaVersion, supported: SUPPORTED_SCHEMA }
      : { kind: "newer-format", supported: SUPPORTED_SCHEMA };
  }
  if (body.unreadable === "not-ledger" || body.unreadable === "damaged") {
    const name = shownFileName(fileName);
    if (name !== "" && !isLedgerName(name)) return { kind: "wrong-file", fileName: name };
    return body.unreadable === "not-ledger" ? { kind: "wrong-file" } : { kind: "damaged" };
  }
  switch (body.rejection?.code) {
    case "not-your-file": {
      const owner = body.rejection.owner;
      return typeof owner === "string" && owner !== "" ? { kind: "not-your-file", owner } : { kind: "not-your-file" };
    }
    case "other-community":
      return { kind: "other-community" };
    case "no-community-yet":
      return { kind: "no-community-yet" };
    default:
      return { kind: "failed" };
  }
}

/** "10 characters from 5 friends" while the file is read: characters with a record, and the people who own them. */
export interface LedgerCounts {
  characters: number;
  friends: number;
}

export function ledgerCounts(data: Dataset): LedgerCounts {
  const owners = new Set<string>();
  let characters = 0;
  for (const c of Object.values(data.characters)) {
    if (!c.hasRecord) continue;
    characters++;
    if (c.owner !== undefined) owners.add(c.owner);
  }
  return { characters, friends: owners.size };
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function ledgerCountsText({ characters, friends }: LedgerCounts): string {
  return `${plural(characters, "character")} from ${plural(friends, "friend")}`;
}

// --- history --------------------------------------------------------------------------------------------------

/** A stored upload as the history reads it (src/server/uploads.ts `listUploads`). */
export interface StoredUpload {
  id: number;
  uploadedAt: number;
  uploadedBy: string;
  status: "ok" | "rejected";
  rejection?: FileRejection["code"];
  unreadable?: Unreadable;
  schemaVersion?: number;
  summary?: UploadSummary;
  /** The first accepted upload of the site. */
  first: boolean;
}

export interface HistoryLine {
  id: number;
  uploadedAt: number;
  /** Display name of the uploader (from the data), else the BattleTag's name part. */
  uploader: string;
  status: "done" | "rejected";
  /** "5 levels gained · 4 skill gains · 1 new character", or the short reason of a rejection. */
  text: string;
}

/**
 * The summary line: the first accepted upload says "First upload · N characters"; after that up to three counts in
 * this order, zeros left out; "Nothing new" when nothing changed (Nico, WEB-19).
 */
export function summaryLine(summary: UploadSummary | undefined, first: boolean): string {
  if (summary === undefined) return "Nothing new";
  const c = summary.counts;
  if (first) return `First upload · ${plural(c.newCharacters, "character")}`;
  const parts = [
    c.levelsGained > 0 ? plural(c.levelsGained, "level gained", "levels gained") : undefined,
    c.skillGains > 0 ? plural(c.skillGains, "skill gain") : undefined,
    c.newCharacters > 0 ? plural(c.newCharacters, "new character") : undefined,
    c.sightings > 0 ? plural(c.sightings, "sighting") : undefined,
    c.itemLevelGains > 0 ? plural(c.itemLevelGains, "item level gain") : undefined,
  ].filter((p) => p !== undefined);
  return parts.length === 0 ? "Nothing new" : parts.slice(0, 3).join(" · ");
}

/** The short reason of a rejected upload in the history. */
export function rejectionLine(u: Pick<StoredUpload, "rejection" | "unreadable" | "schemaVersion">): string {
  switch (u.unreadable) {
    case "not-ledger":
      return "Wrong file: another addon's data";
    case "damaged":
      return "Damaged file";
    case "newer-format":
      return u.schemaVersion !== undefined ? `Newer addon: format ${u.schemaVersion}` : "Newer addon";
  }
  switch (u.rejection) {
    case "not-your-file":
      return "Not your file";
    case "other-community":
      return "Another community";
    case "no-community-yet":
      return "Before the admin's first upload";
  }
  return "Couldn't be read";
}

/** The name part of a BattleTag ("Nico#2201" → "Nico"); display only. */
function battleTagName(battleTag: string): string {
  const name = battleTag.split("#")[0]?.trim() ?? "";
  return name === "" ? battleTag : name;
}

/** `names`: display names by battleTagKey(), from the merged data. */
export function historyLine(u: StoredUpload, names: ReadonlyMap<string, string>): HistoryLine {
  return {
    id: u.id,
    uploadedAt: u.uploadedAt,
    uploader: names.get(battleTagKey(u.uploadedBy)) ?? battleTagName(u.uploadedBy),
    status: u.status === "ok" ? "done" : "rejected",
    text: u.status === "ok" ? summaryLine(u.summary, u.first) : rejectionLine(u),
  };
}
