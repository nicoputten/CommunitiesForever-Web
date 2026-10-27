import map from "../map/zones.json";

// Map crops for the card images (WEB-41d): a zone highlighted among its neighbours, drawn from the site's own map
// (src/core/map/zones.json; map: Syrio, CC BY-SA 4.0, credited on every card that shows it).

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropZone {
  id: string;
  d: string;
  highlight: boolean;
}

export interface Crop {
  viewBox: Box;
  zones: CropZone[];
}

export const MAP_CREDIT = "Map: Syrio, CC BY-SA 4.0";

const ZONES = map.zones.filter((z) => z.kind === "zone");

/** The bounding box of an SVG path of absolute coordinates (zones.json writes only those). */
export function pathBox(d: string): Box {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]!);
    maxX = Math.max(maxX, nums[i]!);
    minY = Math.min(minY, nums[i + 1]!);
    maxY = Math.max(maxY, nums[i + 1]!);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

const boxes = new Map(ZONES.map((z) => [z.id, pathBox(z.d)]));

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The map zone with this name ("Stranglethorn Vale"); undefined when the map has none. */
export function zoneByName(name: string): { id: string; name: string; lx: number; ly: number } | undefined {
  const z = ZONES.find((zone) => zone.name === name);
  return z === undefined ? undefined : { id: z.id, name: z.name, lx: z.lx, ly: z.ly };
}

/**
 * A crop of the map with the zone in it, `aspect` = width / height of the image area. `zoom` is how much of the
 * crop the zone fills (0.5: half of the shorter side). `at` places the zone's centre in the crop (0.5, 0.5 centred;
 * 0.75 for a header whose map sits on the right).
 */
export function cropAround(
  zoneId: string,
  aspect: number,
  zoom = 0.5,
  at: [number, number] = [0.5, 0.5],
): Crop | undefined {
  const zone = boxes.get(zoneId);
  if (zone === undefined) return undefined;
  const h = Math.max(zone.h, zone.w / aspect) / zoom;
  const w = h * aspect;
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  const viewBox = { x: cx - w * at[0], y: cy - h * at[1], w, h };
  return {
    viewBox,
    zones: ZONES.filter((z) => overlaps(boxes.get(z.id)!, viewBox)).map((z) => ({
      id: z.id,
      d: z.d,
      highlight: z.id === zoneId,
    })),
  };
}

/** A map point inside a crop, as a fraction of its width and height. */
export function inCrop(crop: Crop, x: number, y: number): [number, number] {
  return [(x - crop.viewBox.x) / crop.viewBox.w, (y - crop.viewBox.y) / crop.viewBox.h];
}
