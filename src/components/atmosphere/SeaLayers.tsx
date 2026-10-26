import { wavePath } from "@/core/map/waves";
import styles from "./SeaLayers.module.css";

export interface SeaLayersProps {
  /** Coast outlines in world coordinates (zones.json `coast.K` and `coast.E`). */
  coastK: string;
  coastE: string;
  /**
   * map: the world map board's sea (glint, both wave groups, Maelstrom, surf, foam).
   * signin: the sign-in board's quieter sea behind the panel (waves and surf only, darker edge).
   */
  variant?: "map" | "signin";
  /** Prefix for the gradient and filter ids; unique per SVG on the page. */
  idPrefix?: string;
}

// The Maelstrom and the moonlight glint are placed as on the map board (design/boards/map), in world coordinates.
const MAELSTROM = { x: 548, y: 575 };
const MAELSTROM_RINGS = "M0 0m-3 0a3 3 0 1 1 6 0a7 7 0 1 1 -14 0a12 12 0 1 1 24 0a18 18 0 1 1 -36 0a26 26 0 1 1 52 0";
const GLINT = { cx: 560, cy: 300, rx: 260, ry: 120 };

/**
 * The animated sea of DESIGN.md §5, as one SVG group for a 1440 × 900 world viewBox: sea gradient · moonlight glint ·
 * wave strokes (2 groups) · Maelstrom · surf · foam. The map (WEB-25) puts its zone fills right after it. Decorative:
 * hidden from assistive tech, no pointer events. Ambient loops follow the Motion setting (motion.ts).
 */
export function SeaLayers({ coastK, coastE, variant = "map", idPrefix = "sea" }: SeaLayersProps) {
  const map = variant === "map";
  const sea = `${idPrefix}-gradient`;
  const glint = `${idPrefix}-glint`;
  const blur = `${idPrefix}-blur`;
  return (
    <g aria-hidden="true" className={styles.sea} data-ambient="">
      <defs>
        {map ? (
          <radialGradient id={sea} cx="42%" cy="46%" r="78%">
            <stop offset="0" className={styles.stopLight} />
            <stop offset="0.55" className={styles.stopMid} />
            <stop offset="1" className={styles.stopDeep} />
          </radialGradient>
        ) : (
          <radialGradient id={sea} cx="45%" cy="50%" r="75%">
            <stop offset="0" className={styles.stopLight} />
            <stop offset="1" className={styles.stopEdge} />
          </radialGradient>
        )}
        {map && (
          <radialGradient id={glint} cx="50%" cy="50%" r="50%">
            <stop offset="0" className={styles.glintCentre} />
            <stop offset="1" className={styles.glintEdge} />
          </radialGradient>
        )}
        <filter id={blur} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect width="1440" height="900" fill={`url(#${sea})`} />
      {map && (
        <ellipse
          className={styles.glint}
          cx={GLINT.cx}
          cy={GLINT.cy}
          rx={GLINT.rx}
          ry={GLINT.ry}
          fill={`url(#${glint})`}
        />
      )}
      <path className={`${styles.wave} ${styles.waveA}`} d={wavePath(0, map ? 70 : 40)} />
      <path className={`${styles.wave} ${styles.waveB}`} d={wavePath(1, map ? 70 : 40)} />
      {map && (
        <g transform={`translate(${MAELSTROM.x} ${MAELSTROM.y})`}>
          <path className={styles.maelstrom} d={MAELSTROM_RINGS} />
        </g>
      )}
      <g className={styles.surf} filter={`url(#${blur})`}>
        <path className={styles.surfBase} d={coastK} />
        <path className={styles.surfBase} d={coastE} />
        <path className={`${styles.surfSwell} ${styles.surfK}`} d={coastK} />
        <path className={`${styles.surfSwell} ${styles.surfE}`} d={coastE} />
      </g>
      {map && (
        <g className={styles.foam}>
          <path className={styles.foamK} d={coastK} />
          <path className={styles.foamE} d={coastE} />
        </g>
      )}
    </g>
  );
}
