import { gunzipSync } from "node:zlib";
import { desc, eq } from "drizzle-orm";
import { battleTagKey, battleTagName } from "@/core/access";
import { type LuaValue, parseLua } from "@/core/lua";
import {
  mayHaveProbe,
  newestPerFriend,
  type ProbeFile,
  probeEntry,
  probeFile,
  type ProbeSummary,
  probeSummary,
  readProbe,
} from "@/core/probe";
import type { Db } from "./db";
import { uploads } from "./db/schema";
import { displayNames } from "./uploads";

// The launch-probe results in friends' uploads (WEB-82), for the owner only (the route and the Admin page check).
// Read from the stored raw files on demand: never normalized, never in a derived table, never logged.

interface Candidate {
  id: number;
  uploadedBy: string;
  uploadedAt: number;
  sha256: string;
}

/**
 * Whether a file has a probe section, by its SHA-256. A stored file never changes, so the answer holds for the life
 * of the process; only the yes/no is kept, never the section itself.
 */
const hasProbeByHash = new Map<string, boolean>();

function rawText(db: Db, id: number): string | undefined {
  const row = db.select({ raw: uploads.raw }).from(uploads).where(eq(uploads.id, id)).get();
  return row === undefined ? undefined : new TextDecoder().decode(gunzipSync(row.raw));
}

/** The file's probe section; undefined without one or when it no longer parses (an accepted file always did). */
function probeOf(db: Db, id: number): LuaValue | undefined {
  const text = rawText(db, id);
  if (text === undefined || !mayHaveProbe(text)) return undefined;
  try {
    return readProbe(parseLua(text));
  } catch {
    return undefined;
  }
}

function hasProbe(db: Db, u: Candidate): boolean {
  let has = hasProbeByHash.get(u.sha256);
  if (has === undefined) {
    has = probeOf(db, u.id) !== undefined;
    hasProbeByHash.set(u.sha256, has);
  }
  return has;
}

/** Per friend their newest accepted upload that has a probe section. */
function newest(db: Db): Candidate[] {
  const accepted = db
    .select({ id: uploads.id, uploadedBy: uploads.uploadedBy, uploadedAt: uploads.uploadedAt, sha256: uploads.sha256 })
    .from(uploads)
    .where(eq(uploads.status, "ok"))
    .orderBy(desc(uploads.id))
    .all();
  return newestPerFriend(accepted, battleTagKey, (u) => hasProbe(db, u));
}

/** The Admin page box: how many friends have results, and the newest. */
export function loadProbeSummary(db: Db): ProbeSummary {
  return probeSummary(newest(db));
}

/** The owner's download: one entry per friend, the probe section as it is in the file. */
export function loadProbeFile(db: Db, now: number): ProbeFile {
  const names = displayNames(db);
  const entries = newest(db).flatMap((u) => {
    const probe = probeOf(db, u.id);
    if (probe === undefined) return [];
    return [probeEntry(u, names.get(battleTagKey(u.uploadedBy)) ?? battleTagName(u.uploadedBy), probe)];
  });
  return probeFile(entries, now);
}
