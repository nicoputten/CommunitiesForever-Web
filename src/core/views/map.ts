import map from "../map/zones.json";
import type { Dataset } from "../model";
import { daysOld, timeAgo, type DataAge } from "./age";
import { compareText, peopleViews, shownCharacters } from "./characters";
import { initials } from "./text";
import type { Continent, MapMarker, MapPlace } from "./mapMarkers";

export * from "./mapMarkers";

// The world map (WEB-25, boards `map` and `map-states`): one place per zone with the characters last seen there,
// newest first, and how fresh each zone's newest sighting is (the occupied tint). Battleground and "elsewhere"
// sightings have no place on the map; the roll call lists them (Nico, 2026-10-26).

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Room around a continent's zones when it is framed on its own (world units). */
const CONTINENT_MARGIN = 24;

/** The smallest box around zone paths. */
function extent(paths: readonly string[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of paths) {
    // zones.json paths are absolute polygons ("M x,y x,y … Z"), so every number pair is a point.
    for (const [, x, y] of d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) {
      minX = Math.min(minX, Number(x));
      maxX = Math.max(maxX, Number(x));
      minY = Math.min(minY, Number(y));
      maxY = Math.max(maxY, Number(y));
    }
  }
  return { minX, minY, maxX, maxY };
}

function bounds(cont: "K" | "E"): ViewBox {
  const { minX, minY, maxX, maxY } = extent(map.zones.filter((z) => z.cont === cont).map((z) => z.d));
  return {
    x: Math.max(0, Math.floor(minX - CONTINENT_MARGIN)),
    y: Math.max(0, Math.floor(minY - CONTINENT_MARGIN)),
    width: Math.ceil(maxX - minX + 2 * CONTINENT_MARGIN),
    height: Math.ceil(maxY - minY + 2 * CONTINENT_MARGIN),
  };
}

function union(a: ViewBox, b: ViewBox): ViewBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

const CONTINENT_BOXES = { K: bounds("K"), E: bounds("E") };

// Azeroth frames both continents, not the whole 1440 × 900 source sheet, whose land sits left of its middle: so the
// map opens (and the switch returns) with the land centred and the sea around it (Nico, WEB-26).
const VIEW_BOXES: Record<Continent, ViewBox> = {
  azeroth: union(CONTINENT_BOXES.K, CONTINENT_BOXES.E),
  kalimdor: CONTINENT_BOXES.K,
  "eastern-kingdoms": CONTINENT_BOXES.E,
};

/** The part of the 1440 × 900 world a continent switch shows (Zephras Isle, `cont` K, counts as Kalimdor). */
export function continentViewBox(continent: Continent): ViewBox {
  return VIEW_BOXES[continent];
}

/** Between the continents (world x): halfway from Kalimdor's east edge to the Eastern Kingdoms' west edge (WEB-26). */
export const CONTINENT_SPLIT =
  (VIEW_BOXES.kalimdor.x + VIEW_BOXES.kalimdor.width + VIEW_BOXES["eastern-kingdoms"].x) / 2;

// The character page's mini map (WEB-23, board `character`): the board frames Stranglethorn Vale in 170 × 150
// world units, so a zone gets at least that, three quarters of its own size when it is larger, centred on its anchor.
const MINI_MIN_WIDTH = 170;
const MINI_RATIO = 170 / 150;
const MINI_SHARE = 0.75;

/** The part of the world the mini map shows around a zone (zones.json id); undefined for an unknown id. */
export function zoneViewBox(zoneId: string): ViewBox | undefined {
  const zone = zoneById.get(zoneId);
  const own = zoneBox(zoneId);
  if (zone === undefined || own === undefined) return undefined;
  const width = Math.max(MINI_MIN_WIDTH, MINI_SHARE * Math.max(own.width, own.height * MINI_RATIO));
  const height = width / MINI_RATIO;
  const round = (n: number) => Math.round(n * 10) / 10;
  return { x: round(zone.lx - width / 2), y: round(zone.ly - height / 2), width: round(width), height: round(height) };
}

export interface MiniMapView {
  /** The zone the character was last seen in, with everyone last seen there (newest first). */
  place: MapPlace;
  box: ViewBox;
  /** zones.json ids of the zones and terrain inside the box: the rest is left out of the page. */
  zones: string[];
  /** The continents whose coast runs through the box. */
  coasts: ("K" | "E")[];
  /** The occupied tint of every zone, as on the world map. */
  occupied: Record<string, DataAge>;
}

/** The mini map of a character's last sighting; undefined when it has no place on the map (none, battleground…). */
export function miniMap(d: Dataset, guid: string, now: number): MiniMapView | undefined {
  const world = worldMap(d, now);
  const place = world.places.find((p) => p.markers.some((m) => m.guid === guid));
  const box = place === undefined ? undefined : zoneViewBox(place.zone);
  if (place === undefined || box === undefined) return undefined;
  const zones = map.zones.filter((z) => overlaps(zoneBox(z.id)!, box)).map((z) => z.id);
  const coasts = (["K", "E"] as const).filter((c) => overlaps(CONTINENT_BOXES[c], box));
  return { place, box, zones, coasts, occupied: world.occupied };
}

const overlaps = (a: ViewBox, b: ViewBox) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const zoneBoxes = new Map<string, ViewBox>();

/** The smallest box around one zone (cached). */
function zoneBox(id: string): ViewBox | undefined {
  let box = zoneBoxes.get(id);
  const zone = zoneById.get(id);
  if (box === undefined && zone !== undefined) {
    const { minX, minY, maxX, maxY } = extent([zone.d]);
    box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    zoneBoxes.set(id, box);
  }
  return box;
}

export interface WorldMapView {
  places: MapPlace[];
  /** Per occupied zone id, the age of its newest sighting: the gold tint (DESIGN.md §5). */
  occupied: Record<string, DataAge>;
}

const zoneById = new Map(map.zones.map((z) => [z.id, z]));

/** A sighting's zone has a place on the map (a zone, not terrain, a battleground or "elsewhere"). */
export function isMapZone(zoneId: string): boolean {
  return zoneById.get(zoneId)?.kind === "zone";
}

/** `only`: just these characters (the roll call's filters, WEB-27); all when undefined. */
export function worldMap(d: Dataset, now: number, only?: ReadonlySet<string>): WorldMapView {
  const people = new Map(peopleViews(d, now).map((p) => [p.key, p]));
  const byZone = new Map<string, MapPlace>();
  for (const c of shownCharacters(d, now)) {
    if (only !== undefined && !only.has(c.guid)) continue;
    const s = c.sighting;
    const zone = s === undefined ? undefined : zoneById.get(s.zone);
    if (s === undefined || zone === undefined || zone.kind !== "zone") continue;
    let place = byZone.get(zone.id);
    if (place === undefined) {
      place = { zone: zone.id, zoneName: zone.name, x: zone.lx, y: zone.ly, markers: [], dungeons: [] };
      byZone.set(zone.id, place);
    }
    const owner = c.owner === undefined ? undefined : people.get(c.owner);
    const marker: MapMarker = {
      guid: c.guid,
      initials: initials(c.name),
      zoneName: zone.name,
      seenAt: s.seenAt,
      seenAgo: timeAgo(s.seenAt, now),
      age: s.age,
    };
    if (c.name !== undefined) marker.name = c.name;
    if (c.classFile !== undefined) marker.classFile = c.classFile;
    if (c.className !== undefined) marker.className = c.className;
    if (c.level !== undefined) marker.level = c.level;
    if (c.raceName !== undefined) marker.raceName = c.raceName;
    if (c.mainTreeName !== undefined) marker.spec = c.mainTreeName;
    if (c.ilvl !== undefined) marker.ilvl = c.ilvl;
    const ownerName = owner?.displayName ?? c.ownerName;
    if (ownerName !== undefined) marker.ownerName = ownerName;
    if (owner?.via !== undefined) marker.viaName = owner.via.name;
    if (s.dungeon !== undefined) {
      marker.dungeonName = s.dungeon.name;
      if (!place.dungeons.includes(s.dungeon.name)) place.dungeons.push(s.dungeon.name);
    }
    if (s.age !== "live") marker.ageTag = `${daysOld(s.seenAt, now)}d`;
    place.markers.push(marker);
  }

  const places = [...byZone.values()].sort((a, b) => compareText(a.zone, b.zone));
  const occupied: Record<string, DataAge> = {};
  for (const place of places) {
    place.markers.sort((a, b) => b.seenAt - a.seenAt || compareText(a.name, b.name) || compareText(a.guid, b.guid));
    place.dungeons.sort(compareText);
    const newest = place.markers[0];
    if (newest !== undefined) occupied[place.zone] = newest.age;
  }
  return { places, occupied };
}
