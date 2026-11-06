import type { LuaChunk, LuaTable, LuaValue } from "./lua";
import type { Character, Dataset, Person, PresenceLink, Profession, Pvp, Quest, Sighting, TalentTree } from "./model";
import { cleanName, stripEscapes } from "./sanitize";

// Reads CommunitiesForeverDB.global (docs/SOURCE-DATA.md) into the internal shape (model.ts). Every field may be
// missing or of the wrong type: such a field is left out, never guessed. Every string loses WoW escapes.
// Tables the addon writes as arrays may come out of the parser as {} when empty, so lists accept both.

/** Highest addon schemaVersion this site reads. */
export const SUPPORTED_SCHEMA = 2;

/**
 * Why a file can't be read (the upload screen shows each, WEB-19): not a CommunitiesForever file at all, one that is
 * broken (doesn't parse, no schemaVersion), or one from a newer addon than the site reads.
 */
export type Unreadable = "not-ledger" | "damaged" | "newer-format";

export class NormalizeError extends Error {
  constructor(
    message: string,
    readonly code: Unreadable,
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

export type Table = LuaTable | LuaValue[];

export function table(value: LuaValue | undefined): Table | undefined {
  return typeof value === "object" && value !== null ? value : undefined;
}

export function field(t: Table | undefined, key: string): LuaValue | undefined {
  if (t === undefined || !Object.prototype.hasOwnProperty.call(t, key)) return undefined;
  return (t as LuaTable)[key];
}

/** Own entries of a table; an array's entries are keyed "1", "2", ... like Lua. */
export function entries(t: Table | undefined): [string, LuaValue][] {
  if (t === undefined) return [];
  if (Array.isArray(t)) return t.map((v, i) => [String(i + 1), v]);
  return Object.entries(t);
}

/** Values of a Lua list, whether it came out as an array or as an object with keys 1..n (or {}), in index order. */
export function list(t: Table | undefined): LuaValue[] {
  if (t === undefined) return [];
  if (Array.isArray(t)) return t;
  return Object.entries(t)
    .filter(([k]) => /^[1-9][0-9]*$/.test(k))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, v]) => v);
}

export function num(t: Table | undefined, key: string): number | undefined {
  const v = field(t, key);
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function str(t: Table | undefined, key: string): string | undefined {
  const v = field(t, key);
  return typeof v === "string" ? stripEscapes(v) : undefined;
}

export function bool(t: Table | undefined, key: string): boolean | undefined {
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
export function findGlobal(chunk: LuaChunk): Table | undefined {
  const db = table(field(chunk.globals, "CommunitiesForeverDB"));
  if (db !== undefined) return table(field(db, "global"));
  return table(chunk.returned);
}

export function normalize(chunk: LuaChunk): Dataset {
  const global = findGlobal(chunk);
  if (global === undefined)
    throw new NormalizeError("This is not a CommunitiesForever SavedVariables file.", "not-ledger");
  const schemaVersion = field(global, "schemaVersion");
  if (typeof schemaVersion !== "number") throw new NormalizeError("The file has no schemaVersion.", "damaged");
  if (schemaVersion > SUPPORTED_SCHEMA) {
    throw new NormalizeError(
      `The file has schema version ${schemaVersion}; this site reads up to ${SUPPORTED_SCHEMA}. Update the site.`,
      "newer-format",
      schemaVersion,
    );
  }
  // Schema 2 (addon CF-47) adds only `pending`, which is read apart (src/core/gameItems.ts): the same reader. A new
  // schema with other changes gets its own reader here; older ones keep theirs.
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
    if (p === undefined) continue;
    const linkType = str(p, "linkType");
    const spec = field(p, "spec");
    professions[id] = compact({
      name: str(p, "name"),
      rank: num(p, "rank"),
      max: num(p, "max"),
      // CF-38 (WEB-90), all optional.
      link: link(str(p, "link")),
      linkType: linkType === "short" || linkType === "long" ? linkType : undefined,
      spec: typeof spec === "number" && Number.isFinite(spec) ? String(spec) : str(p, "spec")?.slice(0, 40),
      scannedAt: num(p, "scannedAt"),
    });
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
    pvp: readPvp(table(field(c, "pvp"))),
    riding: count(c, "riding"),
    recipes: readRecipes(table(field(c, "recipes"))),
    recipesAt: num(c, "recipesAt"),
    recipeLines: readRecipeLines(table(field(c, "recipeLines"))),
    updatedAt: num(c, "updatedAt"),
    lastPlayed: num(c, "lastPlayed"),
  });
}

/** A number the addon only writes as 0 or more (counts, ranks); anything else is left out. */
function count(t: Table | undefined, key: string): number | undefined {
  const v = num(t, key);
  return v !== undefined && v >= 0 ? v : undefined;
}

/** CF-38 (WEB-90): at most this many recipes per character are read (every profession has a few hundred). */
export const MAX_RECIPES = 5000;
/**
 * A profession link (CF-38: the bare `trade:...` payload, no escape sequences) is kept to this length; a long link
 * carries the recipes inside, so it can be long. A longer one is dropped rather than cut (a cut link doesn't open).
 */
const MAX_LINK = 4096;
/** Recipe, item and skill line IDs are positive whole numbers below this (spell IDs pass 1,000,000 on Forever). */
const MAX_ID = 100_000_000;

function id(v: unknown): number | undefined {
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n > 0 && n < MAX_ID ? n : undefined;
}

function link(v: string | undefined): string | undefined {
  return v !== undefined && v !== "" && v.length <= MAX_LINK ? v : undefined;
}

/** `chars.*.recipes` (CF-38): recipe ID -> item ID (0 for none). Anything else is left out. */
function readRecipes(t: Table | undefined): Record<string, number> | undefined {
  if (t === undefined) return undefined;
  const out = dict<number>();
  let read = 0;
  for (const [key, value] of entries(t)) {
    const recipe = id(key);
    if (recipe === undefined || typeof value !== "number") continue;
    const item = value === 0 ? 0 : id(value);
    if (item === undefined) continue;
    out[String(recipe)] = item;
    if (++read >= MAX_RECIPES) break;
  }
  return out;
}

/** `chars.*.recipeLines` (CF-38, optional): recipe ID -> skill line ID. */
function readRecipeLines(t: Table | undefined): Record<string, number> | undefined {
  if (t === undefined) return undefined;
  const out = dict<number>();
  let read = 0;
  for (const [key, value] of entries(t)) {
    const recipe = id(key);
    const line = id(value);
    if (recipe === undefined || line === undefined) continue;
    out[String(recipe)] = line;
    if (++read >= MAX_RECIPES) break;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Highest PvP rank (DOOMSDAY.md "PvP rank titles"). */
const MAX_PVP_RANK = 14;

/** `chars.*.pvp` (CF-52), cleaned as the addon's Pvp.clean: only the expected fields, counts 0 or more. */
function readPvp(t: Table | undefined): Pvp | undefined {
  if (t === undefined) return undefined;
  const rank = count(t, "rank");
  return compact({
    hk: count(t, "hk"),
    rank: rank !== undefined && rank <= MAX_PVP_RANK ? rank : undefined,
    rankName: str(t, "rankName")?.slice(0, 40),
    weekKills: count(t, "weekKills"),
    weekHonor: count(t, "weekHonor"),
    deaths: count(t, "deaths"),
    duelsWon: count(t, "duelsWon"),
    duelsLost: count(t, "duelsLost"),
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

/** The key of an "aid:<accountId>" person, for an account ID. */
export function aidKey(accountId: string): string {
  return `aid:${accountId}`;
}

/** "aid:<accountId>" -> BattleTag key, for every person with a BattleTag whose account ID is known. */
export function linkedAids(d: Dataset): Map<string, string> {
  const links = new Map<string, string>();
  // Sorted, so when two BattleTags claim one account ID (a broken file) the same one wins whatever the order.
  for (const p of Object.values(d.people).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
    if (p.battleTag === undefined || p.accountId === undefined) continue;
    const aid = aidKey(p.accountId);
    if (aid !== p.key && !links.has(aid)) links.set(aid, p.key);
  }
  return links;
}

/**
 * WEB-86: someone known only through the community is stored under "aid:<accountId>" (addon CF-28). Once the data
 * proves their BattleTag (their own upload's `self.battleTag` with `self.accountId`, or a record keyed by BattleTag
 * that carries `aid`), the "aid:" person is merged into the BattleTag, as the addon's Merge.absorb does: their
 * characters move over, the fields of the newer record win (an own display name it lacks comes from the other),
 * removals are kept with the later time.
 */
function absorbAids(d: Dataset): void {
  for (const [aid, key] of linkedAids(d)) {
    const from = d.people[aid];
    const into = d.people[key];
    if (from === undefined || into === undefined || from.battleTag !== undefined) continue;
    const [newer, older] = newerFirst(into, from);
    const removed = dict<number>();
    for (const [guid, at] of [...Object.entries(from.removed), ...Object.entries(into.removed)]) {
      removed[guid] = Math.max(removed[guid] ?? at, at);
    }
    d.people[key] = compact({
      ...newer,
      key,
      battleTag: into.battleTag,
      accountId: into.accountId,
      ownDisplayName: newer.ownDisplayName ?? older.ownDisplayName,
      isUploader: into.isUploader || from.isUploader,
      hasRecord: into.hasRecord || from.hasRecord,
      removed,
    });
    delete d.people[aid];
    for (const c of Object.values(d.characters)) if (c.owner === aid) c.owner = key;
    if (d.uploader === aid) d.uploader = key;
  }
}

/** The newer of two people (a record beats none, then version, then receivedAt; a tie: the first), then the other. */
function newerFirst(a: Person, b: Person): [Person, Person] {
  const ra = [a.hasRecord ? 1 : 0, a.version ?? 0, a.receivedAt ?? 0];
  const rb = [b.hasRecord ? 1 : 0, b.version ?? 0, b.receivedAt ?? 0];
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i]! > rb[i]! ? [a, b] : [b, a];
  return [a, b];
}

/**
 * The name of a person without a display name or BattleTag (an "aid:" key, WEB-86): their first character by name,
 * as the addon shows them (Linker: CF-28, without the online sort the site has no use for). Undefined without a named
 * character.
 */
function firstCharacterName(d: Dataset, key: string): string | undefined {
  let first: string | undefined;
  for (const c of Object.values(d.characters)) {
    if (c.owner !== key || c.name === undefined || c.name.trim() === "") continue;
    if (first === undefined || c.name < first) first = c.name;
  }
  return cleanName(first);
}

/**
 * Derives what follows from the rest, so normalize and merge agree and finalize(finalize(d)) equals finalize(d):
 * - an "aid:" person the data links to a BattleTag is merged into that BattleTag (WEB-86)
 * - a person for every BattleTag in presence (no record: hasRecord false)
 * - character owners: the presence link wins over the record that lists the character (addon rule)
 * - a stub for every GUID in presence or locations without a character
 * - characters an owner removed, not newer than the removal, are left out
 * - display names
 */
export function finalize(d: Dataset): Dataset {
  absorbAids(d);
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
    p.displayName = p.ownDisplayName ?? battleTagName(p.battleTag) ?? firstCharacterName(d, p.key) ?? "Unknown player";
  }
  return d;
}
