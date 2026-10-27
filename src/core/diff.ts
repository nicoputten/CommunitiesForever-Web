import type { Character, Dataset, Person } from "./model";
import { dataTime, viaName } from "./people";

// What changed between two states (before and after an upload), for the upload result and history (WEB-08), and
// the session report (board `upload-report`, WEB-14). Only gains are listed: a level, rank or item level that went
// down (a corrected record) is not news.

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
  professionGains: (CharacterRef & {
    skillLine: string;
    profession?: string;
    from?: number;
    to: number;
    /** The cap of the rank, when the addon recorded it. */
    max?: number;
    /** "Cap reached": the rank went up to its cap. */
    capReached: boolean;
  })[];
  itemLevelGains: (CharacterRef & { from: number; to: number })[];
  /** A sighting newer than the one before (or the first one). */
  sightings: (CharacterRef & { zone: string; seenAt: number; previousZone?: string })[];
  /** Who sent data ("Femke · 1 h", "Jorrit · nothing new", "Sanne · no addon"), per person in the new state. */
  senders: Sender[];
  /** The report header. */
  counts: {
    /** Levels gained, summed over all level ups ("5 levels gained"). */
    levelsGained: number;
    skillGains: number;
    itemLevelGains: number;
    newCharacters: number;
    sightings: number;
    /** People whose data is newer than before ("new data from 4 friends"), the uploader included. */
    peopleWithNewData: number;
  };
}

export type SenderStatus = "newer" | "unchanged" | "noAddon";

export interface Sender {
  key: string;
  displayName: string;
  isUploader: boolean;
  /** newer: their record is newer than before (or new); unchanged: nothing new; noAddon: no record at all. */
  status: SenderStatus;
  /** When their data was current (people.ts dataTime): the report shows its age at upload time. */
  dataAt?: number;
  /** The friend who relayed their record, and that friend's name ("via Bob"). */
  via?: string;
  viaName?: string;
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

/** Version, then receivedAt: a higher rank is newer data from that person. */
function isNewer(now: Person, was: Person | undefined): boolean {
  if (!now.hasRecord) return false;
  if (was === undefined || !was.hasRecord) return true;
  if ((now.version ?? 0) !== (was.version ?? 0)) return (now.version ?? 0) > (was.version ?? 0);
  return (now.receivedAt ?? 0) > (was.receivedAt ?? 0);
}

const STATUS_ORDER: Record<SenderStatus, number> = { newer: 0, unchanged: 1, noAddon: 2 };

function senders(before: Dataset | undefined, after: Dataset): Sender[] {
  const list: Sender[] = [];
  for (const [key, p] of Object.entries(after.people)) {
    const was = before !== undefined && Object.hasOwn(before.people, key) ? before.people[key] : undefined;
    const sender: Sender = {
      key,
      displayName: p.displayName,
      isUploader: p.isUploader,
      status: !p.hasRecord ? "noAddon" : isNewer(p, was) ? "newer" : "unchanged",
    };
    const at = dataTime(after, p);
    if (at !== undefined) sender.dataAt = at;
    if (p.via !== undefined) {
      sender.via = p.via;
      sender.viaName = viaName(after, p.via);
    }
    list.push(sender);
  }
  return list.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      Number(b.isUploader) - Number(a.isUploader) ||
      (b.dataAt ?? 0) - (a.dataAt ?? 0) ||
      compare(a.displayName, b.displayName) ||
      compare(a.key, b.key),
  );
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
    itemLevelGains: [],
    sightings: [],
    senders: senders(before, after),
    counts: { levelsGained: 0, skillGains: 0, itemLevelGains: 0, newCharacters: 0, sightings: 0, peopleWithNewData: 0 },
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
    if (old.ilvl !== undefined && c.ilvl !== undefined && c.ilvl > old.ilvl) {
      summary.itemLevelGains.push({ ...ref(c), from: old.ilvl, to: c.ilvl });
    }
    for (const [skillLine, p] of Object.entries(c.professions)) {
      if (p.rank === undefined) continue;
      const was = old.professions[skillLine];
      if (was !== undefined && was.rank !== undefined && was.rank >= p.rank) continue;
      if (was !== undefined && was.rank === undefined) continue;
      const gain: UploadSummary["professionGains"][number] = {
        ...ref(c),
        skillLine,
        to: p.rank,
        capReached: p.max !== undefined && p.rank >= p.max,
      };
      if (p.name !== undefined) gain.profession = p.name;
      if (was?.rank !== undefined) gain.from = was.rank;
      if (p.max !== undefined) gain.max = p.max;
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
  byGuid(summary.itemLevelGains);
  byGuid(summary.sightings);

  summary.counts = {
    levelsGained: summary.levelUps.reduce((sum, l) => sum + (l.to - l.from), 0),
    skillGains: summary.professionGains.length,
    itemLevelGains: summary.itemLevelGains.length,
    newCharacters: summary.newCharacters.length,
    sightings: summary.sightings.length,
    peopleWithNewData: summary.senders.filter((s) => s.status === "newer").length,
  };
  return summary;
}
