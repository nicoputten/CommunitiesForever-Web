import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type {
  BoardView,
  DoomsdayHeader,
  DoomsdayTab,
  GoalCardView,
  HeatmapView,
  PointsView,
  SoFarView,
  StreakView,
} from "@/core/views/doomsday";
import { DOOMSDAY_TABS } from "@/core/views/doomsday";
import { PageTitle } from "@/components/ui/PageTitle";
import { CrownIcon, DoomsdayEmblem, FlameIcon, SwapIcon } from "@/components/ui/icons";
import styles from "./Doomsday.module.css";

// The Doomsday page's pieces (WEB-59, board doomsday-today). Server components: nothing to click but the tabs.

/** "PvE 10 · PvP 9": the two tracks side by side, never added together; "≈" before a guessed PvP number. */
export function Points({ points }: { points: PointsView }) {
  return (
    <span className={styles.points}>
      <span className={styles.pve}>PvE {points.pve}</span> <span className={styles.sep}>·</span>{" "}
      <span className={styles.pvp}>
        PvP {points.approx ? "≈" : ""}
        {points.pvp}
      </span>
    </span>
  );
}

/** "🔥 6 days best 11" (header) or "🔥 6 best 11" (board). */
export function Streak({ streak, days = false }: { streak: StreakView; days?: boolean }) {
  return (
    <span className={styles.streak}>
      <FlameIcon className={styles.flame} /> {streak.current}
      {days ? (streak.current === 1 ? " day" : " days") : ""} <span className={styles.meta}>best {streak.best}</span>
    </span>
  );
}

export function DoomsdayFrame({
  header,
  tab,
  children,
}: {
  header: DoomsdayHeader;
  tab: DoomsdayTab;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <DoomsdayEmblem className={styles.emblem} />
        <div className={styles.headText}>
          <PageTitle sub={header.sub}>Doomsday</PageTitle>
        </div>
        {header.today !== undefined && (
          <div className={styles.stats}>
            <Stat label="Today">
              <Points points={header.today} />
            </Stat>
            {header.week !== undefined && (
              <Stat label="This week">
                <Points points={header.week} />
              </Stat>
            )}
            {header.streak !== undefined && (
              <Stat label="Streak">
                <Streak streak={header.streak} days />
              </Stat>
            )}
          </div>
        )}
      </div>
      <nav aria-label="Doomsday" className={styles.tabs}>
        {DOOMSDAY_TABS.map((t) => (
          <Link key={t.tab} href={t.href} className={styles.tab} aria-current={t.tab === tab ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{children}</span>
    </div>
  );
}

export function GoalCard({ goal }: { goal: GoalCardView }) {
  return (
    <div className={styles.goal} data-done={goal.done} data-testid="goal">
      <span className={`${styles.kind} ${goal.track === "pve" ? styles.pve : styles.pvp}`}>{goal.kind}</span>
      <span className={styles.goalTitle}>
        {goal.title}
        {goal.swap !== undefined && (
          <span title={goal.swap}>
            <SwapIcon className={styles.swap} />
            <span className="visually-hidden">{goal.swap}</span>
          </span>
        )}
      </span>
      {goal.done ? (
        <span className={styles.check} aria-label="done">
          ✓
        </span>
      ) : (
        goal.progress !== undefined && <span className={styles.count}>{goal.progress.text}</span>
      )}
      {!goal.done && goal.progress !== undefined && (
        <span className={styles.bar} data-track={goal.track} aria-hidden="true">
          <span style={{ width: `${goal.progress.percent}%` } as CSSProperties} />
        </span>
      )}
      <span className={styles.goalMeta}>{goal.done ? goal.doneText : goal.worth}</span>
    </div>
  );
}

export function SoFar({ view }: { view: SoFarView }) {
  return (
    <div className={styles.soFar}>
      {view.crown !== undefined && (
        <div className={styles.soFarLine}>
          <CrownIcon className={styles.crown} />
          <span>
            <b>{view.crown.name}</b> finished all dailies first, {view.crown.time}
          </span>
        </div>
      )}
      {view.finished.map((f) => (
        <div key={f.name} className={styles.soFarLine}>
          <span className={styles.mini} aria-hidden="true">
            {f.initials}
          </span>
          <span>
            {f.name} finished all dailies, {f.time}
          </span>
        </div>
      ))}
      {view.partial.map((f) => (
        <div key={f.name} className={styles.soFarLine}>
          <span className={styles.mini} aria-hidden="true">
            {f.initials}
          </span>
          <span>
            {f.name}: {f.text}
          </span>
        </div>
      ))}
      {view.empty && <p className={styles.note}>Nobody has done anything yet.</p>}
      {view.rest !== undefined && <p className={styles.note}>{view.rest}</p>}
    </div>
  );
}

export function Board({ view }: { view: BoardView }) {
  const span = view.columns.length + 4;
  return (
    <>
      {view.lonely !== undefined && <p className={styles.note}>{view.lonely}</p>}
      {/* Scrolls sideways on narrow screens, so it takes focus for the keyboard. */}
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="The board">
        <table className={styles.board}>
          <thead>
            <tr>
              <th scope="col" className={styles.friendCol}>
                Friend
              </th>
              {view.columns.map((c) => (
                <th key={c.id} scope="col" className={styles.goalCol}>
                  <span className={c.track === "pve" ? styles.pve : styles.pvp}>
                    {c.track === "pve" ? "PvE" : "PvP"}
                  </span>
                  <span className={styles.colTitle}>{c.title}</span>
                </th>
              ))}
              <th scope="col">
                Duels<span className={styles.colTitle}>first with each friend</span>
              </th>
              <th scope="col">Today</th>
              <th scope="col">This week</th>
              <th scope="col">Streak</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.key} data-you={r.you} data-dim={r.dim}>
                <th scope="row">
                  <span className={styles.friend}>
                    <span className={styles.avatar} aria-hidden="true">
                      {r.initials}
                    </span>
                    <span className={styles.friendName} data-crossed={r.crossedOut}>
                      {r.name}
                    </span>
                    {r.crossedOut && <span className="visually-hidden">(all PvE dailies done)</span>}
                    {r.you && <span className={styles.meta}>(you)</span>}
                    {r.crown !== undefined && (
                      <span className={`${styles.pill} ${styles.pillFirst}`}>
                        <CrownIcon className={styles.pillIcon} /> first · {r.crown}
                      </span>
                    )}
                  </span>
                </th>
                {r.cells === undefined ? (
                  <td colSpan={span} className={styles.meta}>
                    {r.note}
                  </td>
                ) : (
                  <>
                    <Cells row={r} pvpColumns={view.columns.map((c) => c.track === "pvp")} />
                    <td className={styles.meta}>{r.duels}</td>
                    <td>{r.today !== undefined && <Points points={r.today} />}</td>
                    <td>{r.week !== undefined && <Points points={r.week} />}</td>
                    <td>{r.streak !== undefined && <Streak streak={r.streak} />}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.legend}>
        <span>
          <CrownIcon className={styles.crown} /> first to finish all dailies
        </span>
        <span>
          <SwapIcon className={styles.swap} /> swapped for that friend
        </span>
        <span>— not done</span>
        <span>
          <FlameIcon className={styles.flame} /> streak
        </span>
      </div>
    </>
  );
}

/** A row's goal cells; a PvP Virgin with nothing done in PvP gets one "PvP Virgin" pill over the PvP columns. */
function Cells({ row, pvpColumns }: { row: BoardView["rows"][number]; pvpColumns: boolean[] }) {
  const cells = row.cells ?? [];
  const pvpIdle = cells.every((c, i) => !pvpColumns[i] || c.kind === "open");
  const virgin = row.pvpVirgin && pvpIdle;
  const out: ReactNode[] = [];
  let virginShown = false;
  cells.forEach((c, i) => {
    if (virgin && pvpColumns[i]) {
      if (!virginShown) {
        out.push(
          <td key={i} colSpan={pvpColumns.filter(Boolean).length}>
            <span className={`${styles.pill} ${styles.pillVirgin}`}>PvP Virgin</span>
          </td>,
        );
        virginShown = true;
      }
      return;
    }
    out.push(
      <td key={i} title={c.swap}>
        {c.kind === "done" ? (
          <span className={styles.cell}>
            <span className={styles.cellDone}>
              <span aria-label="done">✓</span>
              {c.swap !== undefined && <SwapIcon className={styles.swap} />}
            </span>
            <span className={styles.cellTime}>{c.time}</span>
          </span>
        ) : c.kind === "progress" ? (
          <span className={styles.count}>{c.text}</span>
        ) : (
          <span className={styles.cellOpen} aria-label="not done">
            —
          </span>
        )}
        {c.swap !== undefined && <span className="visually-hidden">{c.swap}</span>}
      </td>,
    );
  });
  return <>{out}</>;
}

export function Heatmap({ view }: { view: HeatmapView }) {
  return (
    <>
      {view.rows.map((r) => (
        <div key={r.key} className={styles.heatRow}>
          <span className={styles.heatName}>{r.name}</span>
          <div className={styles.heat} role="img" aria-label={`${r.name}: goals per day over 12 weeks`}>
            {r.days.map((d, i) => (
              <span key={i} data-level={d.level} title={d.label} />
            ))}
          </div>
          <span className={styles.meta}>best {r.best}</span>
        </div>
      ))}
      {view.without !== undefined && <p className={styles.note}>{view.without}</p>}
    </>
  );
}
