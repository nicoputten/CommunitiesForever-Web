import type { Metadata } from "next";
import styles from "@/components/doomsday/Doomsday.module.css";
import { Board, DoomsdayFrame, GoalCard, SoFar } from "@/components/doomsday/parts";
import { SUGGESTIONS } from "@/core/views/doomsday";
import { doomsdayData } from "./data";
import { NoDoomsday } from "./NoData";

export const metadata: Metadata = { title: "Doomsday" };

/** Doomsday, Today (WEB-59, board doomsday-today): your goals, the Duel slot, Today so far and the board. */
export default async function DoomsdayTodayPage() {
  const page = await doomsdayData();
  if (page === undefined) return <NoDoomsday />;
  const today = page.today;
  return (
    <DoomsdayFrame header={page.header} tab="today">
      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="dd-goals">
          {today === undefined ? (
            <>
              <h2 id="dd-goals" className={styles.cardTitle}>
                Your goals
              </h2>
              <p className={styles.note}>
                No Doomsday data from you yet. Your goals show after an upload with a CommunitiesForever version that
                shares them.
              </p>
            </>
          ) : (
            <>
              <div className={styles.cardHead}>
                <h2 id="dd-goals" className={styles.cardTitle}>
                  {today.title}
                </h2>
                <span className={styles.meta}>{today.doneText}</span>
                <span className={styles.spacer} />
                <span className={styles.resets}>{today.resets}</span>
              </div>
              <div className={styles.goals}>
                {today.pve.map((g) => (
                  <GoalCard key={g.key} goal={g} />
                ))}
              </div>
              <div className={styles.goals}>
                {today.pvp.map((g) => (
                  <GoalCard key={g.key} goal={g} />
                ))}
                <div className={styles.goal} data-slot="duel">
                  <span className={`${styles.kind} ${styles.pvp}`}>PvP · Duel slot</span>
                  <span className={styles.goalTitle}>First duel with each friend</span>
                  <span className={styles.count}>{today.duels.count}</span>
                  <span className={styles.goalMeta}>{today.duels.text}</span>
                </div>
              </div>
            </>
          )}
          <p className={styles.note}>{SUGGESTIONS}</p>
        </section>
        <aside className={styles.card} aria-labelledby="dd-so-far">
          <h2 id="dd-so-far" className={styles.cardTitle}>
            Today so far
          </h2>
          <SoFar view={page.soFar} />
        </aside>
      </div>
      <section className={styles.card} aria-labelledby="dd-board">
        <div className={styles.cardHead}>
          <h2 id="dd-board" className={styles.cardTitle}>
            The board · everyone, today
          </h2>
          <span className={styles.meta}>checks appear as uploads and addon sync come in · ✓ with the time</span>
        </div>
        <Board view={page.board} />
      </section>
    </DoomsdayFrame>
  );
}
