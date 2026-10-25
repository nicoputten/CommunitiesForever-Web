import type { Character, Dataset } from "./model";

// What changed between two states (before and after an upload), for the upload result and history (WEB-08).
// Only gains are listed: a level or rank that went down (a corrected record) is not news.

export interface CharacterRef {
  guid: string;
  owner?: string;
  name?: string;
}

export interface UploadSummary {
  /** People not known before (with or without a record). */
  newPeople: { key: string; displayName: string }[];
  /** GUIDs not known before, and stubs that now have a record. */
  newCharacters: (CharacterRef & { hasRecord: boolean; level?: number; classFile?: string })[];
  /** Characters known before and gone now (removed by their owner). */
  removedCharacters: CharacterRef[];
  levelUps: (CharacterRef & { from: number; to: number })[];
  /** A profession learned (from undefined) or a higher rank. Keyed by skill line ID. */
  professionGains: (CharacterRef & { skillLine: string; profession?: string; from?: number; to: number })[];
  /** A sighting newer than the one before (or the first one). */
  sightings: (CharacterRef & { zone: string; seenAt: number; previousZone?: string })[];
}

function ref(c: Character): CharacterRef {
  const r: CharacterRef = { guid: c.guid };
  if (c.owner !== undefined) r.owner = c.owner;
  if (c.name !== undefined) r.name = c.name;
  return r;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byGuid<T extends { guid: string }>(list: T[]): T[] {
  return list.sort((a, b) => compare(a.guid, b.guid));
}

/** The changes from `before` (undefined: nothing stored yet) to `after`. */
export function diff(before: Dataset | undefined, after: Dataset): UploadSummary {
  const summary: UploadSummary = {
    newPeople: [],
    newCharacters: [],
    removedCharacters: [],
    levelUps: [],
    professionGains: [],
    sightings: [],
  };

  for (const [key, p] of Object.entries(after.people)) {
    if (before?.people[key] === undefined) summary.newPeople.push({ key, displayName: p.displayName });
  }
  summary.newPeople.sort((a, b) => compare(a.key, b.key));

  for (const [guid, c] of Object.entries(after.characters)) {
    const old = before?.characters[guid];
    if (old === undefined || (!old.hasRecord && c.hasRecord)) {
      const entry: UploadSummary["newCharacters"][number] = { ...ref(c), hasRecord: c.hasRecord };
      if (c.level !== undefined) entry.level = c.level;
      if (c.classFile !== undefined) entry.classFile = c.classFile;
      summary.newCharacters.push(entry);
    }
    if (old === undefined) continue;

    if (old.level !== undefined && c.level !== undefined && c.level > old.level) {
      summary.levelUps.push({ ...ref(c), from: old.level, to: c.level });
    }
    for (const [skillLine, p] of Object.entries(c.professions)) {
      if (p.rank === undefined) continue;
      const was = old.professions[skillLine];
      if (was !== undefined && was.rank !== undefined && was.rank >= p.rank) continue;
      if (was !== undefined && was.rank === undefined) continue;
      const gain: UploadSummary["professionGains"][number] = { ...ref(c), skillLine, to: p.rank };
      if (p.name !== undefined) gain.profession = p.name;
      if (was?.rank !== undefined) gain.from = was.rank;
      summary.professionGains.push(gain);
    }
  }

  for (const [guid, c] of Object.entries(before?.characters ?? {})) {
    if (after.characters[guid] === undefined) summary.removedCharacters.push(ref(c));
  }

  for (const [guid, s] of Object.entries(after.locations)) {
    const old = before?.locations[guid];
    if (old !== undefined && old.seenAt >= s.seenAt) continue;
    const c = after.characters[guid];
    const sighting: UploadSummary["sightings"][number] = {
      ...(c !== undefined ? ref(c) : { guid }),
      zone: s.zone,
      seenAt: s.seenAt,
    };
    if (old !== undefined) sighting.previousZone = old.zone;
    summary.sightings.push(sighting);
  }

  byGuid(summary.newCharacters);
  byGuid(summary.removedCharacters);
  byGuid(summary.levelUps);
  summary.professionGains.sort((a, b) => compare(a.guid, b.guid) || Number(a.skillLine) - Number(b.skillLine));
  byGuid(summary.sightings);
  return summary;
}
