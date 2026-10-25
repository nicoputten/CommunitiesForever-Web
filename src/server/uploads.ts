import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { asc, eq } from "drizzle-orm";
import { diff, type UploadSummary } from "@/core/diff";
import { LuaParseError, parseLua } from "@/core/lua";
import { canonical, merge } from "@/core/merge";
import type { Character, Dataset, Person, PresenceLink, Sighting } from "@/core/model";
import { dict, normalize, NormalizeError } from "@/core/normalize";
import type { Db } from "./db";
import { characters, locations, meta, people, presence, uploads } from "./db/schema";

// The upload service (docs/ARCHITECTURE.md "Data flow"): raw uploads are stored first and are the source of truth;
// the derived tables hold the merge of all ok uploads and can be rebuilt from them at any time.

/** Larger files are refused and not stored. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export class UploadTooLargeError extends Error {
  constructor(readonly size: number) {
    super(`The file is ${size} bytes; the limit is ${MAX_UPLOAD_BYTES} bytes.`);
    this.name = "UploadTooLargeError";
  }
}

export interface UploadResult {
  id: number;
  status: "ok" | "rejected";
  /** The same file was uploaded before: nothing changed, this is the earlier upload's result. */
  duplicate: boolean;
  reason?: string;
  summary?: UploadSummary;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Read = { ok: true; data: Dataset } | { ok: false; reason: string; schemaVersion?: number };

function read(bytes: Uint8Array): Read {
  try {
    return { ok: true, data: normalize(parseLua(new TextDecoder().decode(bytes))) };
  } catch (e) {
    if (e instanceof LuaParseError) return { ok: false, reason: e.message };
    if (e instanceof NormalizeError) return { ok: false, reason: e.message, schemaVersion: e.schemaVersion };
    throw e;
  }
}

/**
 * Stores an uploaded SavedVariables file and merges it into the derived tables, all in one transaction.
 * A file that does not parse or normalize is stored as rejected with its reason and changes nothing else.
 * The same file again (same SHA-256) is a no-op that returns the earlier result.
 */
export function upload(db: Db, file: Uint8Array, user: string, now = Math.floor(Date.now() / 1000)): UploadResult {
  if (file.byteLength > MAX_UPLOAD_BYTES) throw new UploadTooLargeError(file.byteLength);
  const sha256 = createHash("sha256").update(file).digest("hex");
  const known = findBySha(db, sha256);
  if (known !== undefined) return known;

  const result = read(file);
  return db.transaction((tx) => {
    const again = findBySha(tx, sha256);
    if (again !== undefined) return again;

    const { id } = tx
      .insert(uploads)
      .values({
        uploadedAt: now,
        uploadedBy: user,
        sha256,
        size: file.byteLength,
        raw: gzipSync(file),
        schemaVersion: result.ok ? result.data.schemaVersion : result.schemaVersion,
        status: result.ok ? "ok" : "rejected",
        reason: result.ok ? null : result.reason,
      })
      .returning({ id: uploads.id })
      .get();
    if (!result.ok) return { id, status: "rejected", duplicate: false, reason: result.reason };

    const before = loadState(tx);
    const after = before === undefined ? result.data : merge(before.data, result.data);
    const summary = diff(before?.data, after);
    writeState(tx, after, sourcesFor(before, after, id));
    tx.update(uploads).set({ summary }).where(eq(uploads.id, id)).run();
    return { id, status: "ok", duplicate: false, summary };
  });
}

function findBySha(db: Db | Tx, sha256: string): UploadResult | undefined {
  const row = db
    .select({ id: uploads.id, status: uploads.status, reason: uploads.reason, summary: uploads.summary })
    .from(uploads)
    .where(eq(uploads.sha256, sha256))
    .get();
  if (row === undefined) return undefined;
  const result: UploadResult = { id: row.id, status: row.status, duplicate: true };
  if (row.reason !== null) result.reason = row.reason;
  if (row.summary !== null) result.summary = row.summary;
  return result;
}

export interface RebuildResult {
  ok: number;
  rejected: number;
}

/**
 * Recomputes the derived tables, and each upload's status, reason and summary, from all stored uploads in upload
 * order. Rejected uploads are read again too: after a site update a file with a newer schema may now be ok.
 */
export function rebuild(db: Db): RebuildResult {
  return db.transaction((tx) => {
    const ids = tx.select({ id: uploads.id }).from(uploads).orderBy(asc(uploads.id)).all();
    let state: State | undefined;
    const counts: RebuildResult = { ok: 0, rejected: 0 };
    for (const { id } of ids) {
      const row = tx.select({ raw: uploads.raw }).from(uploads).where(eq(uploads.id, id)).get();
      if (row === undefined) continue;
      const result = read(gunzipSync(row.raw));
      if (!result.ok) {
        counts.rejected++;
        tx.update(uploads)
          .set({
            status: "rejected",
            reason: result.reason,
            schemaVersion: result.schemaVersion ?? null,
            summary: null,
          })
          .where(eq(uploads.id, id))
          .run();
        continue;
      }
      counts.ok++;
      const after = state === undefined ? result.data : merge(state.data, result.data);
      const summary = diff(state?.data, after);
      state = { data: after, ...sourcesFor(state, after, id) };
      tx.update(uploads)
        .set({ status: "ok", reason: null, schemaVersion: result.data.schemaVersion, summary })
        .where(eq(uploads.id, id))
        .run();
    }
    clearState(tx);
    if (state !== undefined) writeState(tx, state.data, state);
    return counts;
  });
}

// --- derived state -------------------------------------------------------------------------------------------

/** Upload each current character copy and sighting came from. */
interface Sources {
  characterSources: Map<string, number>;
  locationSources: Map<string, number>;
}

interface State extends Sources {
  data: Dataset;
}

/** A copy unchanged by this upload keeps its source; anything new or changed came from this upload. */
function sourcesFor(before: State | undefined, after: Dataset, uploadId: number): Sources {
  const characterSources = new Map<string, number>();
  for (const [guid, c] of Object.entries(after.characters)) {
    const old = before?.data.characters[guid];
    const source = before?.characterSources.get(guid);
    const same = old !== undefined && source !== undefined && canonical(old) === canonical(c);
    characterSources.set(guid, same ? source : uploadId);
  }
  const locationSources = new Map<string, number>();
  for (const [guid, s] of Object.entries(after.locations)) {
    const old = before?.data.locations[guid];
    const source = before?.locationSources.get(guid);
    const same = old !== undefined && source !== undefined && old.seenAt === s.seenAt && old.zone === s.zone;
    locationSources.set(guid, same ? source : uploadId);
  }
  return { characterSources, locationSources };
}

/** The merged state from the derived tables; undefined before the first ok upload. */
export function loadState(db: Db | Tx): State | undefined {
  const top = db.select().from(meta).where(eq(meta.id, 1)).get();
  if (top === undefined) return undefined;

  const data: Dataset = {
    ...top.data,
    community: { ...top.data.community },
    people: dict<Person>(),
    characters: dict<Character>(),
    locations: dict<Sighting>(),
    presence: dict<PresenceLink>(),
  };
  const characterSources = new Map<string, number>();
  const locationSources = new Map<string, number>();
  // Maps are rebuilt without prototype (as normalize makes them); JSON gives plain objects.
  for (const row of db.select().from(people).all()) {
    data.people[row.key] = { ...row.data, removed: Object.assign(dict<number>(), row.data.removed) };
  }
  for (const row of db.select().from(characters).all()) {
    data.characters[row.guid] = row.data;
    if (row.sourceUpload !== null) characterSources.set(row.guid, row.sourceUpload);
  }
  for (const row of db.select().from(locations).all()) {
    data.locations[row.guid] = { zone: row.zone, seenAt: row.seenAt };
    if (row.sourceUpload !== null) locationSources.set(row.guid, row.sourceUpload);
  }
  for (const row of db.select().from(presence).all()) {
    data.presence[row.guid] = { battleTag: row.battleTag, lastSeen: row.lastSeen };
  }
  return { data, characterSources, locationSources };
}

function clearState(tx: Tx): void {
  tx.delete(characters).run();
  tx.delete(locations).run();
  tx.delete(presence).run();
  tx.delete(people).run();
  tx.delete(meta).run();
}

/** SQLite limits bound variables per statement; insert in slices. */
function insertAll<T>(rows: T[], insert: (slice: T[]) => void): void {
  for (let i = 0; i < rows.length; i += 200) insert(rows.slice(i, i + 200));
}

function writeState(tx: Tx, data: Dataset, sources: Sources): void {
  clearState(tx);
  const { people: ps, characters: cs, locations: ls, presence: pr, ...top } = data;
  tx.insert(meta).values({ id: 1, data: top }).run();
  insertAll(Object.entries(ps), (slice) =>
    tx
      .insert(people)
      .values(slice.map(([key, p]) => ({ key, data: p })))
      .run(),
  );
  insertAll(Object.entries(cs), (slice) =>
    tx
      .insert(characters)
      .values(
        slice.map(([guid, c]) => ({
          guid,
          owner: c.owner ?? null,
          updatedAt: c.updatedAt ?? null,
          sourceUpload: sources.characterSources.get(guid) ?? null,
          via: (c.owner !== undefined ? ps[c.owner]?.via : undefined) ?? null,
          data: c,
        })),
      )
      .run(),
  );
  insertAll(Object.entries(ls), (slice) =>
    tx
      .insert(locations)
      .values(
        slice.map(([guid, s]) => ({
          guid,
          zone: s.zone,
          seenAt: s.seenAt,
          sourceUpload: sources.locationSources.get(guid) ?? null,
        })),
      )
      .run(),
  );
  insertAll(Object.entries(pr), (slice) =>
    tx
      .insert(presence)
      .values(slice.map(([guid, l]) => ({ guid, battleTag: l.battleTag, lastSeen: l.lastSeen })))
      .run(),
  );
}
