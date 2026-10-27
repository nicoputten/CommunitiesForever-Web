import type { FileRejection } from "./access";
import type { UploadSummary } from "./diff";
import type { Unreadable } from "./normalize";
import { uploadReport } from "./views/report";
import { type LedgerCounts, rejectionLine, summaryLine } from "./views/upload";

// The uploader API (WEB-33, docs/UPLOADER-API.md; OAuth 2.0 device flow since WEB-33b): pairing codes, the token format, the rate limiter and what an
// upload answers the Windows app. Pure: random bytes and "now" come in as arguments.

// --- pairing codes ------------------------------------------------------------------------------------------------

/** No look-alikes: no 0/O, 1/I/L, 2/Z, 5/S, 8/B, U/V (decided with Nico, WEB-33). 23 symbols, 8 per code. */
export const CODE_ALPHABET = "ACDEFGHJKMNPQRTWXY34679";
export const CODE_LENGTH = 8;
/** Codes and pairings expire after 10 minutes. */
export const PAIRING_SECONDS = 10 * 60;
/** How often the app polls the token endpoint (RFC 8628 `interval`; its default). Faster gets `slow_down`. */
export const POLL_SECONDS = 5;

/** The uploader app is a public OAuth client (no secret): RFC 8628 device flow, RFC 6750 Bearer tokens. */
export const CLIENT_ID = "communitiesforever-uploader";
export const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

/**
 * A user code "KXRT-7QMN" from random bytes. Bytes ≥ 253 are skipped so every symbol is equally likely (253 is the
 * largest multiple of 23 below 256); undefined when `bytes` ran out, so the caller asks for more.
 */
export function userCode(bytes: Uint8Array): string | undefined {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = "";
  for (const b of bytes) {
    if (b >= limit) continue;
    code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (code.length === CODE_LENGTH) return `${code.slice(0, 4)}-${code.slice(4)}`;
  }
  return undefined;
}

/** A code as someone typed it ("kxrt 7qmn") in its stored form, or undefined when it can't be one. */
export function normalizeUserCode(input: string): string | undefined {
  const plain = input.toUpperCase().replace(/[\s-]/g, "");
  if (plain.length !== CODE_LENGTH || [...plain].some((c) => !CODE_ALPHABET.includes(c))) return undefined;
  return `${plain.slice(0, 4)}-${plain.slice(4)}`;
}

// --- tokens -------------------------------------------------------------------------------------------------------

/** Upload tokens: `cfu_` and 32 random bytes in base64url (43 characters). Stored only as a SHA-256 hash. */
export const TOKEN_PREFIX = "cfu_";
export const TOKEN_BYTES = 32;
/** Active tokens per person. */
export const MAX_TOKENS = 5;

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Base64url without padding. */
export function base64url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let j = 0; j < chars; j++) out += B64URL[(n >> (18 - 6 * j)) & 63];
  }
  return out;
}

export function formatToken(bytes: Uint8Array): string {
  return TOKEN_PREFIX + base64url(bytes);
}

const TOKEN_PATTERN = new RegExp(`^${TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`);

/** The token of an `Authorization: Bearer cfu_…` header; undefined for anything else. */
export function bearerToken(header: string | null | undefined): string | undefined {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  const token = match?.[1];
  return token !== undefined && TOKEN_PATTERN.test(token) ? token : undefined;
}

/** A device or app name as the app sends it: trimmed, WoW-safe text, at most 64 characters; undefined when empty. */
export function cleanLabel(value: unknown, max = 64): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[\u0000-\u001f\u007f|]/g, "").trim();
  return text === "" ? undefined : text.slice(0, max);
}

// --- rate limits --------------------------------------------------------------------------------------------------

/**
 * A fixed-window counter per key (an IP, a pairing, a token), in memory: the site is one container. The map is
 * bounded: expired windows are swept when it is full, and a full map of live windows refuses new keys.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    readonly limit: number,
    readonly windowSeconds: number,
    readonly maxKeys = 10_000,
  ) {}

  /** Counts a hit; undefined when it is allowed, else the seconds until the window ends (`Retry-After`). */
  hit(key: string, now: number): number | undefined {
    let w = this.windows.get(key);
    if (w !== undefined && now - w.start >= this.windowSeconds) {
      this.windows.delete(key);
      w = undefined;
    }
    if (w === undefined) {
      if (this.windows.size >= this.maxKeys) this.sweep(now);
      if (this.windows.size >= this.maxKeys) return this.windowSeconds;
      w = { start: now, count: 0 };
      this.windows.set(key, w);
    }
    if (w.count >= this.limit) return Math.max(1, w.start + this.windowSeconds - now);
    w.count++;
    return undefined;
  }

  private sweep(now: number): void {
    for (const [key, w] of this.windows) if (now - w.start >= this.windowSeconds) this.windows.delete(key);
  }
}

// --- the upload response ------------------------------------------------------------------------------------------

export type UploaderRejection =
  "wrong_file" | "damaged" | "newer_format" | "not_your_file" | "other_community" | "no_community_yet";

/** What `POST /api/uploader/v1/uploads` answers with 200 (docs/UPLOADER-API.md, v1: changes are additive only). */
export interface UploaderUploadResponse {
  uploadId: number;
  uploadedAt: number;
  status: "ok" | "nothing_new" | "rejected";
  rejection: UploaderRejection | null;
  /** The file's format, for `newer_format`; else null. */
  schemaVersion: number | null;
  summaryLine: string;
  highlights: string[];
  counts: LedgerCounts | null;
  reportUrl: string;
}

/** A stored upload's result as src/server/uploads.ts `upload()` returns it. */
export interface UploaderUploadInput {
  id: number;
  uploadedAt: number;
  status: "ok" | "rejected";
  duplicate: boolean;
  rejection?: FileRejection;
  unreadable?: Unreadable;
  schemaVersion?: number;
  summary?: UploadSummary;
  counts?: LedgerCounts;
  /** The site's first accepted upload ("First upload · N characters"). */
  first: boolean;
}

export const MAX_HIGHLIGHTS = 3;

/** The site's codes in the API's spelling: one place, so the stored ones can change without breaking the app. */
export function uploaderRejection(
  u: Pick<UploaderUploadInput, "rejection" | "unreadable">,
): UploaderRejection | undefined {
  switch (u.unreadable) {
    case "not-ledger":
      return "wrong_file";
    case "damaged":
      return "damaged";
    case "newer-format":
      return "newer_format";
  }
  switch (u.rejection?.code) {
    case "not-your-file":
      return "not_your_file";
    case "other-community":
      return "other_community";
    case "no-community-yet":
      return "no_community_yet";
  }
  return undefined;
}

/**
 * Up to three lines about what this upload changed: the biggest level ups, then the highest skill gains, then new
 * characters (with a record first). Full names only (CLAUDE.md rule 3); a character without a name is left out.
 */
export function highlights(summary: UploadSummary, uploadedAt: number, first: boolean): string[] {
  if (first) return [];
  const r = uploadReport(summary, uploadedAt);
  const lines: string[] = [];
  for (const l of r.levelUps) if (l.name !== undefined) lines.push(`${l.name} ${l.from} → ${l.to}`);
  for (const s of r.skillGains) {
    if (s.name === undefined) continue;
    const what = s.profession ?? "Profession";
    lines.push(s.from === undefined ? `${s.name}: ${what} learned` : `${s.name}: ${what} ${s.from} → ${s.to}`);
  }
  const newOnes = [...r.newCharacters].sort((a, b) => Number(b.hasRecord) - Number(a.hasRecord));
  for (const c of newOnes) if (c.name !== undefined) lines.push(`${c.name} is new`);
  return lines.slice(0, MAX_HIGHLIGHTS);
}

/**
 * The app's view of an upload. Only what this upload changed counts: with several uploaders the files arrive out of
 * sync, and the merge (src/core/merge.ts) takes only what is newer, so a file with nothing newer is `nothing_new`.
 */
export function uploaderUploadResponse(u: UploaderUploadInput, siteUrl: string): UploaderUploadResponse {
  const base = {
    uploadId: u.id,
    uploadedAt: u.uploadedAt,
    reportUrl: new URL(`/upload/${u.id}`, siteUrl).toString(),
  };
  const counts = u.counts ?? null;
  if (u.status === "rejected") {
    return {
      ...base,
      status: "rejected",
      rejection: uploaderRejection(u) ?? "damaged",
      schemaVersion: u.unreadable === "newer-format" ? (u.schemaVersion ?? null) : null,
      summaryLine: rejectionLine({
        rejection: u.rejection?.code,
        unreadable: u.unreadable,
        schemaVersion: u.schemaVersion,
      }),
      highlights: [],
      counts: u.unreadable === undefined ? counts : null,
    };
  }
  const nothingNew = u.duplicate || u.summary === undefined || uploadReport(u.summary, u.uploadedAt).nothingNew;
  return {
    ...base,
    status: nothingNew ? "nothing_new" : "ok",
    rejection: null,
    schemaVersion: null,
    summaryLine: nothingNew ? "Nothing new" : summaryLine(u.summary, u.first),
    highlights: nothingNew || u.summary === undefined ? [] : highlights(u.summary, u.uploadedAt, u.first),
    counts,
  };
}
