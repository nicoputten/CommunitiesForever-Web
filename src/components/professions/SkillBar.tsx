import type { CSSProperties } from "react";
import { MAX_SKILL } from "@/core/gamedata";
import styles from "./SkillBar.module.css";

export interface SkillBarProps {
  rank: number;
  /** The cap of the current rank (75, 150, 225, 300); no cap shading when the addon didn't record it. */
  max?: number;
  /** ★ the best in the group: a gold fill (gold to pale gold at 300). */
  best?: boolean;
  /** The owner's data is 7+ days old: the bar fades (DESIGN.md §11). */
  old?: boolean;
}

const share = (n: number) => Math.min(Math.max(n, 0), MAX_SKILL) / MAX_SKILL;

/** A skill on the 300 scale (professions board): the cap shaded, ticks at 75, 150 and 225. Decorative; the value is
 * written next to it. */
export function SkillBar({ rank, max, best = false, old = false }: SkillBarProps) {
  const style = { "--skill": share(rank), "--cap": max === undefined ? 0 : share(max) } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      className={styles.track}
      style={style}
      data-best={best || undefined}
      data-max={(best && rank >= MAX_SKILL) || undefined}
      data-old={old || undefined}
    >
      <span className={styles.cap} />
      <span className={styles.fill} />
      <span className={styles.tick} />
      <span className={styles.tick} />
      <span className={styles.tick} />
    </span>
  );
}
