import {
  classInfo,
  professionInfo,
  raceInfo,
  resolveZone,
  rulesetOf,
  type ClassFile,
  type DungeonInfo,
  type Faction,
  type ProfessionKind,
  type Ruleset,
} from "../gamedata";
import map from "../map/zones.json";
import type { Character, Dataset, Person, Quest, TalentTree } from "../model";
import { dataTime, own, viaName } from "../people";
import { daysOld, dataAge, isOld, type DataAge } from "./age";

// The building blocks every view model shares: a person and a character as the screens show them. Everything the
// upload may leave out stays undefined here too; the screens show "—" or leave it out.

export type Role = "tank" | "heal" | "dps";

export interface PersonView {
  key: string;
  displayName: string;
  battleTag?: string;
  isUploader: boolean;
  /** False for a friend without the addon: known only through Battle.net presence. */
  hasAddon: boolean;
  /** When their data was current (see people.ts dataTime); undefined without the addon. */
  dataAt?: number;
  dataAge: DataAge;
  /** Their data is 7 days old or more: amber, "X's data is N days old". */
  old: boolean;
  /** Whole days since dataAt. */
  daysOld?: number;
  /** The friend who relayed their data ("via X"); undefined when it came from them. */
  via?: { key: string; name: string };
}

export interface ProfessionView {
  /** Skill line ID, the key in Character.professions. */
  skillLine: string;
  name: string;
  /** Undefined for a skill line the professions table does not know. */
  kind?: ProfessionKind;
  rank: number;
  /** The cap of the current rank (75, 150, 225, 300), when the addon recorded it. */
  max?: number;
}

export interface SightingView {
  /** The addon's zone text, as is. */
  zoneText: string;
  /** zones.json zone id, "battleground" or "elsewhere" (gamedata resolveZone). */
  zone: string;
  /** The zone's name on the map; for a dungeon the zone it is in ("The Deadmines, Westfall"). */
  zoneName?: string;
  dungeon?: Pick<DungeonInfo, "id" | "name" | "kind">;
  seenAt: number;
  age: DataAge;
}

export interface QuestView extends Quest {
  id: string;
}

export interface CharacterView {
  guid: string;
  /** False for a stub: only the GUID (and owner) is known, from presence or a sighting. */
  hasRecord: boolean;
  /** Full name, never split (CLAUDE.md rule 3). Undefined for a stub. */
  name?: string;
  /** Owner's person key; undefined when nobody is known to own the GUID. */
  owner?: string;
  ownerName?: string;
  classFile?: ClassFile;
  className?: string;
  level?: number;
  raceName?: string;
  faction?: Faction;
  ruleset?: Ruleset;
  role?: Role;
  mainTreeName?: string;
  /** Undefined: show "—". */
  ilvl?: number;
  talents: TalentTree[];
  /** Primary professions first, each group by rank, highest first. */
  professions: ProfessionView[];
  quests: QuestView[];
  lastPlayed?: number;
  updatedAt?: number;
  sighting?: SightingView;
}

/** Drops undefined fields, so views compare and serialize cleanly. */
export function compact<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

const zoneNames = new Map(map.zones.map((z) => [z.id, z.name]));

/** Text order for names: case-insensitive, then exact, so equal input always sorts the same. */
export function compareText(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a.localeCompare(b, "en", { sensitivity: "base" }) || (a < b ? -1 : 1);
}

/** Higher numbers first, missing ones last. */
export function compareDesc(a: number | undefined, b: number | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return b - a;
}

export function personView(d: Dataset, person: Person, now: number): PersonView {
  const view: PersonView = {
    key: person.key,
    displayName: person.displayName,
    isUploader: person.isUploader,
    hasAddon: person.hasRecord,
    dataAge: "unknown",
    old: false,
  };
  if (person.battleTag !== undefined) view.battleTag = person.battleTag;
  const at = dataTime(d, person);
  if (at !== undefined) {
    view.dataAt = at;
    view.dataAge = dataAge(at, now);
    view.old = isOld(at, now);
    view.daysOld = daysOld(at, now);
  }
  if (person.via !== undefined) view.via = { key: person.via, name: viaName(d, person.via) };
  return view;
}

/** All people: the uploader first, then by display name. */
export function peopleViews(d: Dataset, now: number): PersonView[] {
  return Object.values(d.people)
    .map((p) => personView(d, p, now))
    .sort(
      (a, b) =>
        Number(b.isUploader) - Number(a.isUploader) ||
        compareText(a.displayName, b.displayName) ||
        compareText(a.key, b.key),
    );
}

/** The role the addon knows: set by the player, else from talents (WEB-40 fills run slots from it). */
export function characterRole(c: Character): Role | undefined {
  for (const r of [c.role, c.roleOverride, c.autoRole]) {
    if (r === "tank" || r === "heal" || r === "dps") return r;
  }
  return undefined;
}

function faction(c: Character): Faction | undefined {
  if (c.faction === "Alliance" || c.faction === "Horde") return c.faction;
  return raceInfo(c.raceID)?.faction;
}

function professions(c: Character): ProfessionView[] {
  const list: ProfessionView[] = [];
  for (const [skillLine, p] of Object.entries(c.professions)) {
    if (p.rank === undefined) continue;
    const info = professionInfo(skillLine);
    const view: ProfessionView = { skillLine, name: info?.name ?? p.name ?? `Skill line ${skillLine}`, rank: p.rank };
    if (info !== undefined) view.kind = info.kind;
    if (p.max !== undefined) view.max = p.max;
    list.push(view);
  }
  const group = (p: ProfessionView) => (p.kind === "primary" ? 0 : p.kind === "secondary" ? 1 : 2);
  return list.sort((a, b) => group(a) - group(b) || b.rank - a.rank || compareText(a.name, b.name));
}

export function sightingView(zoneText: string, seenAt: number, now: number): SightingView {
  const place = resolveZone(zoneText);
  const view: SightingView = { zoneText: place.text, zone: place.zone, seenAt, age: dataAge(seenAt, now) };
  const zoneName = zoneNames.get(place.zone);
  if (zoneName !== undefined) view.zoneName = zoneName;
  if (place.dungeon !== undefined) {
    view.dungeon = { id: place.dungeon.id, name: place.dungeon.name, kind: place.dungeon.kind };
  }
  return view;
}

export function characterView(d: Dataset, c: Character, now: number): CharacterView {
  const cls = classInfo(c.classFile);
  const sighting = own(d.locations, c.guid);
  return compact({
    guid: c.guid,
    hasRecord: c.hasRecord,
    name: c.name,
    owner: c.owner,
    ownerName: own(d.people, c.owner)?.displayName,
    classFile: cls?.classFile,
    className: cls?.name,
    level: c.level,
    raceName: raceInfo(c.raceID)?.name,
    faction: faction(c),
    ruleset: rulesetOf(c.realm),
    role: characterRole(c),
    mainTreeName: c.mainTreeName,
    ilvl: c.ilvl,
    talents: c.talents.map((t) => ({ ...t })),
    professions: professions(c),
    quests: Object.entries(c.quests)
      .map(([id, q]) => ({ id, ...q }))
      .sort((a, b) => Number(a.id) - Number(b.id) || compareText(a.id, b.id)),
    lastPlayed: c.lastPlayed,
    updatedAt: c.updatedAt,
    sighting: sighting !== undefined ? sightingView(sighting.zone, sighting.seenAt, now) : undefined,
  });
}

/**
 * The characters the screens show: every one with a record, and stubs that were sighted (a friend without the
 * addon seen in a zone: decided by Nico, 2026-10-25). A stub without a sighting tells nothing and is left out.
 */
export function shownCharacters(d: Dataset, now: number): CharacterView[] {
  return Object.values(d.characters)
    .filter((c) => c.hasRecord || own(d.locations, c.guid) !== undefined)
    .map((c) => characterView(d, c, now));
}

/** Characters with a record only: everything but the roll call (stubs have no level, class or professions). */
export function recordCharacters(d: Dataset, now: number): CharacterView[] {
  return Object.values(d.characters)
    .filter((c) => c.hasRecord)
    .map((c) => characterView(d, c, now));
}

/** Level, highest first, then name, then GUID. */
export function byLevel(a: CharacterView, b: CharacterView): number {
  return compareDesc(a.level, b.level) || compareText(a.name, b.name) || compareText(a.guid, b.guid);
}
