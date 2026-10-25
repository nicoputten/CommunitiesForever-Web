// WoW: Forever's playable races by raceID (the addon's Char.raceID, from UnitRace; docs/WOW-FOREVER.md).
// Sources: the eight Vanilla races: IDs, English names and factions of the client's ChrRaces table, as listed on
// warcraft.wiki.gg "RaceId" (https://warcraft.wiki.gg/wiki/RaceId). Skyborne (Blizzard, "Meet the New Skyborne",
// https://us.forums.blizzard.com/en/wow/t/wow-forever-meet-the-new-skyborne/2358236) is one race the player puts in
// either faction; the client has two raceIDs for it, 95 "High Order Skyborne" (Alliance) and 96 "Windshaper Skyborne"
// (Horde), datamined from ChrRaces / CharBaseInfo build 1.60.1.70374 on wago.tools
// (https://github.com/nazumods/wow/pull/1000). Unverified until an upload shows a Skyborne character.

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
  95: { raceID: 95, name: "Skyborne", faction: "Alliance" },
  96: { raceID: 96, name: "Skyborne", faction: "Horde" },
};

/** The race of a raceID from the upload; undefined for a missing or unknown one. */
export function raceInfo(raceID: number | undefined): RaceInfo | undefined {
  return raceID !== undefined && Object.hasOwn(RACES, raceID) ? RACES[raceID] : undefined;
}
