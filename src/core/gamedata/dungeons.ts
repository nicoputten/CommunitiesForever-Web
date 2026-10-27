import map from "../map/zones.json";

// WoW: Forever's dungeons and raids (docs/WOW-FOREVER.md): one entry per instance entrance (the place a marker goes),
// wings listed under it. All level ranges are typical, not limits: label them so. Sources:
// - Vanilla dungeons (names, zones, wings): warcraft.wiki.gg "Instance" (https://warcraft.wiki.gg/wiki/Instance). Zone
//   ids are those of src/core/map/zones.json; Blackrock Mountain is in Burning Steppes, where the source map
//   (Eastern_Kingdoms.svg) puts its dot.
// - Vanilla dungeon levels: the addon's planner table (CommunitiesForever src/core/Dungeons.lua, Dungeons.STATIC), the
//   ranges the group sees in game; an instance's range spans its wings. Scarlet Monastery's four wings are four entries
//   there (smgy, smlib, smarm, smcath; Group Finder activities 805, 829, 827, 828), each with its own range; Forever
//   announced no change to them (WEB-32).
// - Forever's nine new dungeons (names, zones): Blizzard, "Explore the New Dungeons of World of Warcraft: Forever"
//   (https://news.blizzard.com/en-us/article/24301455). Levels: the beta Group Finder where it lists the dungeon
//   (CommunitiesForever docs/API-FINDINGS.md V46, what the addon shows), else Blizzard's article (decided by Nico).
// - Raids: Blizzard, "World of Warcraft: Forever Raid Overview" (https://news.blizzard.com/en-us/article/24303009):
//   Onyxia's Lair, The Barrow Deeps and Hyjal Summit, all level 60. The other Vanilla raids are not announced for
//   Forever and stay out until they are (decided by Nico).
// - Zone texts: the client's zone name inside the instance (GetInstanceInfo, e.g. "Ruins of Lordaeron"), the Group
//   Finder name, and the addon's quest-log headers for it (Dungeons.STATIC `areas`).
// - Krol'dok Stronghold is in The Riverglades, the Mount Hyjal raids on Mount Hyjal (both zones since WEB-31).
// - Map positions: zones.json `dungeons` (hand-placed in tools/map/build_zones.py), joined by name.
// - Addon ids (`addonId`, WEB-44): the addon's dungeon ids (CommunitiesForever src/core/Dungeons.lua, Dungeons.STATIC
//   `id`), which the planned runs file uses; Forever's new dungeons are "lfg" plus their beta Group Finder activity
//   (Dungeons.applyGroupFinder; activities in docs/WOW-FOREVER.md). None for the five the Group Finder didn't list.

export type InstanceKind = "dungeon" | "raid";

export interface LevelRange {
  min: number;
  max: number;
}

export interface Wing {
  /** Unique among the instance's wings, lower case ("armory"). */
  id: string;
  /** The addon's id when the wing is a dungeon of its own ("smarm"). */
  addonId?: string;
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
  /**
   * Each wing is a dungeon of its own, run on its own with its own level range (Scarlet Monastery, WEB-32). Blackrock
   * Spire's wings share one range and stay one dungeon for who fits.
   */
  wingsAreDungeons?: true;
  /** Short name for narrow places, e.g. the roster's bands ("SM Armory"). */
  shortName?: string;
  /** The addon's dungeon id ("rfc", "lbrs", "lfg1984"); undefined when the addon has none. */
  addonId?: string;
  /** Zone texts the addon may record for it (the name included). */
  zoneTexts: readonly string[];
}

const typical = (min: number, max: number = min): LevelRange => ({ min, max });

export const DUNGEONS: readonly DungeonInfo[] = [
  {
    id: "rfc",
    addonId: "rfc",
    name: "Ragefire Chasm",
    kind: "dungeon",
    zone: "durotar",
    typicalLevels: typical(13, 18),
    zoneTexts: ["Ragefire Chasm"],
  },
  {
    id: "wc",
    addonId: "wc",
    name: "Wailing Caverns",
    kind: "dungeon",
    zone: "barrens",
    typicalLevels: typical(17, 24),
    zoneTexts: ["Wailing Caverns"],
  },
  {
    id: "dm",
    addonId: "dm",
    name: "The Deadmines",
    kind: "dungeon",
    zone: "westfall",
    typicalLevels: typical(17, 26),
    zoneTexts: ["The Deadmines", "Deadmines"],
  },
  {
    id: "sfk",
    addonId: "sfk",
    name: "Shadowfang Keep",
    kind: "dungeon",
    zone: "silverpine",
    typicalLevels: typical(22, 30),
    zoneTexts: ["Shadowfang Keep"],
  },
  {
    id: "bfd",
    addonId: "bfd",
    name: "Blackfathom Deeps",
    kind: "dungeon",
    zone: "ashenvale",
    typicalLevels: typical(24, 32),
    zoneTexts: ["Blackfathom Deeps"],
  },
  {
    id: "stocks",
    addonId: "stocks",
    name: "The Stockade",
    kind: "dungeon",
    zone: "elwynn",
    typicalLevels: typical(24, 32),
    zoneTexts: ["The Stockade", "Stormwind Stockade"],
  },
  {
    id: "gnomer",
    addonId: "gnomer",
    name: "Gnomeregan",
    kind: "dungeon",
    zone: "dunmorogh",
    typicalLevels: typical(29, 38),
    zoneTexts: ["Gnomeregan"],
  },
  {
    id: "rfk",
    addonId: "rfk",
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
    shortName: "SM",
    typicalLevels: typical(26, 45),
    wings: [
      { id: "graveyard", addonId: "smgy", name: "Graveyard", typicalLevels: typical(26, 36) },
      { id: "library", addonId: "smlib", name: "Library", typicalLevels: typical(29, 39) },
      { id: "armory", addonId: "smarm", name: "Armory", typicalLevels: typical(32, 42) },
      { id: "cathedral", addonId: "smcath", name: "Cathedral", typicalLevels: typical(35, 45) },
    ],
    wingsAreDungeons: true,
    zoneTexts: ["Scarlet Monastery"],
  },
  {
    id: "rfd",
    addonId: "rfd",
    name: "Razorfen Downs",
    kind: "dungeon",
    zone: "barrens",
    typicalLevels: typical(37, 46),
    zoneTexts: ["Razorfen Downs"],
  },
  {
    id: "ulda",
    addonId: "ulda",
    name: "Uldaman",
    kind: "dungeon",
    zone: "badlands",
    typicalLevels: typical(41, 51),
    zoneTexts: ["Uldaman"],
  },
  {
    id: "zf",
    addonId: "zf",
    name: "Zul'Farrak",
    kind: "dungeon",
    zone: "tanaris",
    typicalLevels: typical(44, 54),
    zoneTexts: ["Zul'Farrak"],
  },
  {
    id: "mara",
    addonId: "mara",
    name: "Maraudon",
    kind: "dungeon",
    zone: "desolace",
    typicalLevels: typical(46, 55),
    zoneTexts: ["Maraudon"],
  },
  {
    id: "st",
    addonId: "st",
    name: "Sunken Temple",
    kind: "dungeon",
    zone: "swamp",
    typicalLevels: typical(50, 56),
    zoneTexts: ["Sunken Temple", "The Temple of Atal'Hakkar", "Temple of Atal'Hakkar"],
  },
  {
    id: "brd",
    addonId: "brd",
    name: "Blackrock Depths",
    kind: "dungeon",
    zone: "burning",
    typicalLevels: typical(52, 60),
    zoneTexts: ["Blackrock Depths"],
  },
  {
    id: "brs",
    // The addon has Lower and Upper as two (lbrs, ubrs); the site has one, sent as Lower.
    addonId: "lbrs",
    name: "Blackrock Spire",
    kind: "dungeon",
    zone: "burning",
    typicalLevels: typical(55, 60),
    wings: [
      { id: "lower", name: "Lower Blackrock Spire", typicalLevels: typical(55, 60) },
      { id: "upper", name: "Upper Blackrock Spire", typicalLevels: typical(55, 60) },
    ],
    zoneTexts: ["Blackrock Spire", "Lower Blackrock Spire", "Upper Blackrock Spire"],
  },
  {
    id: "dme",
    addonId: "dme",
    name: "Dire Maul",
    kind: "dungeon",
    zone: "feralas",
    typicalLevels: typical(55, 60),
    zoneTexts: ["Dire Maul"],
  },
  {
    id: "scholo",
    addonId: "scholo",
    name: "Scholomance",
    kind: "dungeon",
    zone: "wpl",
    typicalLevels: typical(58, 60),
    zoneTexts: ["Scholomance"],
  },
  {
    id: "strat",
    addonId: "strat",
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
    addonId: "lfg1984",
    name: "Hall of Thanes",
    kind: "dungeon",
    zone: "dunmorogh",
    typicalLevels: typical(13, 20),
    zoneTexts: ["Hall of Thanes"],
  },
  {
    id: "lordaeron",
    addonId: "lfg1982",
    name: "Ruins of Lordaeron",
    kind: "dungeon",
    zone: "tirisfal",
    typicalLevels: typical(15, 22),
    zoneTexts: ["Ruins of Lordaeron"],
  },
  {
    id: "excavation",
    addonId: "lfg1981",
    name: "Excavation Site",
    kind: "dungeon",
    zone: "wetlands",
    typicalLevels: typical(26, 33),
    zoneTexts: ["Excavation Site", "Excavation Site: Wetlands"],
  },
  {
    id: "dalaran",
    addonId: "lfg1983",
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
    zone: "riverglades",
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

/**
 * A dungeon a group runs as one, for who fits a level (roster bands, the character page, WEB-32): every dungeon, but
 * an instance whose wings are dungeons of their own as its wings ("Scarlet Monastery: Armory"). Raids are left out.
 */
export interface RunnableDungeon {
  /** The instance's id, or `<instance>-<wing>` for a wing ("sm-armory"). */
  id: string;
  name: string;
  /** The name for narrow places ("SM Armory", "The Deadmines"). */
  shortName: string;
  /** The instance (DUNGEONS) it is in. */
  instanceId: string;
  /** The addon's dungeon id, for the planned runs file (WEB-44); undefined when the addon has none. */
  addonId?: string;
  /** Typical level range (label it "typical"). */
  typicalLevels: LevelRange;
}

export const RUNNABLE_DUNGEONS: readonly RunnableDungeon[] = DUNGEONS.filter((d) => d.kind === "dungeon").flatMap(
  (d): RunnableDungeon[] =>
    d.wingsAreDungeons === true && d.wings !== undefined
      ? d.wings.map((w) => ({
          id: `${d.id}-${w.id}`,
          name: `${d.name}: ${w.name}`,
          shortName: `${d.shortName ?? d.name} ${w.name}`,
          instanceId: d.id,
          typicalLevels: w.typicalLevels,
          ...(w.addonId === undefined ? {} : { addonId: w.addonId }),
        }))
      : [
          {
            id: d.id,
            name: d.name,
            shortName: d.shortName ?? d.name,
            instanceId: d.id,
            typicalLevels: d.typicalLevels,
            ...(d.addonId === undefined ? {} : { addonId: d.addonId }),
          },
        ],
);

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
