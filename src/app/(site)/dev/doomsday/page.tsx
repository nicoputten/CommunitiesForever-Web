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
import { HuntFeats, HuntTrophies, HuntWeek } from "@/components/doomsday/hunt";
import huntStyles from "@/components/doomsday/Hunt.module.css";
import type { DoomsdaySnapshot } from "@/core/doomsday/snapshot";
import { huntFeats, huntTrophies, huntWeek } from "@/core/views/doomsdayHunt";
import { sameBattleTag } from "@/core/access";
import { peopleViews } from "@/core/views/characters";
import { doomsdayPage, type DoomsdayPage } from "@/core/views/doomsday";
import { ladderView } from "@/core/views/doomsdayLadder";
import { getDb } from "@/server/db";
import { effectiveTimeZone } from "@/server/discord";
import { doomsdayFor } from "@/server/doomsdayEngine";
import { doomsdayState } from "@/server/doomsdayStates";
import { loadState } from "@/server/uploads";

export const metadata: Metadata = { title: "Doomsday states" };

/**
 * The Hunt with a census and the addon's kill zones (WEB-110, boards DS01HuntToday, DS02HuntMore): `?state=hunt`
 * (open) or `hunt-bagged`, on `?tab=` today (default), board, pvp or feats.
 */
function HuntStates({
  snapshot,
  page,
  tab,
  viewerKey,
  timeZone,
}: {
  snapshot: DoomsdaySnapshot;
  page: DoomsdayPage;
  tab: string | undefined;
  viewerKey: string | undefined;
  timeZone: string;
}) {
  const me = snapshot.friends.find((f) => f.friendKey === viewerKey);
  if (tab === "board") {
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
  if ((tab === "pvp" || tab === "feats") && me !== undefined) {
    return (
      <DoomsdayFrame header={page.header} tab={tab}>
        {tab === "pvp" ? (
          <div className={huntStyles.pvp}>
            <HuntTrophies view={huntTrophies(snapshot, me, timeZone)} />
            <HuntWeek view={huntWeek(snapshot)} />
          </div>
        ) : (
          <HuntFeats feats={huntFeats(snapshot, me)} />
        )}
      </DoomsdayFrame>
    );
  }
  return (
    <DoomsdayFrame header={page.header} tab="today">
      <TodayContent page={page} />
    </DoomsdayFrame>
  );
}

/**
 * Doomsday's states for the design checks (WEB-61, board doomsday-phone), as /dev/asks is for Asking now: day one,
 * only one friend with data, loading and error, from the engine's own snapshot (WEB-63); the Hunt with a census
 * (WEB-110). Admin only.
 */
export default async function DoomsdayStatesPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; tab?: string }>;
}) {
  if (!(await isAdmin())) notFound();
  const { state, tab } = await searchParams;
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
  const hunt = state === "hunt" || state === "hunt-bagged";
  const snapshot = doomsdayState(
    real,
    state === "only-you" || state === "hunt" || state === "hunt-bagged" ? state : "first-day",
    viewerKey,
  );
  const page = doomsdayPage({ snapshot, timeZone, ...(viewerKey === undefined ? {} : { viewerKey }) });
  if (hunt) return <HuntStates snapshot={snapshot} page={page} tab={tab} viewerKey={viewerKey} timeZone={timeZone} />;
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
