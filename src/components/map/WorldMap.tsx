import type { CSSProperties, ReactNode } from "react";
import map from "@/core/map/zones.json";
import { mapDungeons, type MapDungeon } from "@/core/views/dungeon";
import { CONTINENT_SPLIT, continentViewBox, type Continent, type WorldMapView } from "@/core/views/map";
import { SeaLayers } from "@/components/atmosphere/SeaLayers";
import { MapStage } from "./MapStage";
import styles from "./WorldMap.module.css";

export interface WorldMapProps {
  view: WorldMapView;
  continent: Continent;
  /** GUID of the selected character (`?character=`), if any. */
  selected?: string;
  /** GUIDs of the sightings that drop in (`?drop=`, WEB-26). */
  drop?: string[];
  /** Over the map, outside pan and zoom: the roll call (WEB-27), or before the first upload the empty-site card and
   * guest list (WEB-29). */
  panel?: ReactNode;
  /** Below 1024 px: the roll call in the phone's bottom sheet (WEB-28). */
  sheet?: ReactNode;
  /** The dungeon entrances with their planned runs (WEB-42); without runs when left out. */
  dungeons?: MapDungeon[];
}

// Placed as on the map board (design/boards/map), world coordinates: decoration, not game data.
const COMPASS = { x: 520, y: 130 };
const MAELSTROM_LABEL = { x: 548, y: 622 };
const CONTINENT_NAMES = [
  { name: "Kalimdor", transform: "translate(66 470) rotate(-90)" },
  { name: "Eastern Kingdoms", transform: "translate(1062 420) rotate(90)" },
];

const capitals = map.cities.filter((c) => c.cap === 1);
const towns = map.cities.filter((c) => c.cap === 0);
const NO_RUNS = mapDungeons([], 0);
const WORLD = continentViewBox("azeroth");
const FRAMES = {
  azeroth: WORLD,
  kalimdor: continentViewBox("kalimdor"),
  "eastern-kingdoms": continentViewBox("eastern-kingdoms"),
};

/** Labels keep their screen size at any zoom: scaled back around their anchor (world units). */
const anchor = (x: number, y: number) => ({ "--ox": x, "--oy": y }) as CSSProperties;
/** A zone name's top above its anchor, in world units: its lines sit around the anchor (WEB-65, bug 6). */
const labelTop = (size: number, lines: number) => `${(lines > 1 ? 1 : 0.35) * size}px`;

/**
 * The world map (DESIGN.md §5, boards `map` and `map-states`): an SVG rendered on the server from zones.json with
 * the layers bottom to top (sea · zone fills · grain · occupied tint and borders · coast · capitals · labels), and
 * the markers as an HTML overlay (MapStage). The whole 1440 × 900 world is drawn; pan, zoom and the continent switch
 * (a fly to the continent's frame) are MapStage's (WEB-26). Towns show from 2×, dungeons from 4×.
 */
export function WorldMap({ view, continent, selected, drop, panel, sheet, dungeons = NO_RUNS }: WorldMapProps) {
  const box = WORLD;
  return (
    <section
      className={styles.frame}
      aria-label="World map"
      data-page="map"
      data-continent={continent}
      data-sheet={sheet === undefined ? undefined : ""}
    >
      <MapStage
        places={view.places}
        box={box}
        selected={selected}
        frames={FRAMES}
        split={CONTINENT_SPLIT}
        dungeons={dungeons}
        drop={drop}
        sheet={sheet}
      >
        <svg
          className={styles.svg}
          viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Map of Kalimdor and the Eastern Kingdoms"
        >
          <defs>
            <linearGradient id="map-land" x1="0" y1="0" x2="0.25" y2="1">
              <stop offset="0" className={styles.landTop} />
              <stop offset="1" className={styles.landBottom} />
            </linearGradient>
            <filter id="map-grain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves={2} seed={3} />
              <feColorMatrix values="0 0 0 0 0.75  0 0 0 0 0.82  0 0 0 0 0.95  0 0 0 0.09 0" />
            </filter>
            <clipPath id="map-land-clip">
              <path d={map.coast.K} />
              <path d={map.coast.E} />
            </clipPath>
          </defs>
          <SeaLayers coastK={map.coast.K} coastE={map.coast.E} idPrefix="map-sea" infinite />
          <g aria-hidden="true" className={styles.decor}>
            <text x={MAELSTROM_LABEL.x} y={MAELSTROM_LABEL.y} className={styles.maelstromLabel}>
              The Maelstrom
            </text>
            <g transform={`translate(${COMPASS.x} ${COMPASS.y})`} className={styles.compass}>
              <circle r="22" />
              <circle r="15" className={styles.compassDash} />
              <path d="M0 -32 L4 0 L0 32 L-4 0 Z M-32 0 L0 -4 L32 0 L0 4 Z" className={styles.compassStar} />
            </g>
            <text x={COMPASS.x} y={COMPASS.y - 38} className={styles.compassN}>
              N
            </text>
          </g>
          <g aria-hidden="true">
            {map.zones.map((z) => (
              <path
                key={z.id}
                d={z.d}
                fillRule="evenodd"
                className={z.kind === "terrain" ? styles.terrainFill : styles.zoneFill}
                data-zone={z.kind === "zone" ? z.id : undefined}
                data-name={z.kind === "zone" ? z.name : undefined}
              />
            ))}
          </g>
          <rect
            aria-hidden="true"
            width={map.width}
            height={map.height}
            filter="url(#map-grain)"
            clipPath="url(#map-land-clip)"
            className={styles.grain}
          />
          <g aria-hidden="true" className={styles.passive}>
            {map.zones.map((z) => (
              <path
                key={z.id}
                d={z.d}
                fillRule="evenodd"
                className={z.kind === "terrain" ? styles.terrainLine : styles.zoneLine}
                data-tint={z.kind === "zone" ? z.id : undefined}
                data-occupied={view.occupied[z.id]}
              />
            ))}
            <path d={map.coast.K} className={styles.coast} />
            <path d={map.coast.E} className={styles.coast} />
          </g>
          <g aria-hidden="true" className={`${styles.passive} ${styles.towns}`}>
            {towns.map((c) => (
              <g key={c.name} className={styles.keepScale} style={anchor(c.x, c.y)}>
                <circle cx={c.x} cy={c.y} r="2" className={styles.town} />
                <text x={c.x + 6} y={c.y + 3.5} className={styles.capitalLabel}>
                  {c.name}
                </text>
              </g>
            ))}
          </g>
          <g aria-hidden="true" className={styles.passive}>
            {capitals.map((c) => (
              <g key={c.name} className={styles.keepScale} style={anchor(c.x, c.y)}>
                <rect
                  x="-3.5"
                  y="-3.5"
                  width="7"
                  height="7"
                  transform={`translate(${c.x} ${c.y}) rotate(45)`}
                  className={styles.capital}
                />
                <text x={c.x + 7} y={c.y + 3.5} className={styles.capitalLabel}>
                  {c.name}
                </text>
              </g>
            ))}
          </g>
          <g aria-hidden="true" className={styles.passive}>
            {map.zones.map((z) => {
              const two = z.lines.length > 1;
              return (
                <text
                  key={z.id}
                  fontSize={z.size}
                  className={`${z.kind === "terrain" ? styles.terrainLabel : styles.label} ${styles.keepScale}`}
                  style={{ ...anchor(z.lx, z.ly), "--label-top": labelTop(z.size, z.lines.length) } as CSSProperties}
                  data-label={z.kind === "zone" ? z.id : undefined}
                  data-occupied={view.occupied[z.id]}
                >
                  <tspan x={z.lx} y={two ? z.ly - z.size * 0.3 : z.ly + z.size * 0.35}>
                    {z.lines[0]}
                  </tspan>
                  {two && (
                    <tspan x={z.lx} y={z.ly + z.size * 0.85}>
                      {z.lines[1]}
                    </tspan>
                  )}
                </text>
              );
            })}
            {CONTINENT_NAMES.map((c) => (
              <text key={c.name} transform={c.transform} className={styles.continentName}>
                {c.name}
              </text>
            ))}
          </g>
        </svg>
      </MapStage>
      {panel}
    </section>
  );
}
