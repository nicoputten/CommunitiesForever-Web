import type { DataAge } from "./age";

// The map's light half (WEB-25): types, the continent switch and marker labels, without zones.json, so client
// components can use them without shipping the map data twice. The view model itself is map.ts.

export type Continent = "azeroth" | "kalimdor" | "eastern-kingdoms";

export const CONTINENTS: readonly { value: Continent; label: string }[] = [
  { value: "azeroth", label: "Azeroth" },
  { value: "kalimdor", label: "Kalimdor" },
  { value: "eastern-kingdoms", label: "Eastern Kingdoms" },
];

/** A `?continent=` value; anything else is the whole world. */
export function parseContinent(value: unknown): Continent {
  return CONTINENTS.find((c) => c.value === value)?.value ?? "azeroth";
}

export interface MapMarker {
  guid: string;
  /** Undefined for a friend without the addon (a sighted stub): "?" disc, no "Open character". */
  name?: string;
  initials: string;
  classFile?: string;
  className?: string;
  level?: number;
  raceName?: string;
  /** The main talent tree ("Destruction"). */
  spec?: string;
  ilvl?: number;
  ownerName?: string;
  /** "via X" when the owner's data was relayed. */
  viaName?: string;
  zoneName: string;
  /** Set when the sighting was inside a dungeon or raid of this zone. */
  dungeonName?: string;
  seenAt: number;
  /** "2 h ago". */
  seenAgo: string;
  age: DataAge;
  /** "2d" next to the marker: every sighting that is not new (Nico, 2026-10-26). */
  ageTag?: string;
}

export interface MapPlace {
  /** zones.json zone id. */
  zone: string;
  zoneName: string;
  /** The zone's anchor (zones.json lx/ly), world units. */
  x: number;
  y: number;
  /** Newest first. */
  markers: MapMarker[];
  /** Dungeons and raids someone here was seen in. */
  dungeons: string[];
}

/** "Lia Thornwhisper, level 37 Priest, Stranglethorn Vale, seen 1 h ago": a marker's accessible name. */
export function markerLabel(m: MapMarker): string {
  const who = m.name ?? (m.ownerName === undefined ? "Unknown character" : `A character of ${m.ownerName}`);
  const what = [m.level === undefined ? undefined : `level ${m.level}`, m.className].filter(Boolean).join(" ");
  const where = m.dungeonName === undefined ? m.zoneName : `${m.dungeonName}, ${m.zoneName}`;
  return [who, what || undefined, where, `seen ${m.seenAgo}`].filter(Boolean).join(", ");
}

/** "2 characters in Westfall, including 1 in The Deadmines". */
export function placeLabel(p: MapPlace): string {
  const inDungeon = p.markers.filter((m) => m.dungeonName !== undefined).length;
  const base = `${p.markers.length} characters in ${p.zoneName}`;
  if (inDungeon === 0) return base;
  const where = p.dungeons.length === 1 ? p.dungeons[0] : "a dungeon";
  return `${base}, including ${inDungeon} in ${where}`;
}

// Zoom (WEB-26, DESIGN.md §5): the scale is relative to the whole world fitted on screen. The map shows more detail
// from 2× (continent: towns, fans open) and from 4× (zone: dungeons, name tags); + and − step through the levels.

export type ZoomLevel = "world" | "continent" | "zone";

export const ZOOM_STEPS = [1, 2, 4] as const;
export const ZOOM_MAX = 4;

/** Scales this close to a step count as the step (a fly or pinch can end a hair short). */
const ZOOM_EPSILON = 0.02;

export function zoomLevel(scale: number): ZoomLevel {
  if (scale >= 4 - ZOOM_EPSILON) return "zone";
  if (scale >= 2 - ZOOM_EPSILON) return "continent";
  return "world";
}

/** The next zoom step in (1) or out (−1) from a scale; stays at the end of the range. */
export function zoomStep(scale: number, direction: 1 | -1): number {
  if (direction === 1) return ZOOM_STEPS.find((s) => s > scale + ZOOM_EPSILON) ?? ZOOM_MAX;
  return [...ZOOM_STEPS].reverse().find((s) => s < scale - ZOOM_EPSILON) ?? 1;
}

/** Whether a scale is the whole world (1×): nothing to pan, the switch says Azeroth. */
export function wholeWorld(scale: number): boolean {
  return scale < 1 + ZOOM_EPSILON;
}

/**
 * What the continent switch shows for a view: Azeroth while the whole world is on screen, else the continent under
 * the centre of the screen. `x` and `split` (map.ts CONTINENT_SPLIT) in world units.
 */
export function continentAt(x: number, scale: number, split: number): Continent {
  if (wholeWorld(scale)) return "azeroth";
  return x < split ? "kalimdor" : "eastern-kingdoms";
}
