import type { Metadata } from "next";
import styles from "@/components/doomsday/Doomsday.module.css";
import ladder from "@/components/doomsday/Ladder.module.css";
import { FriendChips, GroupFeats, OwnFeats, RankTitles } from "@/components/doomsday/ladder";
import { DoomsdayFrame } from "@/components/doomsday/parts";
import { featsView } from "@/core/views/doomsdayFeats";
import { doomsdayContext } from "../data";
import { NoDoomsday } from "../NoData";

export const metadata: Metadata = { title: "Doomsday · Feats" };

/** Doomsday, Feats (WEB-60, board doomsday-feats): the group's feats, a friend's own feats, the PvP rank titles. */
export default async function DoomsdayFeatsPage({ searchParams }: { searchParams: Promise<{ friend?: string }> }) {
  const ctx = await doomsdayContext();
  if (ctx === undefined) return <NoDoomsday />;
  const view = featsView(ctx.snapshot, (await searchParams).friend, ctx.viewerKey, ctx.timeZone);
  return (
    <DoomsdayFrame header={ctx.page.header} tab="feats">
      <div className={ladder.feats}>
        <section className={styles.card} aria-labelledby="dd-group-feats">
          <div className={styles.cardHead}>
            <h2 id="dd-group-feats" className={styles.cardTitle}>
              The group&apos;s feats · newest first
            </h2>
            <span className={styles.spacer} />
            <span className={styles.meta}>posted once in Discord as “Feat unlocked”</span>
          </div>
          <GroupFeats feats={view.group} />
        </section>
        <section className={styles.card} aria-labelledby="dd-own-feats">
          <div className={styles.cardHead}>
            <h2 id="dd-own-feats" className={styles.cardTitle}>
              {view.ownTitle}
            </h2>
            <span className={styles.meta}>{view.ownCount}</span>
          </div>
          <FriendChips label="Feats of" friends={view.friends} />
          <OwnFeats view={view} />
        </section>
      </div>
      <section className={styles.card} aria-labelledby="dd-ranks">
        <div className={styles.cardHead}>
          <h2 id="dd-ranks" className={styles.cardTitle}>
            PvP ranks &amp; our titles
          </h2>
          <span className={styles.spacer} />
          <span className={styles.meta}>
            a new highest rank is a feat; before the first kill: Conscientious Objector (never posted)
          </span>
        </div>
        <RankTitles ranks={view.ranks} />
      </section>
    </DoomsdayFrame>
  );
}
