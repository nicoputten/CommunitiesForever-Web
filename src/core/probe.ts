import type { LuaChunk, LuaValue } from "./lua";
import { field, findGlobal } from "./normalize";

// The addon's hidden launch probe (WEB-82): which game APIs work on Forever, in `CommunitiesForeverDB.global.probe`
// (per client flavour, per item `{ status, detail, at, build, ... }`, capped at ~30 KB by the addon). The site never
// shows or normalizes it; only the owner downloads it, one entry per friend, as it is in the file.

/**
 * Cheap test before parsing a whole file: a file without the word "probe" anywhere has no probe section. The game
 * writes keys as `["probe"]`; a file that has the word elsewhere is parsed and `readProbe` decides.
 */
export function mayHaveProbe(text: string): boolean {
  return text.includes("probe");
}

/** The probe section of a parsed file; undefined when the file has none (every addon release before the probe). */
export function readProbe(chunk: LuaChunk): LuaValue | undefined {
  const probe = field(findGlobal(chunk), "probe");
  return probe === undefined || probe === null ? undefined : probe;
}

/** An accepted upload, newest first in the list the server passes in. */
export interface ProbeUpload {
  id: number;
  uploadedBy: string;
  uploadedAt: number;
}

/**
 * Per friend (by `key`, the BattleTag key) their newest upload that has a probe section, in the order the uploads
 * came (newest first). `hasProbe` is asked only until a friend has one, so older files of that friend aren't read.
 */
export function newestPerFriend<T extends ProbeUpload>(
  newestFirst: readonly T[],
  key: (battleTag: string) => string,
  hasProbe: (upload: T) => boolean,
): T[] {
  const found = new Set<string>();
  const picked: T[] = [];
  for (const u of newestFirst) {
    const k = key(u.uploadedBy);
    if (found.has(k) || !hasProbe(u)) continue;
    found.add(k);
    picked.push(u);
  }
  return picked;
}

/** The Admin page box: how many friends have results and the newest upload time among them. */
export interface ProbeSummary {
  friends: number;
  newestAt?: number;
}

export function probeSummary(picked: readonly ProbeUpload[]): ProbeSummary {
  if (picked.length === 0) return { friends: 0 };
  return { friends: picked.length, newestAt: Math.max(...picked.map((u) => u.uploadedAt)) };
}

/** One friend in the download. */
export interface ProbeEntry {
  displayName: string;
  battleTag: string;
  /** ISO 8601, UTC. */
  uploadedAt: string;
  uploadId: number;
  probe: LuaValue;
}

/** The downloaded file. */
export interface ProbeFile {
  exportedAt: string;
  friends: ProbeEntry[];
}

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

export function probeEntry(upload: ProbeUpload, displayName: string, probe: LuaValue): ProbeEntry {
  return { displayName, battleTag: upload.uploadedBy, uploadedAt: iso(upload.uploadedAt), uploadId: upload.id, probe };
}

/** The file, friends by display name. */
export function probeFile(entries: readonly ProbeEntry[], now: number): ProbeFile {
  return {
    exportedAt: iso(now),
    friends: [...entries].sort(
      (a, b) => a.displayName.localeCompare(b.displayName) || a.battleTag.localeCompare(b.battleTag),
    ),
  };
}

/** `probe-results-2026-11-04.json` */
export function probeFileName(now: number): string {
  return `probe-results-${iso(now).slice(0, 10)}.json`;
}

/** "3 friends" */
export function probeFriendsText(friends: number): string {
  return friends === 1 ? "1 friend" : `${friends} friends`;
}
