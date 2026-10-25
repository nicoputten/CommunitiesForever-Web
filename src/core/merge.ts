import type { Dataset, Person } from "./model";
import { dict, finalize } from "./normalize";

// Merges two datasets (the state so far and a new upload, or two uploads) into one. The result does not depend on
// the order: merge(a, b) equals merge(b, a), so a rebuild over all uploads gives the same state as uploading them
// one by one. Same rules as the addon's Merge.lua where it has one:
// - characters: a record beats a stub; between records the newer updatedAt wins
// - locations: newer seenAt wins; presence links: newer lastSeen wins (and decide the owner, in finalize)
// - people: fields of the newer record (version, then receivedAt); removals are kept, the later time per GUID
// - the uploader's own record is the truth for their characters: one it no longer lists is removed at that
//   record's version when the character is not newer than it (a deleted character disappears)
// - community, uploader and version come from the upload whose own record is newer; a community field it lacks
//   comes from the other upload
// Ties fall back to comparing the values themselves, so they are decided the same way in either order.
// Inputs are not changed.

export function merge(a: Dataset, b: Dataset): Dataset {
  const top = pick(
    a,
    b,
    (d) => [d.version ?? 0],
    (d) => [d.uploader, d.community],
  );
  const merged: Dataset = {
    schemaVersion: Math.max(a.schemaVersion, b.schemaVersion),
    version: top.version,
    uploader: top.uploader,
    community: { ...(top === a ? b : a).community, ...top.community },
    people: mergeMaps(a.people, b.people, mergePerson),
    characters: mergeMaps(a.characters, b.characters, (x, y) =>
      pick(x, y, (c) => [c.hasRecord ? 1 : 0, c.updatedAt ?? 0, c.lastPlayed ?? 0]),
    ),
    locations: mergeMaps(a.locations, b.locations, (x, y) => pick(x, y, (s) => [s.seenAt])),
    presence: mergeMaps(a.presence, b.presence, (x, y) => pick(x, y, (l) => [l.lastSeen])),
  };
  if (merged.version === undefined) delete merged.version;
  if (merged.uploader === undefined) delete merged.uploader;

  if (a.uploader !== undefined && a.uploader === b.uploader) {
    const own = merged.people[a.uploader];
    if (own !== undefined) {
      own.removed = Object.assign(dict<number>(), own.removed);
      removeUnlisted(a, b, own);
      removeUnlisted(b, a, own);
    }
  }
  return finalize(merged);
}

/** Characters of the uploader that `other` has and `record`'s own record no longer lists. */
function removeUnlisted(record: Dataset, other: Dataset, own: Person): void {
  const version = record.people[own.key]?.version;
  if (version === undefined) return;
  for (const [guid, c] of Object.entries(other.characters)) {
    if (c.owner !== own.key || !c.hasRecord || (c.updatedAt ?? 0) > version) continue;
    const listed = record.characters[guid];
    if (listed?.owner === own.key && listed.hasRecord) continue;
    own.removed[guid] = Math.max(own.removed[guid] ?? 0, version);
  }
}

function mergePerson(x: Person, y: Person): Person {
  const newer = pick(x, y, (p) => [p.hasRecord ? 1 : 0, p.version ?? 0, p.receivedAt ?? 0]);
  const older = newer === x ? y : x;
  const removed = dict<number>();
  for (const [guid, at] of [...Object.entries(older.removed), ...Object.entries(newer.removed)]) {
    removed[guid] = Math.max(removed[guid] ?? at, at);
  }
  const result: Person = {
    ...newer,
    isUploader: x.isUploader || y.isUploader,
    hasRecord: x.hasRecord || y.hasRecord,
    removed,
  };
  if (result.battleTag === undefined && older.battleTag !== undefined) result.battleTag = older.battleTag;
  if (result.accountId === undefined && older.accountId !== undefined) result.accountId = older.accountId;
  return result;
}

function mergeMaps<T extends object>(
  a: Record<string, T>,
  b: Record<string, T>,
  both: (x: T, y: T) => T,
): Record<string, T> {
  const result = dict<T>();
  for (const [key, x] of Object.entries(a)) result[key] = { ...x };
  for (const [key, y] of Object.entries(b)) {
    const x = result[key];
    result[key] = x === undefined ? { ...y } : { ...both(x, y) };
  }
  return result;
}

/** The value with the higher rank (compared element by element); on a tie the one whose content sorts last. */
function pick<T>(x: T, y: T, rank: (v: T) => number[], content: (v: T) => unknown = (v) => v): T {
  const rx = rank(x);
  const ry = rank(y);
  for (let i = 0; i < rx.length; i++) {
    const dx = rx[i] ?? 0;
    const dy = ry[i] ?? 0;
    if (dx !== dy) return dx > dy ? x : y;
  }
  return canonical(content(x)) >= canonical(content(y)) ? x : y;
}

/** JSON with object keys sorted, so equal values give equal text whatever their key order. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return v;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      Object.defineProperty(sorted, k, {
        value: (v as Record<string, unknown>)[k],
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return sorted;
  });
}
