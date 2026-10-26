import { WAVE_TILE, wavePath } from "@/core/map/waves";
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
  /**
   * map only: the sea goes on past the 1440 × 900 world (the world map shows more than the world around it, Nico
   * 2026-10-26): the gradient pads out to deep sea and the waves repeat as a seamless tile around the world.
   */
  infinite?: boolean;
}

// The tiles around the world: the wave tile repeated once in every direction (-1, 0, 1).
const AROUND = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => ({ i, j }))).filter(({ i, j }) => i !== 0 || j !== 0);

/** The map board's sea gradient (objectBoundingBox cx 42%, cy 46%, r 78% of the 1440 × 900 rect) in world units. */
const SEA_ELLIPSE = "translate(604.8 414) scale(1123.2 702)";

// The Maelstrom and the moonlight glint are placed as on the map board (design/boards/map), in world coordinates.
const MAELSTROM = { x: 548, y: 575 };
const MAELSTROM_RINGS = "M0 0m-3 0a3 3 0 1 1 6 0a7 7 0 1 1 -14 0a12 12 0 1 1 24 0a18 18 0 1 1 -36 0a26 26 0 1 1 52 0";
const GLINT = { cx: 560, cy: 300, rx: 260, ry: 120 };

/**
 * The animated sea of DESIGN.md §5, as one SVG group for a 1440 × 900 world viewBox: sea gradient · moonlight glint ·
 * wave strokes (2 groups) · Maelstrom · surf · foam. The map (WEB-25) puts its zone fills right after it. Decorative:
 * hidden from assistive tech, no pointer events. Ambient loops follow the Motion setting (motion.ts).
 */
export function SeaLayers({ coastK, coastE, variant = "map", idPrefix = "sea", infinite = false }: SeaLayersProps) {
  const map = variant === "map";
  const endless = map && infinite;
  const sea = `${idPrefix}-gradient`;
  const glint = `${idPrefix}-glint`;
  const blur = `${idPrefix}-blur`;
  return (
    <g aria-hidden="true" className={styles.sea} data-ambient="">
      <defs>
        {endless ? (
          <radialGradient id={sea} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform={SEA_ELLIPSE}>
            <stop offset="0" className={styles.stopLight} />
            <stop offset="0.55" className={styles.stopMid} />
            <stop offset="1" className={styles.stopDeep} />
          </radialGradient>
        ) : map ? (
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
      {endless ? (
        <rect
          x={-WAVE_TILE.width}
          y={-WAVE_TILE.height}
          width={3 * WAVE_TILE.width}
          height={3 * WAVE_TILE.height}
          fill={`url(#${sea})`}
        />
      ) : (
        <rect width="1440" height="900" fill={`url(#${sea})`} />
      )}
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
      {endless ? (
        ([0, 1] as const).map((group) => (
          <g key={group} className={`${styles.wave} ${group === 0 ? styles.waveA : styles.waveB}`}>
            <path
              id={`${idPrefix}-wave-${group}`}
              d={wavePath(group, WAVE_TILE.top, WAVE_TILE.width, WAVE_TILE.height)}
            />
            {AROUND.map(({ i, j }) => (
              <use
                key={`${i} ${j}`}
                href={`#${idPrefix}-wave-${group}`}
                x={i * WAVE_TILE.width}
                y={j * WAVE_TILE.height}
              />
            ))}
          </g>
        ))
      ) : (
        <>
          <path className={`${styles.wave} ${styles.waveA}`} d={wavePath(0, map ? 70 : 40)} />
          <path className={`${styles.wave} ${styles.waveB}`} d={wavePath(1, map ? 70 : 40)} />
        </>
      )}
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
