import type { CSSProperties } from "react";
import map from "@/core/map/zones.json";
import { miniWavePath } from "@/core/map/waves";
import { entranceMap } from "@/core/views/map";
import { DungeonIcon } from "@/components/ui/icons";
import mini from "@/components/character/MiniMap.module.css";
import styles from "./Dungeon.module.css";

const zoneById = new Map(map.zones.map((z) => [z.id, z]));
const LABEL = 6;

/**
 * The dungeon page's hero background (WEB-42, Nico 2026-10-28: the board's picture is our own map): a still crop of
 * the world map around the entrance, built from the character page's mini map pieces, with the entrance marked. The
 * map keeps its own shape, centred on the entrance, which sits at the hero's `--entrance-y` (Dungeon.module.css).
 */
export function EntranceMap({ zone, x, y }: { zone: string; x: number; y: number }) {
  const { box, zones, coasts } = entranceMap(x, y);
  const shapes = zones.map((id) => zoneById.get(id)).filter((z) => z !== undefined);
  return (
    <div className={styles.heroMap} aria-hidden="true">
      <svg
        className={styles.heroSvg}
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        style={{ "--map-ratio": `${box.width} / ${box.height}` } as CSSProperties}
      >
        <defs>
          <linearGradient id="mini-land" x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0" className={mini.landTop} />
            <stop offset="1" className={mini.landBottom} />
          </linearGradient>
        </defs>
        <rect x={box.x} y={box.y} width={box.width} height={box.height} className={mini.sea} />
        <path d={miniWavePath(box)} className={mini.wave} />
        {shapes.map((z) => (
          <path key={z.id} d={z.d} fillRule="evenodd" className={mini.land} data-kind={z.kind} />
        ))}
        {shapes.map((z) => (
          <path
            key={z.id}
            d={z.d}
            fillRule="evenodd"
            className={mini.zone}
            data-kind={z.kind}
            data-here={z.id === zone || undefined}
          />
        ))}
        {coasts.map((c) => (
          <path key={c} d={map.coast[c]} className={mini.coast} />
        ))}
        {shapes.map((z) => (
          <text
            key={z.id}
            x={z.lx}
            y={z.ly + 2}
            fontSize={LABEL}
            className={mini.label}
            data-kind={z.kind}
            data-here={z.id === zone || undefined}
          >
            {z.name}
          </text>
        ))}
      </svg>
      <span className={styles.entrance}>
        <DungeonIcon className={styles.entranceIcon} />
      </span>
    </div>
  );
}
