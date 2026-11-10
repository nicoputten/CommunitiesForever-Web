import type { Metadata } from "next";
import Link from "next/link";
import { nowSeconds } from "@/app/clock";
import { getViewer } from "@/app/viewer";
import { RefusedLine, WhoTag } from "@/components/admin/CoAdmins";
import { DayEditor } from "@/components/missions/DayEditor";
import { DayLines, QuarryCard, RecipeBar } from "@/components/missions/Overview";
import { PoolControls } from "@/components/missions/PoolControls";
import styles from "@/components/missions/MissionPool.module.css";
import { InfoTip } from "@/components/ui/InfoTip";
import { LockIcon } from "@/components/ui/icons";
import { battleTagKey } from "@/core/access";
import type { Period } from "@/core/doomsday/missionPool";
import { refusedText } from "@/core/views/admin";
import { missionPoolView } from "@/core/views/missionPool";
import { poolInput } from "./poolInput";
import { getDb } from "@/server/db";
import { effectiveTimeZone } from "@/server/discord";
import { missionPoolPage } from "@/server/hunt";
import { displayNames } from "@/server/uploads";
import { backToNormalAction, pinAction, rerollAction, rerollDayAction, setOffAction, setOftenAction } from "./actions";

export const metadata: Metadata = { title: "Mission pool" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function selected(params: Record<string, string | string[] | undefined>): { period: Period; n: number } | undefined {
  for (const period of ["day", "week"] as const) {
    const n = Number(one(params[period]));
    if (one(params[period]) !== undefined && Number.isInteger(n)) return { period, n };
  }
  return undefined;
}

/**
 * The owner's Mission pool (WEB-79, boards `mission-pool`, `mission-pool-steering`, `mission-pool-states`; v2 WEB-109,
 * board `mission-pool-v2-overview`): the recipe bar, today's quarry, the next 14 days and 2 weeks, the open day's editor
 * and the pool as themes with its stats and settings. The owner only: the
 * admin layout lets admins through, so an admin gets the refusal line here; the actions check again.
 */
export default async function MissionPoolPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const viewer = await getViewer();
  const crumbs = (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <Link href="/admin">Admin</Link> › Mission pool
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
  const db = getDb();
  const names = displayNames(db);
  const select = selected(params);
  const view = missionPoolView(
    poolInput(missionPoolPage(db, viewer.battleTag, nowSeconds())),
    effectiveTimeZone(db, viewer.battleTag),
    (owner) => names.get(battleTagKey(owner)) ?? owner.split("#")[0]!,
    select,
  );
  const refused = refusedText(one(params.refused), undefined);
  const open = view.editor;

  return (
    <div className={styles.page}>
      {crumbs}
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Mission pool</h1>
        <WhoTag owner />
      </div>
      {refused !== undefined && <RefusedLine>{refused}</RefusedLine>}
      <RecipeBar view={view} />
      <QuarryCard q={view.quarry} targetsHref="/admin/missions/hunt" />
      <div className={styles.top} data-editor={open !== undefined || undefined}>
        <section className={styles.box} aria-labelledby="mission-days">
          <div className={styles.head}>
            <span className={styles.boxTitle}>
              <h2 id="mission-days" className={styles.boxTitleText}>
                Next 14 days
              </h2>
              <InfoTip>
                The missions everyone gets. Today and tomorrow are locked so changes reach every friend in time.
              </InfoTip>
            </span>
            {view.changedText !== undefined && <span className={styles.aside}>{view.changedText}</span>}
          </div>
          <ul className={styles.days}>
            {view.days.map((d) => (
              <li key={d.n}>
                <Link
                  href={`?day=${d.n}#editor`}
                  scroll={false}
                  className={styles.day}
                  data-locked={d.locked || undefined}
                  data-changed={d.changed || undefined}
                  aria-current={open?.period === "day" && open.n === d.n ? "true" : undefined}
                  data-testid="mission-day"
                >
                  <DayLines d={d} />
                </Link>
              </li>
            ))}
          </ul>
          <h3 className={styles.subTitle}>Next 2 weeks</h3>
          <ul className={styles.weeks}>
            {view.weeks.map((w) => (
              <li key={w.n}>
                <Link
                  href={`?week=${w.n}#editor`}
                  scroll={false}
                  className={styles.day}
                  data-locked={w.locked || undefined}
                  data-changed={w.changed || undefined}
                  aria-current={open?.period === "week" && open.n === w.n ? "true" : undefined}
                  data-testid="mission-week"
                >
                  <span className={styles.dayHead}>
                    {w.title}
                    {w.locked && (
                      <LockIcon className={styles.lock} aria-label="Locked" role="img" aria-hidden={undefined} />
                    )}
                    {w.changed && <span className={styles.badge}>changed</span>}
                  </span>
                  <span className={styles.mission}>{w.pve}</span>
                  {w.bounty !== undefined && (
                    <span className={styles.mission} data-pvp>
                      {w.bounty}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {open !== undefined && (
          <DayEditor
            editor={open}
            pin={pinAction}
            reroll={rerollAction}
            rerollDay={rerollDayAction}
            backToNormal={backToNormalAction}
          />
        )}
      </div>
      <section className={styles.box} aria-labelledby="mission-pool">
        <div className={styles.head}>
          <span className={styles.boxTitle}>
            <h2 id="mission-pool" className={styles.boxTitleText}>
              The pool
            </h2>
            <InfoTip>
              Every mission that can come up. Came up and Done count since launch; days nobody played are not counted.
            </InfoTip>
          </span>
          <span className={styles.aside}>{view.since}</span>
        </div>
        <PoolControls
          cards={view.cards}
          filters={view.filters}
          offFrom={view.offFrom}
          setOff={setOffAction}
          setOften={setOftenAction}
        />
      </section>
    </div>
  );
}
