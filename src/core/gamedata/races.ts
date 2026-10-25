// Vanilla playable races by raceID (the addon's Char.raceID, from UnitRace).
// Source: race IDs, English names and factions of the game client's ChrRaces table, as listed on warcraft.wiki.gg
// "RaceId" (https://warcraft.wiki.gg/wiki/RaceId).

export type Faction = "Alliance" | "Horde";

export interface RaceInfo {
  raceID: number;
  name: string;
  faction: Faction;
}

export const RACES: Readonly<Record<number, RaceInfo>> = {
  1: { raceID: 1, name: "Human", faction: "Alliance" },
  2: { raceID: 2, name: "Orc", faction: "Horde" },
  3: { raceID: 3, name: "Dwarf", faction: "Alliance" },
  4: { raceID: 4, name: "Night Elf", faction: "Alliance" },
  5: { raceID: 5, name: "Undead", faction: "Horde" },
  6: { raceID: 6, name: "Tauren", faction: "Horde" },
  7: { raceID: 7, name: "Gnome", faction: "Alliance" },
  8: { raceID: 8, name: "Troll", faction: "Horde" },
};

/** The race of a raceID from the upload; undefined for a missing or unknown one. */
export function raceInfo(raceID: number | undefined): RaceInfo | undefined {
  return raceID !== undefined && Object.hasOwn(RACES, raceID) ? RACES[raceID] : undefined;
}
