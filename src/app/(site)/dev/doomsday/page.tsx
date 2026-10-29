import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { getViewer, isAdmin } from "@/app/viewer";
import { LadderCard } from "@/components/doomsday/ladder";
import ladder from "@/components/doomsday/Ladder.module.css";
import styles from "@/components/doomsday/Doomsday.module.css";
import { Board, DoomsdayFrame } from "@/components/doomsday/parts";
import { DoomsdayError, DoomsdayLoading } from "@/components/doomsday/states";
import { TodayContent } from "@/components/doomsday/today";
import { sameBattleTag } from "@/core/access";
import { peopleViews } from "@/core/views/characters";
import { doomsdayPage } from "@/core/views/doomsday";
import { ladderView } from "@/core/views/doomsdayLadder";
import { getDb } from "@/server/db";
import { effectiveTimeZone } from "@/server/discord";
import { doomsdayFor } from "@/server/doomsdayEngine";
import { doomsdayState } from "@/server/doomsdayStates";
import { loadState } from "@/server/uploads";

export const metadata: Metadata = { title: "Doomsday states" };

/**
 * Doomsday's states for the design checks (WEB-61, board doomsday-phone), as /dev/asks is for Asking now: day one,
 * only one friend with data, loading and error, from the engine's own snapshot (WEB-63). Admin only.
 */
export default async function DoomsdayStatesPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (!(await isAdmin())) notFound();
  const state = (await searchParams).state;
  if (state === "loading") return <DoomsdayLoading />;
  if (state === "error") return <DoomsdayError />;
  const viewer = await getViewer();
  const db = getDb();
  const now = nowSeconds();
  const data = loadState(db)?.data;
  if (viewer === undefined || data === undefined) notFound();
  const people = peopleViews(data, now);
  const viewerKey = people.find((p) => sameBattleTag(p.battleTag, viewer.battleTag))?.key;
  const timeZone = effectiveTimeZone(db, viewer.battleTag);
  const real = doomsdayFor(db, now);
  if (real === undefined) notFound();
  const snapshot = doomsdayState(real, state === "only-you" ? "only-you" : "first-day", viewerKey);
  const page = doomsdayPage({ snapshot, timeZone, ...(viewerKey === undefined ? {} : { viewerKey }) });
  if (state === "only-you") {
    return (
      <DoomsdayFrame header={page.header} tab="board">
        <section className={styles.card} aria-labelledby="dd-board">
          <h2 id="dd-board" className={styles.cardTitle}>
            The board · everyone, today
          </h2>
          <Board view={page.board} />
        </section>
      </DoomsdayFrame>
    );
  }
  const ladders = ladderView(snapshot, "week", viewerKey, timeZone);
  return (
    <DoomsdayFrame header={page.header} tab="today">
      <TodayContent page={page} />
      <div className={ladder.two}>
        {ladders.tracks.map((t) => (
          <LadderCard key={t.track} view={t} />
        ))}
      </div>
    </DoomsdayFrame>
  );
}
