import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

export interface SkeletonProps {
  /** text: a line (radius 6) · circle: a disc or avatar · pill: a badge. */
  shape?: "text" | "circle" | "pill";
  /** CSS lengths, e.g. "60%" or "var(--size-disc)". */
  width?: string;
  height?: string;
}

/** Shimmering placeholder that keeps the layout still while data loads (loading board). Decorative; the region
 * that is loading sets aria-busy. */
export function Skeleton({ shape = "text", width, height }: SkeletonProps) {
  const style: CSSProperties = {};
  if (width !== undefined) style.width = width;
  if (height !== undefined) style.height = height;
  return <span aria-hidden="true" className={styles.skeleton} data-shape={shape} style={style} />;
}
