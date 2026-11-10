import Link from "next/link";
import type { CSSProperties } from "react";
import type { GoalCardView } from "@/core/views/doomsday";
import type { HuntFeatView, HuntTodayView, HuntWeekView, SeenView, TrophiesView } from "@/core/views/doomsdayHunt";
import { classInfo } from "@/core/gamedata/classes";
import { ClassIcon } from "@/components/ui/ClassIcon";
import { InfoTip } from "@/components/ui/InfoTip";
import { QuarryPortrait } from "@/components/ui/QuarryPortrait";
import { CrosshairIcon, CrosshairMark } from "@/components/ui/icons";
import base from "./Doomsday.module.css";
import styles from "./Hunt.module.css";

// The Hunt on the Doomsday pages (WEB-110, boards DS01HuntToday and DS02HuntMore).

/** "Kill one · …": the Hunt card's hover (DS01). */
const HOW = "Kill one · target or mouse over them first so the kill counts";

/** A friend's name in their class's text colour, as the boards show it. */
function nameStyle(classFile: string | undefined): CSSProperties | undefined {
  const info = classInfo(classFile);
  return info === undefined ? undefined : { color: `var(${info.textToken})` };
}

/** "Everloot census": the link to Everloot's census, in the ⓘ next to a census number. */
function CensusLink({ seen }: { seen: SeenView }) {
  return (
    <a className={styles.census} href={seen.href} target="_blank" rel="noreferrer">
      Everloot census
    </a>
  );
}

/** The Hunt card in Your goals: the red wanted card, done with a gold border and the "Bagged" stamp (DS01). */
export function HuntCard({ goal }: { goal: GoalCardView & { hunt: NonNullable<GoalCardView["hunt"]> } }) {
  const h = goal.hunt;
  return (
    <div
      className={`${base.goal} ${styles.card}`}
      data-done={goal.done}
      data-slot="hunt"
      data-testid="goal"
      title={goal.done ? undefined : HOW}
    >
      <CrosshairMark className={styles.watermark} />
      <span className={`${base.kind} ${base.pvp} ${styles.kind}`}>
        <CrosshairIcon className={styles.kindIcon} /> PvP · The Hunt
      </span>
      <span className={styles.quarry}>
        <QuarryPortrait quarry={h.quarry} />
        <span className={styles.quarryName}>{h.quarry.name}</span>
      </span>
      {h.bagged !== undefined ? (
        <>
          <span className={styles.meta}>
            {h.worth} · {h.bagged}
          </span>
          <span className={styles.stamp}>Bagged</span>
        </>
      ) : (
        <span className={styles.meta}>
          {h.worth}
          {h.seen !== undefined && (
            <>
              {" · "}
              <span className={styles.seen}>{h.seen.count}</span> seen this week{" "}
              <InfoTip>
                <CensusLink seen={h.seen} />: {h.seenTip}
              </InfoTip>
            </>
          )}
          <span className="visually-hidden">. {HOW}</span>
        </span>
      )}
    </div>
  );
}

/** "The Hunt today": who bagged one, and tomorrow's quarry (DS01). */
export function HuntToday({ view }: { view: HuntTodayView }) {
  return (
    <section className={`${base.card} ${styles.box}`} aria-labelledby="dd-hunt-today">
      <h2 id="dd-hunt-today" className={`${base.cardTitle} ${styles.title}`}>
        <CrosshairIcon className={styles.titleIcon} /> The Hunt today
      </h2>
      <p className={styles.sub}>{view.count}</p>
      <ul className={styles.rows}>
        {view.friends.map((f) => (
          <li key={f.key} className={styles.row} data-testid="hunt-friend">
            <ClassIcon classFile={f.classFile} />
            <span style={nameStyle(f.classFile)}>{f.name}</span>
            {f.bagged ? (
              <span className={styles.hit}>
                <CrosshairIcon className={styles.hitIcon} /> {f.text}
              </span>
            ) : (
              <span className={styles.none}>
                <span aria-hidden="true">{f.text}</span>
                <span className="visually-hidden">not yet</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {view.more !== undefined && (
        <Link href={view.more.href} className={styles.more}>
          {view.more.text}
        </Link>
      )}
      {view.tomorrow !== undefined && (
        <div className={styles.tomorrow}>
          <QuarryPortrait quarry={view.tomorrow} size="sm" />
          <span>
            Tomorrow’s quarry
            <br />
            <b>{view.tomorrow.name}</b>
          </span>
        </div>
      )}
    </section>
  );
}

/** The PvP tab's trophy collection of one friend (DS02). */
export function HuntTrophies({ view }: { view: TrophiesView }) {
  return (
    <section className={base.card} aria-labelledby="dd-hunt-trophies">
      <div className={styles.head}>
        <h2 id="dd-hunt-trophies" className={`${base.cardTitle} ${styles.title}`}>
          <CrosshairIcon className={styles.titleIcon} /> {view.title}
        </h2>
        <span className={styles.summary}>{view.summary}</span>
      </div>
      <span className={styles.bar} aria-hidden="true">
        <span style={{ width: `${view.percent}%` }} />
      </span>
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Hunt trophies">
        <table className={styles.trophies}>
          <thead>
            <tr>
              <td />
              {view.classes.map((c) => (
                <th key={c.id} scope="col">
                  <ClassIcon classFile={c.classFile} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.race}>
                <th scope="row">{r.name}</th>
                {r.cells.map((c, i) =>
                  c.kind === "na" ? (
                    <td key={i}>
                      <span className={styles.trophy} data-kind="na" aria-hidden="true">
                        ·
                      </span>
                    </td>
                  ) : (
                    <td key={c.key}>
                      <span
                        className={styles.trophy}
                        data-got={c.count > 0}
                        data-rare={c.rare || undefined}
                        title={c.label}
                        role="img"
                        aria-label={c.label}
                      >
                        {c.count > 0 ? `×${c.count}` : ""}
                      </span>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.rarest !== undefined && (
        <p className={styles.rarest}>
          Rarest: <span className={styles.rare}>{view.rarest.name}</span> ({view.rarest.seen.count} seen this week) ·
          blue ring = rare on the realm{" "}
          <InfoTip>
            <CensusLink seen={view.rarest.seen} /> · active {view.rarest.seen.window}
          </InfoTip>
        </p>
      )}
    </section>
  );
}

/** "Hunt · this week": friends ranked by days with the quarry bagged (DS02). */
export function HuntWeek({ view }: { view: HuntWeekView }) {
  return (
    <section className={base.card} aria-labelledby="dd-hunt-week">
      <h2 id="dd-hunt-week" className={`${base.cardTitle} ${styles.title}`}>
        <CrosshairIcon className={styles.titleIcon} /> Hunt · this week
      </h2>
      <p className={styles.sub}>Days with the quarry bagged</p>
      <ol className={styles.rows}>
        {view.rows.map((r) => (
          <li key={r.key} className={styles.row}>
            <span className={styles.place}>{r.place}</span>
            <ClassIcon classFile={r.classFile} />
            <span style={nameStyle(r.classFile)}>{r.name}</span>
            <span className={styles.days}>{r.days}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The six Hunt feats with their progress (DS02). */
export function HuntFeats({ feats }: { feats: readonly HuntFeatView[] }) {
  return (
    <section className={base.card} aria-labelledby="dd-hunt-feats">
      <h2 id="dd-hunt-feats" className={base.cardTitle}>
        Hunt feats
      </h2>
      <ul className={styles.feats}>
        {feats.map((f) => (
          <li key={f.id} className={styles.feat} data-done={f.done} data-testid="hunt-feat">
            <span className={styles.featIcon} aria-hidden="true">
              <CrosshairIcon />
            </span>
            <span className={styles.featText}>
              <b>{f.title}</b>
              <span>{f.text}</span>
              {f.progress !== undefined && (
                <>
                  <span className={styles.bar} aria-hidden="true">
                    <span style={{ width: `${f.progress.percent}%` }} />
                  </span>
                  <span>{f.progress.text}</span>
                </>
              )}
              {f.done && <span className="visually-hidden">done</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
