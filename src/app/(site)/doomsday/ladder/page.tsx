import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/doomsday/Doomsday.module.css";
import ladder from "@/components/doomsday/Ladder.module.css";
import { LadderCard } from "@/components/doomsday/ladder";
import { DoomsdayFrame } from "@/components/doomsday/parts";
import chip from "@/components/ui/FilterChip.module.css";
import { ladderView, parseLadderScope } from "@/core/views/doomsdayLadder";
import { doomsdayContext } from "../data";
import { NoDoomsday } from "../NoData";

export const metadata: Metadata = { title: "Doomsday · Ladder" };

/** Doomsday, Ladder (WEB-60, board doomsday-ladder): this week or all time, PvE and PvP apart, each its own ranking. */
export default async function DoomsdayLadderPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const ctx = await doomsdayContext();
  if (ctx === undefined) return <NoDoomsday />;
  const view = ladderView(ctx.snapshot, parseLadderScope((await searchParams).scope), ctx.viewerKey, ctx.timeZone);
  const note = view.scope === "week" ? "movement since last week" : undefined;
  return (
    <DoomsdayFrame header={ctx.page.header} tab="ladder">
      <div className={ladder.bar}>
        <nav aria-label="Ladder period" className={ladder.chips}>
          <Link href="/doomsday/ladder" className={chip.chip} aria-current={view.scope === "week" ? "page" : undefined}>
            This week
          </Link>
          <Link
            href="/doomsday/ladder?scope=all"
            className={chip.chip}
            aria-current={view.scope === "allTime" ? "page" : undefined}
          >
            All time
          </Link>
        </nav>
        <span className={styles.spacer} />
        <span className={styles.resets}>{view.resets}</span>
      </div>
      <div className={ladder.two}>
        {view.tracks.map((t) => (
          <LadderCard key={t.track} view={t} {...(note === undefined ? {} : { note })} />
        ))}
      </div>
    </DoomsdayFrame>
  );
}
