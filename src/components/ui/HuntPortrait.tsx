import { ClassIcon } from "./ClassIcon";
import styles from "./HuntPortrait.module.css";

export interface HuntPortraitProps {
  /** The race's initials ("Gn", `raceShort` in src/core/views/hunt.ts). */
  short: string;
  /** The class's classFile ("MAGE"). */
  classFile: string;
  /** "Gnome Mage": the portrait's accessible name. Leave out when the name is written next to it. */
  label?: string;
  /** lg: the quarry (ring 76, icon 40); md: the Doomsday Hunt card (46, 24); sm: the next days (32, 20). */
  size?: "lg" | "md" | "sm";
}

/**
 * A Hunt target's portrait (boards mission-pool-v2-overview, doomsday Hunt): the race's initials in a gold ring, the
 * class icon on its lower right.
 */
export function HuntPortrait({ short, classFile, label, size = "sm" }: HuntPortraitProps) {
  return (
    <span
      className={styles.portrait}
      data-size={size}
      {...(label === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      <span className={styles.ring}>{short}</span>
      <span className={styles.cls}>
        <ClassIcon classFile={classFile} size={size === "lg" ? "lg" : size === "md" ? "md" : "sm"} decorative />
      </span>
    </span>
  );
}
