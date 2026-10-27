import type { Faction } from "../gamedata/races";
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
  /** The phone's character sheet (WEB-28): "1 h" for the next-character button. */
  seenShort: string;
  faction?: Faction;
  /** "N to go" to the level cap; 0 at the cap. */
  levelsToMax?: number;
  /** "Damage", "Healer", "Tank". */
  role?: string;
  /** Points per tree in game order ("10 / 0 / 20"); undefined when the addon recorded no trees. */
  talents?: string;
  /** Primary professions first (CharacterView order). */
  professions?: { name: string; rank: number; max?: number; primary: boolean }[];
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

/** Where the n markers of an open fan sit around the hub (px): an arc above it, the board's 2-fan at ±50°. */
export function fanOffsets(n: number): { dx: number; dy: number }[] {
  const radius = 34; // map-states board: spoke length (--size-spoke)
  const from = n === 2 ? -140 : -165;
  const to = n === 2 ? -40 : -15;
  return Array.from({ length: n }, (_, i) => {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
    return { dx: Math.round(Math.cos(a) * radius), dy: Math.round(Math.sin(a) * radius) };
  });
}

/**
 * A continent never frames below this scale, so it never counts as the whole world (which re-centres on Azeroth):
 * the phone spring-back (WEB-28, Nico 2026-10-27).
 */
export const CONTINENT_MIN_SCALE = 1.25;

/** The scale a continent switch flies to: the continent fitted (`fit`), at least CONTINENT_MIN_SCALE, at most 4×. */
export function continentScale(continent: Continent, fit: number): number {
  if (continent === "azeroth") return 1;
  return Math.min(Math.max(fit, CONTINENT_MIN_SCALE), ZOOM_MAX);
}

/**
 * The phone's edge hint (WEB-28, "4 in Kalimdor"): characters on the map on the other continent than the one shown,
 * and which edge it lies past (Kalimdor west, the Eastern Kingdoms east). Undefined on Azeroth and when nobody is there.
 */
export function edgeHint(
  places: readonly MapPlace[],
  shown: Continent,
  split: number,
): { continent: Continent; label: string; count: number; side: "left" | "right" } | undefined {
  if (shown === "azeroth") return undefined;
  const other: Continent = shown === "kalimdor" ? "eastern-kingdoms" : "kalimdor";
  const count = places
    .filter((p) => (other === "kalimdor" ? p.x < split : p.x >= split))
    .reduce((n, p) => n + p.markers.length, 0);
  if (count === 0) return undefined;
  const label = CONTINENTS.find((c) => c.value === other)!.label;
  return { continent: other, label: `${count} in ${label}`, count, side: other === "kalimdor" ? "left" : "right" };
}

/** The place a character is in, and the next one there (newest first, wrapping), for the phone sheet's button. */
export function placeOf(
  places: readonly MapPlace[],
  guid: string,
): { place: MapPlace; marker: MapMarker; next?: MapMarker } | undefined {
  for (const place of places) {
    const i = place.markers.findIndex((m) => m.guid === guid);
    if (i < 0) continue;
    const next = place.markers.length > 1 ? place.markers[(i + 1) % place.markers.length] : undefined;
    return next === undefined ? { place, marker: place.markers[i]! } : { place, marker: place.markers[i]!, next };
  }
  return undefined;
}

/** Clusters of up to this many fan out; more open a list (DESIGN.md §5). */
export const FAN_MAX = 5;
