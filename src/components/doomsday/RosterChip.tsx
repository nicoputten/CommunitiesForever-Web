import Link from "next/link";
import type { DoomsdayChip } from "@/core/views/doomsday";
import { FlameIcon } from "@/components/ui/icons";
import styles from "./RosterChip.module.css";

/**
 * A friend's Doomsday on the roster card (WEB-61, board roster-cards-doomsday): this week's PvE and PvP points side by
 * side, never added together, and the streak; "No Doomsday data yet" without data (never 0 as if known). Links to the
 * ladder. Its name is its text, with the hidden words a screen reader needs ("Doomsday this week: … streak 6").
 */
export function RosterChip({ chip }: { chip: DoomsdayChip }) {
  if (chip.kind === "none") {
    return <span className={`${styles.chip} ${styles.none}`}>No Doomsday data yet</span>;
  }
  return (
    <Link href="/doomsday/ladder" className={styles.chip}>
      <span className="visually-hidden">Doomsday this week: </span>
      <span className={styles.pve}>PvE {chip.week.pve}</span>{" "}
      <span className={styles.pvp}>
        PvP {chip.week.approx ? "≈" : ""}
        {chip.week.pvp}
      </span>
      {chip.pvpVirgin && (
        <>
          {" "}
          <span className={styles.virgin}>PvP Virgin</span>
        </>
      )}
      {chip.streak !== undefined && (
        <>
          {" "}
          <span className={styles.streak}>
            <FlameIcon className={styles.flame} />
            <span className="visually-hidden">streak </span>
            {chip.streak}
          </span>
        </>
      )}
    </Link>
  );
}
