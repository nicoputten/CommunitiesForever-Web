import type { Metadata } from "next";
import Link from "next/link";
import { nowSeconds } from "@/app/clock";
import { getViewer } from "@/app/viewer";
import { RefusedLine, WhoTag } from "@/components/admin/CoAdmins";
import { HuntTargets } from "@/components/missions/HuntTargets";
import { QuarryCard } from "@/components/missions/Overview";
import styles from "@/components/missions/MissionPool.module.css";
import targetStyles from "@/components/missions/HuntTargets.module.css";
import { refusedText } from "@/core/views/admin";
import { censusLine, HUNTERS, quarry, tabs, targetRows } from "@/core/views/hunt";
import { CENSUS_URL } from "@/core/views/pool6";
import { getDb } from "@/server/db";
import { missionPoolPage } from "@/server/hunt";
import { poolInput } from "../poolInput";
import { setTargetAction } from "../actions";

export const metadata: Metadata = { title: "Hunt targets" };

/**
 * The Hunt targets (WEB-109, board `mission-pool-v2-hunt`): today's quarry, then every valid race × class of each
 * faction's targets weighted by Everloot's census; a click switches a target off or back on. Only the factions the
 * group hunts with (WEB-112). The owner only, as the Mission pool.
 */
export default async function HuntTargetsPage() {
  const viewer = await getViewer();
  const crumbs = (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <Link href="/admin">Admin</Link> › <Link href="/admin/missions">Mission pool</Link>
    </nav>
  );
  if (viewer === undefined || !viewer.owner) {
    return (
      <div className={styles.page}>
        {crumbs}
        <h1 className={styles.title}>Mission pool</h1>
        <RefusedLine>{refusedText("owner-only", undefined)}</RefusedLine>
      </div>
    );
  }
  const input = poolInput(missionPoolPage(getDb(), viewer.battleTag, nowSeconds()));
  const { targets } = input.data;
  // Only the factions the group hunts with (WEB-112): one faction, no tabs, just its grid.
  const hunters = input.data.hunters ?? HUNTERS;
  const q = quarry(input.data.quarry, input.data.days, input.today, hunters);
  const census = targets.census === undefined ? undefined : censusLine(targets.census);
  return (
    <div className={styles.page}>
      {crumbs}
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Mission pool</h1>
        <WhoTag owner />
      </div>
      <QuarryCard q={q} targetsHref="#hunt-targets" />
      <section className={styles.box} aria-labelledby="hunt-targets">
        <div className={styles.head}>
          <h2 id="hunt-targets" className={styles.boxTitle}>
            Hunt targets
          </h2>
          <span className={styles.drawRule}>
            Draw: weighted by how many were seen · skip under 30 · never the same target twice in 7 days
          </span>
        </div>
        <HuntTargets
          tabs={tabs(targets, hunters)}
          grids={Object.fromEntries(hunters.map((f) => [f, targetRows(targets, f)]))}
          first={hunters[0]!}
          setTarget={setTargetAction}
        />
        {census !== undefined && (
          <p className={targetStyles.census}>
            {census} ·{" "}
            <a href={CENSUS_URL} target="_blank" rel="noreferrer">
              everloot.app/census
            </a>
          </p>
        )}
      </section>
    </div>
  );
}
