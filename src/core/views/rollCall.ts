import type { Faction } from "../gamedata";
import type { Dataset } from "../model";
import { DAY, type DataAge } from "./age";
import {
  compareDesc,
  compareText,
  peopleViews,
  shownCharacters,
  type CharacterView,
  type PersonView,
  type SightingView,
} from "./characters";

// The roll call next to the map (board `map`, `phone-roll-call`): who was seen where, newest first.
// "Seen" always means seen by the addon (docs/DESIGN.md §4).

export interface RollCallFilter {
  /** Only this person's characters (person key). */
  person?: string;
  /** Only characters seen in the last 24 hours. */
  last24h?: boolean;
  faction?: Faction;
  minLevel?: number;
  maxLevel?: number;
  /** Only sightings of these ages (the age chips: live, days, week). */
  ages?: readonly DataAge[];
}

export interface RollCallRow {
  character: CharacterView;
  sighting: SightingView;
  /** The owner: their name, "via X", and whether their data is old. Undefined for a GUID nobody owns. */
  person?: PersonView;
}

export interface RollCall {
  /** Characters with a sighting, and all characters shown ("9 of 10 located"), after the filter. */
  located: number;
  total: number;
  /** Seen in the last 24 hours, newest first. */
  last24h: RollCallRow[];
  /** Seen before that, newest first. */
  earlier: RollCallRow[];
  /** Characters never sighted ("Unknown whereabouts"), by level. */
  unknown: { character: CharacterView; person?: PersonView }[];
  /** Friends without the addon ("Sanne has no addon data yet"), by name. Their sighted characters are rows too. */
  noAddon: PersonView[];
  /** The person filter chips: everyone who runs the addon, the uploader first. */
  people: PersonView[];
}

function matches(c: CharacterView, filter: RollCallFilter, now: number): boolean {
  if (filter.person !== undefined && c.owner !== filter.person) return false;
  if (filter.faction !== undefined && c.faction !== filter.faction) return false;
  if (filter.minLevel !== undefined && (c.level === undefined || c.level < filter.minLevel)) return false;
  if (filter.maxLevel !== undefined && (c.level === undefined || c.level > filter.maxLevel)) return false;
  if (filter.last24h === true && (c.sighting === undefined || now - c.sighting.seenAt >= DAY)) return false;
  if (filter.ages !== undefined && !filter.ages.includes(c.sighting?.age ?? "unknown")) return false;
  return true;
}

export function rollCall(d: Dataset, now: number, filter: RollCallFilter = {}): RollCall {
  const people = peopleViews(d, now);
  const byKey = new Map(people.map((p) => [p.key, p]));
  const characters = shownCharacters(d, now).filter((c) => matches(c, filter, now));

  const rows: RollCallRow[] = [];
  const unknown: RollCall["unknown"] = [];
  for (const character of characters) {
    const person = character.owner !== undefined ? byKey.get(character.owner) : undefined;
    if (character.sighting === undefined) {
      unknown.push(person !== undefined ? { character, person } : { character });
    } else {
      const row: RollCallRow = { character, sighting: character.sighting };
      if (person !== undefined) row.person = person;
      rows.push(row);
    }
  }
  rows.sort(
    (a, b) =>
      b.sighting.seenAt - a.sighting.seenAt ||
      compareText(a.character.name, b.character.name) ||
      compareText(a.character.guid, b.character.guid),
  );
  unknown.sort(
    (a, b) =>
      compareDesc(a.character.level, b.character.level) ||
      compareText(a.character.name, b.character.name) ||
      compareText(a.character.guid, b.character.guid),
  );

  return {
    located: rows.length,
    total: characters.length,
    last24h: rows.filter((r) => now - r.sighting.seenAt < DAY),
    earlier: rows.filter((r) => now - r.sighting.seenAt >= DAY),
    unknown,
    noAddon: people
      .filter((p) => !p.hasAddon && !p.isUploader)
      .sort((a, b) => compareText(a.displayName, b.displayName) || compareText(a.key, b.key)),
    people: people.filter((p) => p.hasAddon),
  };
}
