import type { Metadata } from "next";
import styles from "@/components/doomsday/Doomsday.module.css";
import { DoomsdayFrame, GoalCard, Points } from "@/components/doomsday/parts";
import { InfoTip } from "@/components/ui/InfoTip";
import { SUGGESTIONS } from "@/core/views/doomsday";
import { doomsdayData } from "../data";
import { NoDoomsday } from "../NoData";

export const metadata: Metadata = { title: "Doomsday · Week" };

/** Doomsday, Week (WEB-59, board doomsday-phone "Week tab"): the 3 weeklies and the Weekly bounty. */
export default async function DoomsdayWeekPage() {
  const page = await doomsdayData();
  if (page === undefined) return <NoDoomsday />;
  const week = page.week;
  return (
    <DoomsdayFrame header={page.header} tab="week">
      <section className={styles.card} aria-labelledby="dd-week">
        <div className={styles.cardHead}>
          <h2 id="dd-week" className={styles.cardTitle}>
            Your weeklies
          </h2>
          <InfoTip>{SUGGESTIONS}</InfoTip>
          {week?.points !== undefined && <Points points={week.points} />}
          <span className={styles.spacer} />
          {week !== undefined && <span className={styles.resets}>{week.resets}</span>}
        </div>
        {week === undefined ? (
          <p className={styles.note}>
            No Doomsday data from you yet. Your weeklies show after an upload with a CommunitiesForever version that
            shares them.
          </p>
        ) : (
          <div className={`${styles.goals} ${styles.goals4}`}>
            {week.goals.map((g) => (
              <GoalCard key={g.key} goal={g} />
            ))}
          </div>
        )}
      </section>
    </DoomsdayFrame>
  );
}
