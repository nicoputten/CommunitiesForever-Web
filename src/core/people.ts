import type { Dataset, Person } from "./model";
import { cleanName } from "./sanitize";

// Facts about people that both the upload summary (diff.ts) and the view models (views/) need.

/** A map entry by an untrusted key (a GUID or BattleTag from the upload): own keys only, never Object members. */
export function own<T>(map: Record<string, T>, key: string | undefined): T | undefined {
  return key !== undefined && Object.hasOwn(map, key) ? map[key] : undefined;
}

/**
 * When a person's data was current: their record's version (Unix seconds, set by the owner's addon), else when the
 * uploader's addon received it, else their newest character update. Undefined for someone without a record.
 */
export function dataTime(d: Dataset, person: Person): number | undefined {
  if (!person.hasRecord) return undefined;
  if (person.version !== undefined) return person.version;
  if (person.receivedAt !== undefined) return person.receivedAt;
  let newest: number | undefined;
  for (const c of Object.values(d.characters)) {
    if (c.owner === person.key && c.hasRecord && c.updatedAt !== undefined) newest = Math.max(newest ?? 0, c.updatedAt);
  }
  return newest;
}

/** The friend who relayed a record, by name: `via` is a BattleTag or "member:<guid>" (addon CF-20, CF-28). */
export function viaName(d: Dataset, via: string): string {
  const person = own(d.people, via);
  if (person !== undefined) return person.displayName;
  if (via.startsWith("member:")) {
    const c = own(d.characters, via.slice("member:".length));
    if (c?.name !== undefined) return c.name;
    const owner = own(d.people, c?.owner);
    return owner?.displayName ?? "a community member";
  }
  return cleanName(via.split("#")[0]) ?? "Unknown player";
}
