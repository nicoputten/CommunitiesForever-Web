import type { CSSProperties, ReactNode } from "react";
import { classInfo, type ClassFile } from "@/core/gamedata/classes";
import styles from "./ClassIcon.module.css";

// The class icon of the boards (DS01HuntToday, DS02HuntMore; drawn by the designer for the bot's class icons): the
// class colour as a disc with a dark glyph. Glyphs on a 128 × 128 grid; `currentColor` is the class colour.

const INK = "var(--class-glyph)";

const GLYPHS: Record<ClassFile, ReactNode> = {
  WARRIOR: (
    <>
      <path d="M64 26 L96 37 V62 C96 82 82 95 64 102 C46 95 32 82 32 62 V37 Z" fill={INK} />
      <path
        d="M46 48 L64 72 L82 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  PALADIN: (
    <>
      <rect x="34" y="28" width="60" height="26" rx="6" fill={INK} />
      <rect x="58" y="50" width="12" height="46" rx="4" fill={INK} />
      <circle cx="64" cy="100" r="6" fill={INK} />
      <rect x="40" y="36" width="8" height="10" rx="2" fill="currentColor" />
      <rect x="80" y="36" width="8" height="10" rx="2" fill="currentColor" />
    </>
  ),
  HUNTER: (
    <>
      <path d="M46 26 C86 40 86 88 46 102" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M46 26 V102" stroke={INK} strokeWidth="3" />
      <path d="M30 64 H90" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <path d="M102 64 L86 54 L86 74 Z" fill={INK} />
      <path d="M30 64 L22 54 M30 64 L22 74" stroke={INK} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  ROGUE: (
    <>
      {[-38, 38].map((r) => (
        <g key={r} transform={`rotate(${r} 64 64)`}>
          <path d="M64 20 L71 62 L64 70 L57 62 Z" fill={INK} />
          <rect x="48" y="66" width="32" height="7" rx="3" fill={INK} />
          <rect x="60" y="72" width="8" height="20" rx="3" fill={INK} />
          <circle cx="64" cy="96" r="5" fill={INK} />
        </g>
      ))}
    </>
  ),
  PRIEST: (
    <>
      <path d="M64 18 C80 36 82 48 64 58 C46 48 48 36 64 18 Z" fill={INK} />
      <rect x="45" y="64" width="38" height="42" rx="5" fill={INK} />
      <path d="M45 72 C52 76 58 70 64 74 C70 78 76 72 83 74" fill="none" stroke="currentColor" strokeWidth="4" />
    </>
  ),
  SHAMAN: (
    <>
      <rect x="56" y="48" width="16" height="56" rx="3" fill="var(--gold-pale)" />
      <rect x="44" y="26" width="40" height="30" rx="6" fill="var(--gold-pale)" />
      <path d="M44 30 L24 24 L44 50 Z M84 30 L104 24 L84 50 Z" fill="var(--gold-pale)" />
      <rect x="52" y="34" width="8" height="7" rx="2" fill="currentColor" />
      <rect x="68" y="34" width="8" height="7" rx="2" fill="currentColor" />
      <rect x="56" y="46" width="16" height="4" rx="2" fill="currentColor" />
      <rect x="50" y="70" width="28" height="7" rx="3" fill="var(--gold-pale)" />
    </>
  ),
  MAGE: (
    <>
      <path d="M64 18 L73 55 L110 64 L73 73 L64 110 L55 73 L18 64 L55 55 Z" fill={INK} />
      <circle cx="64" cy="64" r="8" fill="currentColor" />
    </>
  ),
  WARLOCK: (
    <>
      <circle cx="64" cy="54" r="30" fill={INK} />
      <rect x="46" y="66" width="36" height="28" rx="7" fill={INK} />
      <circle cx="52" cy="56" r="8" fill="currentColor" />
      <circle cx="76" cy="56" r="8" fill="currentColor" />
      <path d="M64 66 L59 75 H69 Z" fill="currentColor" />
      <path d="M56 84 V94 M64 84 V94 M72 84 V94" stroke="currentColor" strokeWidth="3.5" />
    </>
  ),
  DRUID: (
    <>
      <ellipse cx="64" cy="80" rx="20" ry="17" fill={INK} />
      <ellipse cx="38" cy="56" rx="9" ry="11" fill={INK} />
      <ellipse cx="53" cy="38" rx="9" ry="12" fill={INK} />
      <ellipse cx="75" cy="38" rx="9" ry="12" fill={INK} />
      <ellipse cx="90" cy="56" rx="9" ry="11" fill={INK} />
    </>
  ),
};

/**
 * A class icon. `label` names it for screen readers (the class name by default); `decorative` hides it when the text
 * next to it says the class already.
 */
export function ClassIcon({
  classFile,
  className,
  decorative = false,
}: {
  classFile: string | undefined;
  className?: string;
  decorative?: boolean;
}) {
  const info = classInfo(classFile);
  const style = info === undefined ? undefined : ({ "--class": `var(${info.colorToken})` } as CSSProperties);
  return (
    <span
      className={`${styles.icon}${className === undefined ? "" : ` ${className}`}`}
      style={style}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": info?.name ?? "Unknown class" })}
    >
      {info !== undefined && (
        <svg viewBox="0 0 128 128" aria-hidden="true" focusable="false">
          {GLYPHS[info.classFile]}
        </svg>
      )}
    </span>
  );
}
