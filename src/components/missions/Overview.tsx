import Link from "next/link";
import { QuarryPortrait } from "@/components/ui/QuarryPortrait";
import { InfoTip } from "@/components/ui/InfoTip";
import { CrosshairIcon, LockIcon, ReticleIcon } from "@/components/ui/icons";
import type { Quarry } from "@/core/views/hunt";
import type { DayTile, MissionPoolView } from "@/core/views/missionPool";
import styles from "./MissionPool.module.css";

// The top of the Mission pool page (WEB-109, board `mission-pool-v2-overview`): the recipe bar, today's quarry and
// the day tiles with their 6 lines.

/** What a day and a week are made of, each slot with its pool and how often a mission comes back. */
export function RecipeBar({ view }: { view: MissionPoolView }) {
  return (
    <div className={styles.recipe}>
      <p className={styles.recipeLine}>
        <b>Every day</b> {view.recipe.day} <span className={styles.sep}>·</span> <b>Every week</b> {view.recipe.week}
      </p>
      <ul className={styles.tiles} aria-label="Missions">
        {view.tiles.map((t) => (
          <li key={t.label} className={styles.tile} data-warn={t.warn || undefined} data-hunt={t.hunt || undefined}>
            <span className={styles.tileKey}>{t.label}</span>
            <b className={styles.tileCount}>
              {t.count} {t.per !== "" && <span className={styles.tilePer}>{t.per}</span>}
            </b>
            <span className={styles.tileLine}>{t.line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CENSUS_TIP =
  "Everloot census: characters seen in the last 7 days, from players who share uploads. A sample, not the whole realm.";

/** The Hunt's stats: points, done today, seen this week. */
function QuarryStats({ q }: { q: Quarry }) {
  return (
    <div className={styles.quarryStats}>
      <span>
        <b className={styles.quarryPoints}>{q.points}</b> points
      </span>
      {q.done !== undefined && (
        <span>
          <b>{q.done}</b> done today
        </span>
      )}
      {q.seen !== undefined && (
        <span className={styles.quarrySeen}>
          <b>{q.seen}</b> seen this week <InfoTip>{CENSUS_TIP}</InfoTip>
        </span>
      )}
    </div>
  );
}

/** Today's quarry (a red wanted poster): the group's target, the other faction's, the next 7 days. */
export function QuarryCard({ q, targetsHref }: { q: Quarry; targetsHref: string }) {
  return (
    <section className={styles.quarry} aria-labelledby="quarry-kicker" data-testid="quarry">
      <ReticleIcon className={styles.reticle} />
      <div className={styles.quarryMain}>
        <h2 id="quarry-kicker" className={styles.kicker}>
          {q.kicker}
        </h2>
        <div className={styles.quarryHead}>
          {q.target !== undefined && (
            <>
              <QuarryPortrait quarry={q.target} size="lg" />
              <div>
                <p className={styles.quarryName}>{q.target.name}</p>
                <p className={styles.quarryHunter}>
                  {q.hunter}
                  <span className={styles.quarryHow}> · kill one, target or mouse over first</span>
                </p>
              </div>
            </>
          )}
          {q.other !== undefined && (
            <div className={styles.quarryOther}>
              <QuarryPortrait quarry={q.other.target} size="sm" />
              <p>
                {q.other.hunter}
                <br />
                <b>{q.other.target.name}</b>
              </p>
            </div>
          )}
        </div>
        <QuarryStats q={q} />
      </div>
      <div className={styles.quarryNext}>
        <p className={styles.nextTitle}>Next 7 days</p>
        <ul className={styles.minis} aria-label="Next 7 days">
          {q.next.map((d) => (
            <li key={d.n} className={styles.mini}>
              <QuarryPortrait quarry={d} size="sm" />
              <span>
                <b>{d.weekday}</b>
                <br />
                {d.raceName}
                <br />
                {d.className}
              </span>
            </li>
          ))}
        </ul>
        <Link href={targetsHref} className={styles.quarryLink}>
          Hunt targets ›
        </Link>
      </div>
    </section>
  );
}

/** A day's 6 lines: 3 PvE, the Hunt, 2 PvP. */
export function DayLines({ d }: { d: DayTile }) {
  return (
    <>
      <span className={styles.dayHead}>
        {d.label}
        {d.locked && <LockIcon className={styles.lock} aria-label="Locked" role="img" aria-hidden={undefined} />}
        {d.changed && <span className={styles.badge}>changed</span>}
      </span>
      {d.note !== undefined && <span className={styles.note}>{d.note}</span>}
      {d.pve.map((m, i) => (
        <span key={`e${i}`} className={styles.mission}>
          {m}
        </span>
      ))}
      {d.hunt !== undefined && (
        <span className={styles.huntLine}>
          <CrosshairIcon className={styles.crosshair} />
          {d.hunt}
        </span>
      )}
      {d.pvp.map((m, i) => (
        <span key={`p${i}`} className={styles.mission} data-pvp>
          {m}
        </span>
      ))}
    </>
  );
}
