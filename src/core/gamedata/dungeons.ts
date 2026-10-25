import map from "../map/zones.json";

// Vanilla dungeons and raids: one entry per instance entrance (the place a marker goes), wings listed under it.
// Sources:
// - names, zones and wings: warcraft.wiki.gg "Instance" (https://warcraft.wiki.gg/wiki/Instance), the original game's
//   dungeons and raids; zone ids are those of src/core/map/zones.json. Blackrock Mountain is placed in Burning Steppes,
//   where the source map (Eastern_Kingdoms.svg) puts its dot.
// - dungeon levels: the addon's planner table (CommunitiesForever src/core/Dungeons.lua, Dungeons.STATIC), the ranges
//   the group sees in game; an instance's range spans its wings. These are typical ranges, not limits: label them so.
// - raid levels: warcraft.wiki.gg Classic articles ("Onyxia's Lair (Classic)": 60, "Zul'Gurub (Classic)": 58-60);
//   the other raids are level-60 content of the original game.
// - zone texts: the English client's zone name inside the instance, plus the addon's quest-log headers for it
//   (Dungeons.STATIC `areas`).
// - map positions: zones.json `dungeons` (hand-placed in tools/map/build_zones.py), joined by name.

export type InstanceKind = "dungeon" | "raid";

export interface LevelRange {
  min: number;
  max: number;
}

export interface Wing {
  name: string;
  typicalLevels: LevelRange;
}

export interface DungeonInfo {
  id: string;
  name: string;
  kind: InstanceKind;
  /** Zone id in zones.json the entrance is in. */
  zone: string;
  /** Typical level range (label it "typical"). */
  typicalLevels: LevelRange;
  wings?: readonly Wing[];
  /** Zone texts the addon may record for it (the name included). */
  zoneTexts: readonly string[];
}

const typical = (min: number, max: number = min): LevelRange => ({ min, max });

export const DUNGEONS: readonly DungeonInfo[] = [
  {
    id: "rfc",
    name: "Ragefire Chasm",
    kind: "dungeon",
    zone: "durotar",
    typicalLevels: typical(13, 18),
    zoneTexts: ["Ragefire Chasm"],
  },
  {
    id: "wc",
    name: "Wailing Caverns",
    kind: "dungeon",
    zone: "barrens",
    typicalLevels: typical(17, 24),
    zoneTexts: ["Wailing Caverns"],
  },
  {
    id: "dm",
    name: "The Deadmines",
    kind: "dungeon",
    zone: "westfall",
    typicalLevels: typical(17, 26),
    zoneTexts: ["The Deadmines", "Deadmines"],
  },
  {
    id: "sfk",
    name: "Shadowfang Keep",
    kind: "dungeon",
    zone: "silverpine",
    typicalLevels: typical(22, 30),
    zoneTexts: ["Shadowfang Keep"],
  },
  {
    id: "bfd",
    name: "Blackfathom Deeps",
    kind: "dungeon",
    zone: "ashenvale",
    typicalLevels: typical(24, 32),
    zoneTexts: ["Blackfathom Deeps"],
  },
  {
    id: "stocks",
    name: "The Stockade",
    kind: "dungeon",
    zone: "elwynn",
    typicalLevels: typical(24, 32),
    zoneTexts: ["The Stockade", "Stormwind Stockade"],
  },
  {
    id: "gnomer",
    name: "Gnomeregan",
    kind: "dungeon",
    zone: "dunmorogh",
    typicalLevels: typical(29, 38),
    zoneTexts: ["Gnomeregan"],
  },
  {
    id: "rfk",
    name: "Razorfen Kraul",
    kind: "dungeon",
    zone: "barrens",
    typicalLevels: typical(29, 38),
    zoneTexts: ["Razorfen Kraul"],
  },
  {
    id: "sm",
    name: "Scarlet Monastery",
    kind: "dungeon",
    zone: "tirisfal",
    typicalLevels: typical(26, 45),
    wings: [
      { name: "Graveyard", typicalLevels: typical(26, 36) },
      { name: "Library", typicalLevels: typical(29, 39) },
      { name: "Armory", typicalLevels: typical(32, 42) },
      { name: "Cathedral", typicalLevels: typical(35, 45) },
    ],
    zoneTexts: ["Scarlet Monastery"],
  },
  {
    id: "rfd",
    name: "Razorfen Downs",
    kind: "dungeon",
    zone: "barrens",
    typicalLevels: typical(37, 46),
    zoneTexts: ["Razorfen Downs"],
  },
  {
    id: "ulda",
    name: "Uldaman",
    kind: "dungeon",
    zone: "badlands",
    typicalLevels: typical(41, 51),
    zoneTexts: ["Uldaman"],
  },
  {
    id: "zf",
    name: "Zul'Farrak",
    kind: "dungeon",
    zone: "tanaris",
    typicalLevels: typical(44, 54),
    zoneTexts: ["Zul'Farrak"],
  },
  {
    id: "mara",
    name: "Maraudon",
    kind: "dungeon",
    zone: "desolace",
    typicalLevels: typical(46, 55),
    zoneTexts: ["Maraudon"],
  },
  {
    id: "st",
    name: "Sunken Temple",
    kind: "dungeon",
    zone: "swamp",
    typicalLevels: typical(50, 56),
    zoneTexts: ["Sunken Temple", "The Temple of Atal'Hakkar", "Temple of Atal'Hakkar"],
  },
  {
    id: "brd",
    name: "Blackrock Depths",
    kind: "dungeon",
    zone: "burning",
    typicalLevels: typical(52, 60),
    zoneTexts: ["Blackrock Depths"],
  },
  {
    id: "brs",
    name: "Blackrock Spire",
    kind: "dungeon",
    zone: "burning",
    typicalLevels: typical(55, 60),
    wings: [
      { name: "Lower Blackrock Spire", typicalLevels: typical(55, 60) },
      { name: "Upper Blackrock Spire", typicalLevels: typical(55, 60) },
    ],
    zoneTexts: ["Blackrock Spire", "Lower Blackrock Spire", "Upper Blackrock Spire"],
  },
  {
    id: "dme",
    name: "Dire Maul",
    kind: "dungeon",
    zone: "feralas",
    typicalLevels: typical(55, 60),
    zoneTexts: ["Dire Maul"],
  },
  {
    id: "scholo",
    name: "Scholomance",
    kind: "dungeon",
    zone: "wpl",
    typicalLevels: typical(58, 60),
    zoneTexts: ["Scholomance"],
  },
  {
    id: "strat",
    name: "Stratholme",
    kind: "dungeon",
    zone: "epl",
    typicalLevels: typical(58, 60),
    zoneTexts: ["Stratholme"],
  },
  {
    id: "ony",
    name: "Onyxia's Lair",
    kind: "raid",
    zone: "dustwallow",
    typicalLevels: typical(60),
    zoneTexts: ["Onyxia's Lair"],
  },
  {
    id: "mc",
    name: "Molten Core",
    kind: "raid",
    zone: "burning",
    typicalLevels: typical(60),
    zoneTexts: ["Molten Core"],
  },
  {
    id: "bwl",
    name: "Blackwing Lair",
    kind: "raid",
    zone: "burning",
    typicalLevels: typical(60),
    zoneTexts: ["Blackwing Lair"],
  },
  { id: "zg", name: "Zul'Gurub", kind: "raid", zone: "stv", typicalLevels: typical(58, 60), zoneTexts: ["Zul'Gurub"] },
  {
    id: "aq20",
    name: "Ruins of Ahn'Qiraj",
    kind: "raid",
    zone: "silithus",
    typicalLevels: typical(60),
    zoneTexts: ["Ruins of Ahn'Qiraj"],
  },
  {
    id: "aq40",
    name: "Temple of Ahn'Qiraj",
    kind: "raid",
    zone: "silithus",
    typicalLevels: typical(60),
    zoneTexts: ["Temple of Ahn'Qiraj", "Ahn'Qiraj"],
  },
  { id: "naxx", name: "Naxxramas", kind: "raid", zone: "epl", typicalLevels: typical(60), zoneTexts: ["Naxxramas"] },
];

export interface MapPoint {
  x: number;
  y: number;
}

const positions = new Map(map.dungeons.map((d) => [d.name, { x: d.x, y: d.y }]));

/** The dungeon's marker position in world coordinates (zones.json); undefined when the map has none. */
export function dungeonPosition(dungeon: DungeonInfo): MapPoint | undefined {
  return positions.get(dungeon.name);
}

export function dungeonById(id: string): DungeonInfo | undefined {
  return DUNGEONS.find((d) => d.id === id);
}
