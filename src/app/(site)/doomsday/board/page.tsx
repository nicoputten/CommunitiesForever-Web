import type { Metadata } from "next";
import styles from "@/components/doomsday/Doomsday.module.css";
import { Board, DoomsdayFrame, Heatmap } from "@/components/doomsday/parts";
import { doomsdayData } from "../data";
import { NoDoomsday } from "../NoData";

export const metadata: Metadata = { title: "Doomsday · Board" };

/** Doomsday, Board (WEB-59): every friend × today's goals, and the 12-week heatmap (board doomsday-feats). */
export default async function DoomsdayBoardPage() {
  const page = await doomsdayData();
  if (page === undefined) return <NoDoomsday />;
  return (
    <DoomsdayFrame header={page.header} tab="board">
      <section className={styles.card} aria-labelledby="dd-board">
        <div className={styles.cardHead}>
          <h2 id="dd-board" className={styles.cardTitle}>
            The board · everyone, today
          </h2>
          <span className={styles.meta}>checks appear as uploads and addon sync come in · ✓ with the time</span>
        </div>
        <Board view={page.board} />
      </section>
      <section className={styles.card} aria-labelledby="dd-heat">
        <div className={styles.cardHead}>
          <h2 id="dd-heat" className={styles.cardTitle}>
            12 weeks of goals · per friend
          </h2>
          <span className={styles.meta}>one square per day · darker = more goals done (either track)</span>
        </div>
        <Heatmap view={page.heatmap} />
      </section>
    </DoomsdayFrame>
  );
}
