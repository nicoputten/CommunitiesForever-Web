import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/doomsday/Doomsday.module.css";
import ladder from "@/components/doomsday/Ladder.module.css";
import { LadderCard } from "@/components/doomsday/ladder";
import { DoomsdayFrame } from "@/components/doomsday/parts";
import chip from "@/components/ui/FilterChip.module.css";
import { SegmentedNav } from "@/components/ui/SegmentedNav";
import { ladderView, parseLadderScope } from "@/core/views/doomsdayLadder";
import { doomsdayContext } from "../data";
import { NoDoomsday } from "../NoData";

export const metadata: Metadata = { title: "Doomsday · Ladder" };

/**
 * Doomsday, Ladder (WEB-60, board doomsday-ladder): this week or all time, PvE and PvP apart, each its own ranking.
 * On the phone one track at a time with a PvE | PvP switch (WEB-61, board doomsday-phone).
 */
export default async function DoomsdayLadderPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; track?: string }>;
}) {
  const ctx = await doomsdayContext();
  if (ctx === undefined) return <NoDoomsday />;
  const params = await searchParams;
  const view = ladderView(ctx.snapshot, parseLadderScope(params.scope), ctx.viewerKey, ctx.timeZone);
  const track = params.track === "pvp" ? "pvp" : "pve";
  const href = (scope: string | undefined, t: string) => {
    const q = [scope === undefined ? "" : `scope=${scope}`, t === "pvp" ? "track=pvp" : ""].filter((x) => x !== "");
    return `/doomsday/ladder${q.length === 0 ? "" : `?${q.join("&")}`}`;
  };
  const scope = view.scope === "allTime" ? "all" : undefined;
  return (
    <DoomsdayFrame header={ctx.page.header} tab="ladder">
      <div className={ladder.bar}>
        <div className={ladder.phoneSwitch}>
          <SegmentedNav
            label="Track"
            options={[
              { href: href(scope, "pve"), label: "PvE", current: track === "pve" },
              { href: href(scope, "pvp"), label: "PvP", current: track === "pvp" },
            ]}
          />
        </div>
        <nav aria-label="Ladder period" className={ladder.chips}>
          <Link
            href={href(undefined, track)}
            className={chip.chip}
            aria-current={view.scope === "week" ? "page" : undefined}
          >
            This week
          </Link>
          <Link
            href={href("all", track)}
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
          <LadderCard key={t.track} view={t} phoneHidden={t.track !== track} />
        ))}
      </div>
    </DoomsdayFrame>
  );
}
