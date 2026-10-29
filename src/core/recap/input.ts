import map from "../map/zones.json";
import { raceInfo } from "../gamedata/races";
import { BATTLEGROUND, ELSEWHERE } from "../gamedata/places";
import { resolveZone } from "../gamedata/zones";
import type { Character } from "../model";
import type { RecapChar } from "./types";

// Turning the site's data into the recap's input (WEB-41c). Pure: the server reads the rows, these shape them.

/** Zones the map draws ("31 of 39"): every zone of zones.json, not the terrain. */
export const MAP_ZONES: number = map.zones.filter((z) => z.kind === "zone").length;

const zoneName = new Map(map.zones.map((z) => [z.id, z.name]));

/**
 * The map zone of a sighting's zone text, by its map name ("The Deadmines" is in Westfall); undefined for a
 * battleground or a place the map doesn't know, which no zone card counts.
 */
export function mapZone(text: string): string | undefined {
  const place = resolveZone(text);
  if (place.zone === BATTLEGROUND || place.zone === ELSEWHERE) return undefined;
  return zoneName.get(place.zone);
}

/** A character as the recap sees it; undefined for a stub (no record) or one without a name or owner. */
export function recapChar(c: Character): RecapChar | undefined {
  if (!c.hasRecord || c.owner === undefined || c.name === undefined) return undefined;
  const out: RecapChar = {
    guid: c.guid,
    owner: c.owner,
    name: c.name,
    professions: Object.values(c.professions)
      .filter((p) => p.name !== undefined && p.rank !== undefined)
      .map((p) => ({ name: p.name!, rank: p.rank!, max: p.max ?? 0 })),
    quests: Object.keys(c.quests).sort(),
  };
  if (c.classFile !== undefined) out.classFile = c.classFile;
  const race = raceInfo(c.raceID)?.name;
  if (race !== undefined) out.race = race;
  if (c.faction !== undefined) out.faction = c.faction;
  if (c.level !== undefined) out.level = c.level;
  if (c.ilvl !== undefined) out.ilvl = c.ilvl;
  if (c.mainTreeName !== undefined) out.spec = c.mainTreeName;
  if (c.role !== undefined) out.role = c.role;
  if (c.pvp?.rank !== undefined) out.pvpRank = c.pvp.rank;
  if (c.pvp?.rankName !== undefined) out.pvpRankName = c.pvp.rankName;
  if (c.pvp?.weekHonor !== undefined) out.weekHonor = c.pvp.weekHonor;
  return out;
}
