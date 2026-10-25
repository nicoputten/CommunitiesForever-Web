import type { LuaChunk, LuaTable, LuaValue } from "./lua";
import type { Character, Dataset, Person, PresenceLink, Profession, Quest, Sighting, TalentTree } from "./model";
import { cleanName, stripEscapes } from "./sanitize";

// Reads CommunitiesForeverDB.global (docs/SOURCE-DATA.md) into the internal shape (model.ts). Every field may be
// missing or of the wrong type: such a field is left out, never guessed. Every string loses WoW escapes.
// Tables the addon writes as arrays may come out of the parser as {} when empty, so lists accept both.

/** Highest addon schemaVersion this site reads. */
export const SUPPORTED_SCHEMA = 1;

export class NormalizeError extends Error {
  constructor(
    message: string,
    /** The file's schemaVersion, when it has one. */
    readonly schemaVersion?: number,
  ) {
    super(message);
    this.name = "NormalizeError";
  }
}

/** Maps keyed by addon data (GUIDs, BattleTags, IDs) have no prototype, so no key collides with Object members. */
export function dict<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

// --- reading untrusted values -------------------------------------------------------------------------------

type Table = LuaTable | LuaValue[];

function table(value: LuaValue | undefined): Table | undefined {
  return typeof value === "object" && value !== null ? value : undefined;
}

function field(t: Table | undefined, key: string): LuaValue | undefined {
  if (t === undefined || !Object.prototype.hasOwnProperty.call(t, key)) return undefined;
  return (t as LuaTable)[key];
}

/** Own entries of a table; an array's entries are keyed "1", "2", ... like Lua. */
function entries(t: Table | undefined): [string, LuaValue][] {
  if (t === undefined) return [];
  if (Array.isArray(t)) return t.map((v, i) => [String(i + 1), v]);
  return Object.entries(t);
}

/** Values of a Lua list, whether it came out as an array or as an object with keys 1..n (or {}), in index order. */
function list(t: Table | undefined): LuaValue[] {
  if (t === undefined) return [];
  if (Array.isArray(t)) return t;
  return Object.entries(t)
    .filter(([k]) => /^[1-9][0-9]*$/.test(k))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, v]) => v);
}

function num(t: Table | undefined, key: string): number | undefined {
  const v = field(t, key);
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(t: Table | undefined, key: string): string | undefined {
  const v = field(t, key);
  return typeof v === "string" ? stripEscapes(v) : undefined;
}

function bool(t: Table | undefined, key: string): boolean | undefined {
  const v = field(t, key);
  return typeof v === "boolean" ? v : undefined;
}

/** Drops undefined fields so results compare and serialize cleanly. */
function compact<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

// --- normalize -----------------------------------------------------------------------------------------------

/** The `global` table: from `CommunitiesForeverDB = {...}` as the game writes it, or a fixture's `return {...}`. */
function findGlobal(chunk: LuaChunk): Table | undefined {
  const db = table(field(chunk.globals, "CommunitiesForeverDB"));
  if (db !== undefined) return table(field(db, "global"));
  return table(chunk.returned);
}

export function normalize(chunk: LuaChunk): Dataset {
  const global = findGlobal(chunk);
  if (global === undefined) throw new NormalizeError("This is not a CommunitiesForever SavedVariables file.");
  const schemaVersion = field(global, "schemaVersion");
  if (typeof schemaVersion !== "number") throw new NormalizeError("The file has no schemaVersion.");
  if (schemaVersion > SUPPORTED_SCHEMA) {
    throw new NormalizeError(
      `The file has schema version ${schemaVersion}; this site reads up to ${SUPPORTED_SCHEMA}. Update the site.`,
      schemaVersion,
    );
  }
  // Schema 1 is the only one so far. A new schema gets its own reader here; older ones keep theirs.
  return readSchema1(global, schemaVersion);
}

function readSchema1(global: Table, schemaVersion: number): Dataset {
  const people = dict<Person>();
  const characters = dict<Character>();

  const self = table(field(global, "self"));
  const selfBattleTag = str(self, "battleTag");
  const selfAccountId = str(self, "accountId");
  const uploader =
    selfBattleTag ??
    (selfAccountId !== undefined ? `aid:${selfAccountId}` : self !== undefined ? "uploader" : undefined);
  if (self !== undefined && uploader !== undefined) {
    people[uploader] = person(uploader, {
      battleTag: selfBattleTag,
      accountId: selfAccountId,
      ownDisplayName: cleanName(field(self, "displayName")),
      isUploader: true,
      hasRecord: true,
      version: num(self, "version"),
    });
    readChars(table(field(self, "chars")), uploader, characters);
  }

  for (const [key, value] of entries(table(field(global, "people")))) {
    const record = table(value);
    if (record === undefined || key === uploader) continue;
    const isAid = key.startsWith("aid:");
    const removed = dict<number>();
    for (const [guid, at] of entries(table(field(record, "removed")))) {
      if (typeof at === "number" && Number.isFinite(at)) removed[guid] = at;
    }
    people[key] = person(key, {
      battleTag: isAid ? undefined : stripEscapes(key),
      accountId: str(record, "aid") ?? (isAid ? key.slice(4) : undefined),
      ownDisplayName: cleanName(field(record, "displayName")),
      isUploader: false,
      hasRecord: true,
      version: num(record, "version"),
      receivedAt: num(record, "receivedAt"),
      via: str(record, "via"),
      removed,
    });
    readChars(table(field(record, "chars")), key, characters);
  }

  const presence = dict<PresenceLink>();
  for (const [guid, value] of entries(table(field(global, "presence")))) {
    const link = table(value);
    const battleTag = field(link, "battleTag");
    const lastSeen = num(link, "lastSeen");
    if (typeof battleTag === "string" && lastSeen !== undefined) presence[guid] = { battleTag, lastSeen };
  }

  const locations = dict<Sighting>();
  for (const [guid, value] of entries(table(field(global, "locations")))) {
    const sighting = table(value);
    const zone = str(sighting, "zone");
    const seenAt = num(sighting, "seenAt");
    if (zone !== undefined && seenAt !== undefined) locations[guid] = { zone, seenAt };
  }

  const settings = table(field(global, "settings"));
  const clubId = field(settings, "clubId");
  const dataset: Dataset = {
    schemaVersion,
    version: num(self, "version"),
    uploader,
    community: compact({
      // A number in real files, a string in the addon fixtures.
      id: typeof clubId === "number" || typeof clubId === "string" ? String(clubId) : undefined,
      name: str(settings, "clubName"),
    }),
    people,
    characters,
    locations,
    presence,
  };
  return finalize(compact(dataset));
}

function person(
  key: string,
  fields: Omit<Person, "key" | "displayName" | "removed"> & { removed?: Person["removed"] },
) {
  return compact({ key, displayName: "", ...fields, removed: fields.removed ?? dict<number>() });
}

function readChars(chars: Table | undefined, owner: string, into: Record<string, Character>): void {
  for (const [guid, value] of entries(chars)) {
    const c = table(value);
    if (c !== undefined) into[guid] = readChar(guid, owner, c);
  }
}

function readChar(guid: string, owner: string, c: Table): Character {
  const professions = dict<Profession>();
  for (const [id, value] of entries(table(field(c, "professions")))) {
    const p = table(value);
    if (p !== undefined) professions[id] = compact({ name: str(p, "name"), rank: num(p, "rank"), max: num(p, "max") });
  }
  const quests = dict<Quest>();
  for (const [id, value] of entries(table(field(c, "quests")))) {
    const q = table(value);
    if (q !== undefined) {
      quests[id] = compact({ title: str(q, "title"), area: str(q, "area"), dungeon: bool(q, "dungeon") });
    }
  }
  const talents: TalentTree[] = list(table(field(c, "talents"))).map((t) =>
    compact({ name: str(table(t), "name"), points: num(table(t), "points") }),
  );

  // mainTree is the index of the tree with the most points (addon Talents.lua). Accept a tree name as well.
  let mainTree = num(c, "mainTree");
  let mainTreeName: string | undefined;
  if (mainTree !== undefined) {
    mainTreeName = talents[mainTree - 1]?.name;
  } else if (typeof field(c, "mainTree") === "string") {
    mainTreeName = str(c, "mainTree");
    const index = talents.findIndex((t) => t.name === mainTreeName);
    mainTree = index >= 0 ? index + 1 : undefined;
  }

  return compact({
    guid,
    owner,
    hasRecord: true,
    name: str(c, "name"),
    classFile: str(c, "classFile"),
    raceID: num(c, "raceID"),
    level: num(c, "level"),
    faction: str(c, "faction"),
    realm: str(c, "realm"),
    ilvl: num(c, "ilvl"),
    professions,
    talents,
    mainTree,
    mainTreeName,
    role: str(c, "role"),
    autoRole: str(c, "autoRole"),
    roleOverride: str(c, "roleOverride"),
    quests,
    updatedAt: num(c, "updatedAt"),
    lastPlayed: num(c, "lastPlayed"),
  });
}

// --- finalize (shared with merge) ----------------------------------------------------------------------------

function stub(guid: string, owner: string | undefined): Character {
  return compact({
    guid,
    owner,
    hasRecord: false,
    professions: dict<Profession>(),
    talents: [],
    quests: dict<Quest>(),
  });
}

/** BattleTag name part (before '#'), as the addon shows people without a display name. */
function battleTagName(battleTag: string | undefined): string | undefined {
  return cleanName(battleTag?.split("#")[0]);
}

/**
 * Derives what follows from the rest, so normalize and merge agree and finalize(finalize(d)) equals finalize(d):
 * - a person for every BattleTag in presence (no record: hasRecord false)
 * - character owners: the presence link wins over the record that lists the character (addon rule)
 * - a stub for every GUID in presence or locations without a character
 * - characters an owner removed, not newer than the removal, are left out
 * - display names
 */
export function finalize(d: Dataset): Dataset {
  for (const { battleTag } of Object.values(d.presence)) {
    if (d.people[battleTag] === undefined) {
      d.people[battleTag] = person(battleTag, {
        battleTag: stripEscapes(battleTag),
        isUploader: false,
        hasRecord: false,
      });
    }
  }

  for (const guid of [...Object.keys(d.presence), ...Object.keys(d.locations)]) {
    const owner = d.presence[guid]?.battleTag;
    const removed = owner !== undefined && d.people[owner]?.removed[guid] !== undefined;
    if (d.characters[guid] === undefined && !removed) d.characters[guid] = stub(guid, owner);
  }
  for (const [guid, c] of Object.entries(d.characters)) {
    const link = d.presence[guid];
    if (link !== undefined) c.owner = link.battleTag;
  }

  for (const [guid, c] of Object.entries(d.characters)) {
    const removedAt = c.owner !== undefined ? d.people[c.owner]?.removed[guid] : undefined;
    if (removedAt !== undefined && (c.updatedAt ?? 0) <= removedAt) delete d.characters[guid];
  }

  for (const p of Object.values(d.people)) {
    p.displayName = p.ownDisplayName ?? battleTagName(p.battleTag) ?? "Unknown player";
  }
  return d;
}
