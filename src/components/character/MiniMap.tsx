import Link from "next/link";
import type { CSSProperties } from "react";
import map from "@/core/map/zones.json";
import { miniWavePath } from "@/core/map/waves";
import { timeAgo } from "@/core/views/age";
import type { CharacterView } from "@/core/views/characters";
import type { MiniMapView } from "@/core/views/map";
import { FAN_MAX, fanOffsets } from "@/core/views/mapMarkers";
import { CharacterMarker } from "@/components/map/Markers";
import markerStyles from "@/components/map/Markers.module.css";
import { characterHref } from "@/components/roster/CharacterRow";
import panel from "./Panel.module.css";
import styles from "./MiniMap.module.css";

// Label sizes and offsets of the character board's mini map (world units): neighbours 4.5, the character's zone 6,
// set below the marker.
const LABEL = 4.5;
const LABEL_HERE = 6;
const LABEL_BELOW = 14;

const zoneById = new Map(map.zones.map((z) => [z.id, z]));

export interface MiniMapProps {
  character: CharacterView;
  view?: MiniMapView;
  /** "Lia Thornwhisper is here too". */
  hereToo?: string;
  now: number;
}

/**
 * Last seen (character board): the zone on a small, still map built from WEB-25's pieces (zones.json, the occupied
 * tint, CharacterMarker), the character in its zone with the others seen there, and a link to the map.
 */
export function MiniMap({ character: c, view, hereToo, now }: MiniMapProps) {
  const s = c.sighting;
  return (
    <section className={panel.box} aria-labelledby="last-seen">
      <h2 id="last-seen" className={panel.title}>
        Last seen
      </h2>
      {s === undefined ? (
        <div>
          <p className={styles.where}>Unknown whereabouts</p>
          <p className={panel.meta}>The addon hasn&apos;t seen this character in a zone yet.</p>
        </div>
      ) : view === undefined ? (
        <p className={panel.meta}>
          Last seen in {s.zoneText} · {timeAgo(s.seenAt, now)}
          {hereToo !== undefined && ` · ${hereToo}`}
        </p>
      ) : (
        <>
          <Frame view={view} guid={c.guid} />
          <div className={styles.caption}>
            <div>
              <p className={styles.where}>
                {s.dungeon === undefined ? view.place.zoneName : `${s.dungeon.name}, ${view.place.zoneName}`}
              </p>
              <p className={panel.meta}>
                Seen {timeAgo(s.seenAt, now)}
                {hereToo !== undefined && ` · ${hereToo}`}
              </p>
            </div>
            <Link className={panel.link} href={`/?character=${encodeURIComponent(c.guid)}`}>
              On the map →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function Frame({ view, guid }: { view: MiniMapView; guid: string }) {
  const { box, place } = view;
  const zones = view.zones.map((id) => zoneById.get(id)!).filter((z) => z !== undefined);
  // The character first, then the newest others, fanned out around the zone's anchor as on the world map.
  const markers = [
    ...place.markers.filter((m) => m.guid === guid),
    ...place.markers.filter((m) => m.guid !== guid),
  ].slice(0, FAN_MAX);
  const offsets = markers.length > 1 ? fanOffsets(markers.length) : [{ dx: 0, dy: 0 }];
  const at = {
    "--x": `${((place.x - box.x) / box.width) * 100}%`,
    "--y": `${((place.y - box.y) / box.height) * 100}%`,
  } as CSSProperties;
  return (
    <div className={styles.frame}>
      <svg
        className={styles.svg}
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Map of ${place.zoneName}`}
      >
        <defs>
          <linearGradient id="mini-land" x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0" className={styles.landTop} />
            <stop offset="1" className={styles.landBottom} />
          </linearGradient>
        </defs>
        <g aria-hidden="true">
          <rect x={box.x} y={box.y} width={box.width} height={box.height} className={styles.sea} />
          <path d={miniWavePath(box)} className={styles.wave} />
          {zones.map((z) => (
            <path key={z.id} d={z.d} fillRule="evenodd" className={styles.land} data-kind={z.kind} />
          ))}
          {zones.map((z) => (
            <path
              key={z.id}
              d={z.d}
              fillRule="evenodd"
              className={styles.zone}
              data-kind={z.kind}
              data-occupied={view.occupied[z.id]}
              data-here={z.id === place.zone || undefined}
            />
          ))}
          {view.coasts.map((c) => (
            <path key={c} d={map.coast[c]} className={styles.coast} />
          ))}
          {zones.map((z) => {
            const here = z.id === place.zone;
            return (
              <text
                key={z.id}
                x={z.lx}
                y={here ? z.ly + LABEL_BELOW : z.ly + 2}
                fontSize={here ? LABEL_HERE : LABEL}
                className={styles.label}
                data-kind={z.kind}
                data-here={here || undefined}
              >
                {z.name}
              </text>
            );
          })}
        </g>
      </svg>
      <div className={styles.overlay}>
        <div className={markerStyles.place} style={at}>
          {markers.map((m, i) => (
            <span
              key={m.guid}
              className={styles.marker}
              data-other={m.guid !== guid || undefined}
              style={{ "--dx": `${offsets[i]!.dx}px`, "--dy": `${offsets[i]!.dy}px` } as CSSProperties}
            >
              <CharacterMarker
                marker={m}
                selected={m.guid === guid}
                badge
                href={m.guid === guid || m.name === undefined ? undefined : characterHref(m.guid)}
              />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
