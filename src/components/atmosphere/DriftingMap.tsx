import map from "@/core/map/zones.json";
import { SeaLayers } from "./SeaLayers";
import styles from "./DriftingMap.module.css";

/**
 * The sign-in board's backdrop: the world map, dimmed, drifting slowly (60 s) under the fog. Decorative; it goes inside
 * <Atmosphere variant="signin">. WEB-17 adds the live pings on top.
 */
export function DriftingMap() {
  return (
    <div className={styles.drift}>
      <svg className={styles.svg} viewBox="0 0 1440 900" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="signin-land" x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0" className={styles.landTop} />
            <stop offset="1" className={styles.landBottom} />
          </linearGradient>
        </defs>
        <SeaLayers coastK={map.coast.K} coastE={map.coast.E} variant="signin" idPrefix="signin-sea" />
        {map.zones.map((z) => (
          <path key={z.id} className={styles.zone} d={z.d} fill="url(#signin-land)" fillRule="evenodd" />
        ))}
        <path className={styles.coast} d={map.coast.K} />
        <path className={styles.coast} d={map.coast.E} />
      </svg>
    </div>
  );
}
