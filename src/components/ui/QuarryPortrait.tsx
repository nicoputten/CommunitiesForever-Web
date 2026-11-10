import type { QuarryView } from "@/core/views/doomsdayHunt";
import { ClassIcon } from "./ClassIcon";
import styles from "./QuarryPortrait.module.css";

/**
 * The Hunt's quarry as a portrait (boards DS01HuntToday, DS02HuntMore, MP05Overview): the race's letters in a gold ring
 * with the class icon on its lower right. `md` 46 px ring and 24 px icon (the Hunt card), `sm` 32 px and 18 px
 * (tomorrow's quarry, the board's header). Its name is the quarry's ("Night Elf Hunter").
 */
export function QuarryPortrait({ quarry, size = "md" }: { quarry: QuarryView; size?: "md" | "sm" }) {
  return (
    <span className={styles.portrait} data-size={size} role="img" aria-label={quarry.name}>
      <span className={styles.ring} aria-hidden="true">
        {quarry.raceShort}
      </span>
      <ClassIcon classFile={quarry.classFile} className={styles.class} decorative />
    </span>
  );
}
