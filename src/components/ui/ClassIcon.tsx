import type { CSSProperties, ReactNode } from "react";
import { classInfo, type ClassFile } from "@/core/gamedata/classes";
import styles from "./ClassIcon.module.css";

// The round class icon of the Hunt boards (mission-pool-v2-hunt, doomsday Hunt; the artwork of the bot's class icons):
// the class colour with a dark sign on it. Colours from the class tokens; the shapes in a 128 × 128 box.

const SIGNS: Readonly<Record<ClassFile, ReactNode>> = {
  WARRIOR: (
    <>
      <path className={styles.ink} d="M64 26 L96 37 V62 C96 82 82 95 64 102 C46 95 32 82 32 62 V37 Z" />
      <path className={styles.cutLine} d="M46 48 L64 72 L82 48" strokeWidth="9" />
    </>
  ),
  PALADIN: (
    <>
      <rect className={styles.ink} x="34" y="28" width="60" height="26" rx="6" />
      <rect className={styles.ink} x="58" y="50" width="12" height="46" rx="4" />
      <circle className={styles.ink} cx="64" cy="100" r="6" />
      <rect className={styles.cut} x="40" y="36" width="8" height="10" rx="2" />
      <rect className={styles.cut} x="80" y="36" width="8" height="10" rx="2" />
    </>
  ),
  HUNTER: (
    <>
      <path className={styles.inkLine} d="M46 26 C86 40 86 88 46 102" strokeWidth="9" />
      <path className={styles.inkLine} d="M46 26 V102" strokeWidth="3" />
      <path className={styles.inkLine} d="M30 64 H90" strokeWidth="7" />
      <path className={styles.ink} d="M102 64 L86 54 L86 74 Z" />
      <path className={styles.inkLine} d="M30 64 L22 54 M30 64 L22 74" strokeWidth="5" />
    </>
  ),
  ROGUE: (
    <>
      {[-38, 38].map((r) => (
        <g key={r} transform={`rotate(${r} 64 64)`}>
          <path className={styles.ink} d="M64 20 L71 62 L64 70 L57 62 Z" />
          <rect className={styles.ink} x="48" y="66" width="32" height="7" rx="3" />
          <rect className={styles.ink} x="60" y="72" width="8" height="20" rx="3" />
          <circle className={styles.ink} cx="64" cy="96" r="5" />
        </g>
      ))}
    </>
  ),
  PRIEST: (
    <>
      <path className={styles.ink} d="M64 18 C80 36 82 48 64 58 C46 48 48 36 64 18 Z" />
      <rect className={styles.ink} x="45" y="64" width="38" height="42" rx="5" />
      <path className={styles.cutLine} d="M45 72 C52 76 58 70 64 74 C70 78 76 72 83 74" strokeWidth="4" />
    </>
  ),
  SHAMAN: (
    <>
      <rect className={styles.pale} x="56" y="48" width="16" height="56" rx="3" />
      <rect className={styles.pale} x="44" y="26" width="40" height="30" rx="6" />
      <path className={styles.pale} d="M44 30 L24 24 L44 50 Z M84 30 L104 24 L84 50 Z" />
      <rect className={styles.cut} x="52" y="34" width="8" height="7" rx="2" />
      <rect className={styles.cut} x="68" y="34" width="8" height="7" rx="2" />
      <rect className={styles.cut} x="56" y="46" width="16" height="4" rx="2" />
      <rect className={styles.pale} x="50" y="70" width="28" height="7" rx="3" />
    </>
  ),
  MAGE: (
    <>
      <path className={styles.ink} d="M64 18 L73 55 L110 64 L73 73 L64 110 L55 73 L18 64 L55 55 Z" />
      <circle className={styles.cut} cx="64" cy="64" r="8" />
    </>
  ),
  WARLOCK: (
    <>
      <circle className={styles.ink} cx="64" cy="54" r="30" />
      <rect className={styles.ink} x="46" y="66" width="36" height="28" rx="7" />
      <circle className={styles.cut} cx="52" cy="56" r="8" />
      <circle className={styles.cut} cx="76" cy="56" r="8" />
      <path className={styles.cut} d="M64 66 L59 75 H69 Z" />
      <path className={styles.cutLine} d="M56 84 V94 M64 84 V94 M72 84 V94" strokeWidth="3.5" />
    </>
  ),
  DRUID: (
    <>
      <ellipse className={styles.ink} cx="64" cy="80" rx="20" ry="17" />
      <ellipse className={styles.ink} cx="38" cy="56" rx="9" ry="11" />
      <ellipse className={styles.ink} cx="53" cy="38" rx="9" ry="12" />
      <ellipse className={styles.ink} cx="75" cy="38" rx="9" ry="12" />
      <ellipse className={styles.ink} cx="90" cy="56" rx="9" ry="11" />
    </>
  ),
};

export interface ClassIconProps {
  /** The classFile token ("MAGE"); an unknown one draws nothing. */
  classFile: string | undefined;
  /** sm 20 px (grid heads, lists), md 24 px, lg 40 px (the quarry). */
  size?: "sm" | "md" | "lg";
  /** The text next to it names the class: hidden from screen readers. */
  decorative?: boolean;
}

/** A class's round icon (boards mission-pool-v2-hunt, doomsday Hunt). */
export function ClassIcon({ classFile, size = "sm", decorative = false }: ClassIconProps) {
  const info = classInfo(classFile);
  if (info === undefined) return null;
  const style = { "--class": `var(${info.colorToken})` } as CSSProperties;
  return (
    <span
      className={styles.icon}
      data-size={size}
      style={style}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": info.name })}
    >
      <svg viewBox="0 0 128 128" aria-hidden="true" focusable="false">
        <circle className={styles.disc} cx="64" cy="64" r="60" />
        {SIGNS[info.classFile]}
        <circle className={styles.rim} cx="64" cy="64" r="60.5" strokeWidth="4" />
      </svg>
    </span>
  );
}
