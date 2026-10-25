import { DUNGEONS, type DungeonInfo } from "./dungeons";

// The addon stores a sighting's zone as the English client's zone name text (GetRealZoneText, C_Club member zone),
// not as an ID; inside an instance it is the instance's name. This table maps that text to a zones.json zone id.
// Sources: the zone names of the English client, which are also the zone names of the source map SVGs (Wikimedia
// Commons, tools/map); the capitals' zones from the map (each capital is drawn inside its zone); Alterac Mountains
// shares the Hillsbrad shape, as the source SVG has no shape of its own for it (docs/DESIGN.md §5); Blackrock
// Mountain is in Burning Steppes, where the source map puts it. Dungeon texts come from src/core/gamedata/dungeons.ts.
// Text that matches nothing resolves to "elsewhere": a sighting is never dropped.

export const ELSEWHERE = "elsewhere";

export const ZONE_ALIASES: Readonly<Record<string, string>> = {
  // Kalimdor
  Teldrassil: "teldrassil",
  Darkshore: "darkshore",
  Moonglade: "moonglade",
  Winterspring: "winterspring",
  Felwood: "felwood",
  Azshara: "azshara",
  Ashenvale: "ashenvale",
  "Stonetalon Mountains": "stonetalon",
  Durotar: "durotar",
  "The Barrens": "barrens",
  Mulgore: "mulgore",
  Desolace: "desolace",
  Feralas: "feralas",
  "Dustwallow Marsh": "dustwallow",
  "Thousand Needles": "needles",
  "Un'Goro Crater": "ungoro",
  Tanaris: "tanaris",
  Silithus: "silithus",
  // Eastern Kingdoms
  "Tirisfal Glades": "tirisfal",
  "Western Plaguelands": "wpl",
  "Eastern Plaguelands": "epl",
  "Silverpine Forest": "silverpine",
  "Hillsbrad Foothills": "hillsbrad",
  "Alterac Mountains": "hillsbrad",
  "The Hinterlands": "hinterlands",
  "Arathi Highlands": "arathi",
  Wetlands: "wetlands",
  "Dun Morogh": "dunmorogh",
  "Loch Modan": "lochmodan",
  "Searing Gorge": "searing",
  Badlands: "badlands",
  "Burning Steppes": "burning",
  "Blackrock Mountain": "burning",
  "Elwynn Forest": "elwynn",
  "Redridge Mountains": "redridge",
  Westfall: "westfall",
  Duskwood: "duskwood",
  "Deadwind Pass": "deadwind",
  "Swamp of Sorrows": "swamp",
  "Blasted Lands": "blasted",
  "Stranglethorn Vale": "stv",
  // capitals
  Orgrimmar: "durotar",
  "Thunder Bluff": "mulgore",
  Darnassus: "teldrassil",
  Undercity: "tirisfal",
  "Stormwind City": "elwynn",
  Ironforge: "dunmorogh",
};

const dungeonByText = new Map<string, DungeonInfo>(DUNGEONS.flatMap((d) => d.zoneTexts.map((t) => [t, d] as const)));

export interface ZonePlace {
  /** zones.json zone id, or "elsewhere" for text the site does not know. */
  zone: string;
  /** The instance, when the text names one. */
  dungeon?: DungeonInfo;
  /** The addon's text, trimmed, to show as is. */
  text: string;
}

/** Where a sighting's zone text is on the map. Unknown text is "elsewhere", never dropped. */
export function resolveZone(zoneText: string): ZonePlace {
  const text = zoneText.trim();
  const dungeon = dungeonByText.get(text);
  if (dungeon) return { zone: dungeon.zone, dungeon, text };
  const zone = Object.hasOwn(ZONE_ALIASES, text) ? ZONE_ALIASES[text] : undefined;
  return { zone: zone ?? ELSEWHERE, text };
}
