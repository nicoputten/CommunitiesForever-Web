import { SeaLayers } from "@/components/atmosphere/SeaLayers";
import map from "@/core/map/zones.json";
import styles from "./gallery.module.css";

/**
 * The map's sea layers as WEB-25 will slot them in: SeaLayers, then plain zone fills and the coast line on top.
 * Rendered on the server so zones.json stays out of the gallery's client bundle.
 */
export function SeaPreview() {
  return (
    <div className={styles.seaFrame}>
      <svg className={styles.seaSvg} viewBox="0 0 1440 900" role="img" aria-label="Animated sea preview">
        <defs>
          <linearGradient id="preview-land" x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0" className={styles.landTop} />
            <stop offset="1" className={styles.landBottom} />
          </linearGradient>
        </defs>
        <SeaLayers coastK={map.coast.K} coastE={map.coast.E} idPrefix="preview-sea" />
        {map.zones.map((z) => (
          <path
            key={z.id}
            className={z.kind === "terrain" ? styles.terrain : styles.zone}
            d={z.d}
            fill={z.kind === "terrain" ? undefined : "url(#preview-land)"}
            fillRule="evenodd"
          />
        ))}
        <path className={styles.coast} d={map.coast.K} />
        <path className={styles.coast} d={map.coast.E} />
      </svg>
    </div>
  );
}
