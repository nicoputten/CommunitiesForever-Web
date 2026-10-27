import type { Dataset } from "./model";
import {
  byLevel,
  type CharacterView,
  compareText,
  peopleViews,
  recordCharacters,
  shownCharacters,
} from "./views/characters";

// The bot's look-ups (WEB-39b, docs/BOT-API.md "Look-ups"): what the commands of the `bot-commands-runs` board show,
// as data; the bot formats it. Full character names, display names for friends, never BattleTags (CLAUDE.md rule 7).
// Pure: the merged dataset and "now" come in as arguments.

export interface LookupCharacter {
  guid: string;
  name: string;
  /** The owner's display name. */
  owner?: string;
  classFile?: string;
  className?: string;
  race?: string;
  level?: number;
  role?: "tank" | "heal" | "dps";
  spec?: string;
  ilvl?: number;
  /** Points per talent tree, in game order ("10/0/20" on the board). */
  talents?: number[];
  professions: { name: string; rank: number; max?: number }[];
  /** Where the addon last saw it: the zone's name on the map (or the addon's text) and when. */
  seen?: { zone: string; at: number };
}

export function lookupCharacter(c: CharacterView): LookupCharacter {
  const out: LookupCharacter = {
    guid: c.guid,
    name: c.name ?? "Unknown character",
    professions: c.professions.map((p) =>
      p.max !== undefined ? { name: p.name, rank: p.rank, max: p.max } : { name: p.name, rank: p.rank },
    ),
  };
  if (c.ownerName !== undefined) out.owner = c.ownerName;
  if (c.classFile !== undefined) out.classFile = c.classFile;
  if (c.className !== undefined) out.className = c.className;
  if (c.raceName !== undefined) out.race = c.raceName;
  if (c.level !== undefined) out.level = c.level;
  if (c.role !== undefined) out.role = c.role;
  if (c.mainTreeName !== undefined) out.spec = c.mainTreeName;
  if (c.ilvl !== undefined) out.ilvl = c.ilvl;
  if (c.talents.length > 0) out.talents = c.talents.map((t) => t.points ?? 0);
  if (c.sighting !== undefined) {
    out.seen = { zone: c.sighting.dungeon?.name ?? c.sighting.zoneName ?? c.sighting.zoneText, at: c.sighting.seenAt };
  }
  return out;
}

const bySeen = (a: CharacterView, b: CharacterView) =>
  (b.sighting?.seenAt ?? -1) - (a.sighting?.seenAt ?? -1) || byLevel(a, b);

/** A friend by display name (as the bot's autocomplete offers them), ignoring case; undefined when unknown. */
export function friendByName(d: Dataset, name: string, now: number): { key: string; name: string } | undefined {
  const wanted = name.trim().toLowerCase();
  const person = peopleViews(d, now).find((p) => p.displayName.toLowerCase() === wanted);
  return person === undefined ? undefined : { key: person.key, name: person.displayName };
}

/** `/whereis friend`: the friend's characters by last sighting, newest first; the newest sighted one gets the card. */
export function whereisFriend(d: Dataset, friendKey: string, now: number) {
  const chars = shownCharacters(d, now)
    .filter((c) => c.owner === friendKey && c.name !== undefined)
    .sort(bySeen);
  const card = chars.find((c) => c.sighting !== undefined)?.guid;
  return { characters: chars.map(lookupCharacter), ...(card !== undefined ? { card } : {}) };
}

/** A character by GUID (the autocomplete's value) or full name; undefined when unknown. */
export function findCharacter(d: Dataset, guidOrName: string, now: number): CharacterView | undefined {
  const chars = shownCharacters(d, now).filter((c) => c.name !== undefined);
  return (
    chars.find((c) => c.guid === guidOrName) ??
    chars.find((c) => c.name!.toLowerCase() === guidOrName.trim().toLowerCase())
  );
}

export interface WhoQuery {
  minLevel?: number;
  maxLevel?: number;
  role?: "tank" | "heal" | "dps";
  classFile?: string;
  /** Only characters seen within this many seconds. */
  seenWithin?: number;
}

/** `/who`: characters matching the filters, highest level first; at most `limit`. */
export function who(d: Dataset, q: WhoQuery, now: number, limit = 15) {
  const all = recordCharacters(d, now)
    .filter((c) => c.name !== undefined)
    .filter((c) => q.minLevel === undefined || (c.level ?? 0) >= q.minLevel)
    .filter((c) => q.maxLevel === undefined || (c.level ?? 0) <= q.maxLevel)
    .filter((c) => q.role === undefined || c.role === q.role)
    .filter((c) => q.classFile === undefined || c.classFile === q.classFile)
    .filter((c) => q.seenWithin === undefined || (c.sighting !== undefined && now - c.sighting.seenAt <= q.seenWithin))
    .sort(byLevel);
  return { total: all.length, characters: all.slice(0, limit).map(lookupCharacter) };
}

/** `/whocancraft`: everyone with the profession, best first; the best are starred. */
export function whoCanCraft(d: Dataset, profession: string, now: number) {
  const wanted = profession.trim().toLowerCase();
  const rows = recordCharacters(d, now).flatMap((c) =>
    c.professions
      .filter((p) => p.name.toLowerCase() === wanted && c.name !== undefined)
      .map((p) => ({ c, rank: p.rank, max: p.max })),
  );
  rows.sort((a, b) => b.rank - a.rank || compareText(a.c.name, b.c.name));
  const top = rows[0]?.rank;
  return {
    profession:
      rows.length > 0
        ? (rows[0]!.c.professions.find((p) => p.name.toLowerCase() === wanted)?.name ?? profession)
        : profession,
    crafters: rows.map((r) => ({
      ...lookupCharacter(r.c),
      rank: r.rank,
      ...(r.max !== undefined ? { max: r.max } : {}),
      best: r.rank === top,
    })),
  };
}

/** `/alts` and `/me`: a friend's characters, highest level first. */
export function alts(d: Dataset, friendKey: string, now: number) {
  return recordCharacters(d, now)
    .filter((c) => c.owner === friendKey && c.name !== undefined)
    .sort(byLevel)
    .map(lookupCharacter);
}

/** Every profession anyone has, for `/whocancraft`'s choices. */
export function knownProfessions(d: Dataset, now: number): string[] {
  return [...new Set(recordCharacters(d, now).flatMap((c) => c.professions.map((p) => p.name)))].sort();
}

/** Autocomplete: friends (display names) and characters (full names, GUID as value) containing `q`; at most 25. */
export function names(d: Dataset, q: string, now: number, kind: "friend" | "character" | "both" = "both") {
  const needle = q.trim().toLowerCase();
  const match = (text: string) => needle === "" || text.toLowerCase().includes(needle);
  const friends =
    kind === "character"
      ? []
      : peopleViews(d, now)
          .filter((p) => p.hasAddon && match(p.displayName))
          .map((p) => ({ kind: "friend" as const, name: p.displayName, value: p.displayName }));
  const chars =
    kind === "friend"
      ? []
      : shownCharacters(d, now)
          .filter((c) => c.name !== undefined && match(c.name))
          .sort((a, b) => compareText(a.name, b.name))
          .map((c) => ({ kind: "character" as const, name: c.name!, value: c.guid }));
  return [...friends.sort((a, b) => compareText(a.name, b.name)), ...chars].slice(0, 25);
}
