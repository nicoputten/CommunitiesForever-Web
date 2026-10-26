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

/** Clusters of up to this many fan out; more open a list (DESIGN.md §5). */
export const FAN_MAX = 5;
