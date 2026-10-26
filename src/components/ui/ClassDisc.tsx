import type { CSSProperties } from "react";
import { classInfo } from "@/core/gamedata/classes";
import { initials } from "@/core/views/text";
import styles from "./ClassDisc.module.css";

export interface ClassDiscProps {
  /** Full character name; undefined for a stub ("?"). */
  name?: string;
  /** The upload's classFile; an unknown or missing one gets a neutral disc. */
  classFile?: string;
  level?: number;
  /** md 44 px (roster rows), sm 28 px (roll call chips), xs 26 px (roster table), report 38 px without level (session
   * report rows), card 36 px (map hover card). */
  size?: "md" | "sm" | "xs" | "report" | "card";
  /** Live data (< 6 h): the class glow of DESIGN.md §4. */
  live?: boolean;
}

/** Class disc with initials and level badge (roster-cards board). */
export function ClassDisc({ name, classFile, level, size = "md", live = false }: ClassDiscProps) {
  const info = classInfo(classFile);
  const style = info === undefined ? undefined : ({ "--disc": `var(${info.colorToken})` } as CSSProperties);
  const label = [info?.name ?? "Unknown class", level === undefined ? undefined : `level ${level}`]
    .filter((p) => p !== undefined)
    .join(", ");
  return (
    <span
      role="img"
      aria-label={label}
      className={styles.disc}
      data-size={size}
      data-class={info === undefined ? "unknown" : info.classFile.toLowerCase()}
      data-live={live || undefined}
      style={style}
    >
      <span aria-hidden="true">{initials(name)}</span>
      {level !== undefined && size === "md" && (
        <span aria-hidden="true" className={styles.level}>
          {level}
        </span>
      )}
    </span>
  );
}
