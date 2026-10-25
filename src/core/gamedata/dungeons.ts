import map from "../map/zones.json";
import { ELSEWHERE } from "./places";

// WoW: Forever's dungeons and raids (docs/WOW-FOREVER.md): one entry per instance entrance (the place a marker goes),
// wings listed under it. All level ranges are typical, not limits: label them so. Sources:
// - Vanilla dungeons (names, zones, wings): warcraft.wiki.gg "Instance" (https://warcraft.wiki.gg/wiki/Instance). Zone
//   ids are those of src/core/map/zones.json; Blackrock Mountain is in Burning Steppes, where the source map
//   (Eastern_Kingdoms.svg) puts its dot.
// - Vanilla dungeon levels: the addon's planner table (CommunitiesForever src/core/Dungeons.lua, Dungeons.STATIC), the
//   ranges the group sees in game; an instance's range spans its wings.
// - Forever's nine new dungeons (names, zones): Blizzard, "Explore the New Dungeons of World of Warcraft: Forever"
//   (https://news.blizzard.com/en-us/article/24301455). Levels: the beta Group Finder where it lists the dungeon
//   (CommunitiesForever docs/API-FINDINGS.md V46, what the addon shows), else Blizzard's article (decided by Nico).
// - Raids: Blizzard, "World of Warcraft: Forever Raid Overview" (https://news.blizzard.com/en-us/article/24303009):
//   Onyxia's Lair, The Barrow Deeps and Hyjal Summit, all level 60. The other Vanilla raids are not announced for
//   Forever and stay out until they are (decided by Nico).
// - Zone texts: the client's zone name inside the instance (GetInstanceInfo, e.g. "Ruins of Lordaeron"), the Group
//   Finder name, and the addon's quest-log headers for it (Dungeons.STATIC `areas`).
// - Krol'dok Stronghold is in The Riverglades, which our map does not draw yet: its zone is "elsewhere" and it has no
//   marker. The Mount Hyjal raids sit on the Hyjal (terrain) shape.
// - Map positions: zones.json `dungeons` (hand-placed in tools/map/build_zones.py), joined by name.

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
  /** Zone id in zones.json the entrance is in, or "elsewhere" when the map does not draw its zone. */
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
    id: "thanes",
    name: "Hall of Thanes",
    kind: "dungeon",
    zone: "dunmorogh",
    typicalLevels: typical(13, 20),
    zoneTexts: ["Hall of Thanes"],
  },
  {
    id: "lordaeron",
    name: "Ruins of Lordaeron",
    kind: "dungeon",
    zone: "tirisfal",
    typicalLevels: typical(15, 22),
    zoneTexts: ["Ruins of Lordaeron"],
  },
  {
    id: "excavation",
    name: "Excavation Site",
    kind: "dungeon",
    zone: "wetlands",
    typicalLevels: typical(26, 33),
    zoneTexts: ["Excavation Site", "Excavation Site: Wetlands"],
  },
  {
    id: "dalaran",
    name: "City of Dalaran",
    kind: "dungeon",
    zone: "hillsbrad",
    typicalLevels: typical(28, 35),
    zoneTexts: ["City of Dalaran"],
  },
  {
    id: "drowned",
    name: "The Drowned City",
    kind: "dungeon",
    zone: "stv",
    typicalLevels: typical(35, 40),
    zoneTexts: ["The Drowned City", "Drowned City"],
  },
  {
    id: "kroldok",
    name: "Krol'dok Stronghold",
    kind: "dungeon",
    zone: ELSEWHERE,
    typicalLevels: typical(40, 45),
    zoneTexts: ["Krol'dok Stronghold"],
  },
  {
    id: "alcaz",
    name: "Alcaz Prison",
    kind: "dungeon",
    zone: "dustwallow",
    typicalLevels: typical(48, 53),
    zoneTexts: ["Alcaz Prison"],
  },
  {
    id: "blackmaw",
    name: "Blackmaw Hold",
    kind: "dungeon",
    zone: "azshara",
    typicalLevels: typical(55, 60),
    zoneTexts: ["Blackmaw Hold"],
  },
  {
    id: "shaper",
    name: "Shaper's Terrace",
    kind: "dungeon",
    zone: "ungoro",
    typicalLevels: typical(58, 60),
    zoneTexts: ["Shaper's Terrace"],
  },
  {
    id: "barrow",
    name: "The Barrow Deeps",
    kind: "raid",
    zone: "hyjal",
    typicalLevels: typical(60),
    zoneTexts: ["The Barrow Deeps", "Barrow Deeps"],
  },
  {
    id: "summit",
    name: "Hyjal Summit",
    kind: "raid",
    zone: "hyjal",
    typicalLevels: typical(60),
    zoneTexts: ["Hyjal Summit"],
  },
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
