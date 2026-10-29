import type { DoomsdayPage } from "@/core/views/doomsday";
import { SUGGESTIONS } from "@/core/views/doomsday";
import { DoomsdayEmblem } from "@/components/ui/icons";
import styles from "./Doomsday.module.css";
import { Board, GoalCard, SoFar, Streak } from "./parts";

// The Doomsday page's Today tab (WEB-59, board doomsday-today; the phone and day one: WEB-61, board doomsday-phone).

/** Day one of Doomsday: nobody has a point yet. */
export function DayOne() {
  return (
    <section className={`${styles.card} ${styles.dayOne}`} aria-labelledby="dd-day-one">
      <DoomsdayEmblem className={styles.dayOneEmblem} />
      <div>
        <h2 id="dd-day-one" className={styles.dayOneTitle}>
          Day one of Doomsday
        </h2>
        <p className={styles.dayOneText}>
          Your first goals are below. Play as usual; checks appear after your next upload. Nobody has points yet, so the
          ladder starts Sunday.
        </p>
      </div>
    </section>
  );
}

export function TodayContent({ page }: { page: DoomsdayPage }) {
  const today = page.today;
  return (
    <>
      {page.firstDay && <DayOne />}
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
                {/* The phone has it under the tabs. */}
                <span className={`${styles.resets} ${styles.desktopOnly}`}>{today.resets}</span>
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
              {page.header.streak !== undefined && (
                <p className={styles.phoneOnly}>
                  <Streak streak={page.header.streak} days />
                </p>
              )}
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
    </>
  );
}
