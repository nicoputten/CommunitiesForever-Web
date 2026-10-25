import type { Faction } from "@/core/gamedata/races";
import styles from "./FactionTag.module.css";

/** Horde or Alliance tag (roster-cards board; the StatusBadge shape of the design-system board). */
export function FactionTag({ faction }: { faction: Faction }) {
  return (
    <span className={styles.tag} data-faction={faction.toLowerCase()}>
      {faction}
    </span>
  );
}
