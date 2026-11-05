import { battleTagKey, battleTagsOf, fileOwner } from "./access";
import type { LuaChunk } from "./lua";
import type { Dataset, Person } from "./model";
import { dict, entries, field, findGlobal, num, table } from "./normalize";
import { stripEscapes } from "./sanitize";

// Who is in the group (WEB-85). The addon records every Battle.net friend it sees playing Forever and syncs with every
// friend who runs it, so a file names people outside the in-game community. From addon CF-89 on, the file also holds
// the community's members as the uploader's client last saw them (`global.members`, GUID -> { name, seenAt }), the
// roster. Only a roster proves membership, never Battle.net friendship: a BattleTag is a member when one of its
// characters is on the proof (the owner's newest roster, and friends' rosters that are newer). Before the owner's
// first roster (every addon up to v1.2.1) the old rule stays for what the site already had, and a new file makes only
// its own uploader a member, plus whoever a roster proves (docs/ARCHITECTURE.md "Access").

/** The community's members as GUIDs; never empty. */
export type Roster = ReadonlySet<string>;

/** A file's roster and how fresh it is: the newest `seenAt` of its entries, when any has one. */
export interface RosterFile {
  guids: Roster;
  seenAt?: number;
}

/**
 * The file's `global.members`: its GUID keys and newest `seenAt`. Undefined when it has none (every addon up to
 * v1.2.1) or the table is empty: an empty roster would end everyone's membership, so it is never taken as one. Only the
 * keys and `seenAt` are read; either field may be missing, and the name is never parsed (CLAUDE.md rule 3).
 */
export function readRoster(chunk: LuaChunk): RosterFile | undefined {
  const global = findGlobal(chunk);
  const guids = new Set<string>();
  let seenAt: number | undefined;
  for (const [guid, value] of entries(table(field(global, "members")))) {
    const entry = table(value);
    if (guid === "" || entry === undefined) continue;
    guids.add(guid);
    const at = num(entry, "seenAt");
    if (at !== undefined) seenAt = Math.max(seenAt ?? at, at);
  }
  if (guids.size === 0) return undefined;
  return seenAt !== undefined ? { guids, seenAt } : { guids };
}

/**
 * Whether a roster can be trusted: it must hold one of the uploader's own characters in the file. A list the client had
 * not loaded yet, or one of another club, would otherwise end everyone's membership or prove strangers.
 */
export function rosterHoldsUploader(data: Dataset, roster: Roster): boolean {
  if (data.uploader === undefined) return false;
  return Object.values(data.characters).some((c) => c.owner === data.uploader && roster.has(c.guid));
}

/** Person keys with at least one character on the roster (characters' owners after finalize, presence included). */
export function rosterPeople(data: Dataset, roster: Roster): Set<string> {
  const keys = new Set<string>();
  for (const c of Object.values(data.characters)) if (c.owner !== undefined && roster.has(c.guid)) keys.add(c.owner);
  return keys;
}

/**
 * Without the owner's roster yet, who else a file makes a member: every BattleTag in it for the uploads the site had
 * before WEB-85 (`all`), else only its uploader (`self`). Once the owner's roster is there: nobody but the proven
 * (`none`).
 */
export type Fallback = "all" | "self" | "none";

/** The BattleTags an accepted file makes members: those with a character on the proof, and the fallback's. */
export function membersOf(data: Dataset, proof: Roster | undefined, fallback: Fallback): string[] {
  const out = new Map<string, string>();
  const add = (tag: string | undefined) => {
    const clean = tag === undefined ? "" : stripEscapes(tag).trim();
    if (clean.includes("#") && !out.has(battleTagKey(clean))) out.set(battleTagKey(clean), clean);
  };
  if (fallback === "all") battleTagsOf(data).forEach(add);
  if (fallback === "self") add(fileOwner(data));
  if (proof !== undefined) for (const key of rosterPeople(data, proof)) add(data.people[key]?.battleTag);
  return [...out.values()];
}

/** Who the site keeps data of: a person in the merged data, and whether they stay (src/server/uploads.ts decides). */
export type KeepPerson = (person: Person) => boolean;

/**
 * The data without the people `keep` leaves out: their record, their characters (stubs included), presence links and
 * sightings. A character nobody owns stays only when it is on the roster, or always without one. Returns a new
 * Dataset (the input is not changed) and the GUIDs it dropped.
 */
export function onlyMembers(
  data: Dataset,
  keep: KeepPerson,
  roster: Roster | undefined,
): { data: Dataset; dropped: Set<string>; droppedPeople: Set<string> } {
  const people = dict<Person>();
  const droppedPeople = new Set<string>();
  for (const [key, p] of Object.entries(data.people)) {
    if (keep(p)) people[key] = p;
    else droppedPeople.add(key);
  }
  const characters = dict<Dataset["characters"][string]>();
  const dropped = new Set<string>();
  for (const [guid, c] of Object.entries(data.characters)) {
    const stays = c.owner !== undefined ? people[c.owner] !== undefined : roster === undefined || roster.has(guid);
    if (stays) characters[guid] = c;
    else dropped.add(guid);
  }
  const locations = dict<Dataset["locations"][string]>();
  for (const [guid, s] of Object.entries(data.locations)) if (!dropped.has(guid)) locations[guid] = s;
  const presence = dict<Dataset["presence"][string]>();
  for (const [guid, l] of Object.entries(data.presence)) {
    if (!dropped.has(guid) && people[l.battleTag] !== undefined) presence[guid] = l;
  }
  return { data: { ...data, people, characters, locations, presence }, dropped, droppedPeople };
}
