import type { ReactNode } from "react";
import styles from "./Atmosphere.module.css";

export interface AtmosphereProps {
  /**
   * map: alive (fog banks, light shafts; the sea is SeaLayers inside the map SVG). Phone keeps one fog bank, as on
   * the phone-map board.
   * signin: alive (fog, embers) around the sign-in panel, over `children` (the drifting map).
   * calm: data pages: the boards' glow at the top of the page, no motion.
   */
  variant: "map" | "signin" | "calm";
  /** A backdrop under the fog (sign-in: the drifting map). */
  children?: ReactNode;
}

const EMBERS = [1, 2, 3, 4] as const;

/**
 * The atmosphere around the data (DESIGN.md §1, §6): fixed behind the page, decorative only (aria-hidden, no focus,
 * no pointer events), CSS only. Its loops follow the Motion setting and pause while the tab is hidden (motion.ts).
 */
export function Atmosphere({ variant, children }: AtmosphereProps) {
  if (variant === "calm") return <div aria-hidden="true" className={styles.calm} data-atmosphere="calm" />;
  return (
    <div aria-hidden="true" className={styles.root} data-atmosphere={variant} data-ambient="">
      {children}
      {variant === "map" ? (
        <div className={styles.stage}>
          <div className={`${styles.shaft} ${styles.shaft1}`} />
          <div className={`${styles.shaft} ${styles.shaft2}`} />
          <div className={`${styles.fog} ${styles.mapFog1}`} />
          <div className={`${styles.fog} ${styles.mapFog2}`} />
          <div className={`${styles.fog} ${styles.mapFog3}`} />
        </div>
      ) : (
        <>
          <div className={styles.vignette} />
          <div className={`${styles.fog} ${styles.signinFog1}`} />
          <div className={`${styles.fog} ${styles.signinFog2}`} />
          {EMBERS.map((n) => (
            <span key={n} className={`${styles.ember} ${styles[`ember${n}`]}`} />
          ))}
        </>
      )}
    </div>
  );
}
