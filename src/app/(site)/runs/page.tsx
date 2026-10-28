import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { getViewer, isAdmin } from "@/app/viewer";
import { parseRunsFilter, RUNS_FILTERS, runsPage } from "@/core/views/runs";
import { RunCard } from "@/components/runs/RunCard";
import styles from "@/components/runs/Runs.module.css";
import { EmptyState } from "@/components/ui/EmptyState";
import chip from "@/components/ui/FilterChip.module.css";
import { PageTitle } from "@/components/ui/PageTitle";
import { getDb } from "@/server/db";
import { getBotSettings } from "@/server/discord";
import { runsInput } from "@/server/runsInput";

export const metadata: Metadata = { title: "Runs" };

/** Planned runs (WEB-40, board `runs`): This week, Later and Past, filtered by "Runs I can join", Mine or All. */
export default async function RunsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const viewer = await getViewer();
  if (viewer === undefined) notFound();
  const db = getDb();
  const filter = parseRunsFilter((await searchParams).show);
  const page = runsPage(runsInput(db, viewer.battleTag, nowSeconds()), filter);
  const settings = getBotSettings(db);
  // The "once the admin picks a channel" hint is for the admin only (finding 12).
  const admin = await isAdmin();

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <PageTitle sub={`Planned dungeon runs. Times in your time zone, ${page.timeZone.replace(/_/g, " ")}.`}>
              Runs
            </PageTitle>
          </div>
          <Link href="/runs/new" className={styles.primary}>
            Plan a run
          </Link>
        </div>

        <nav aria-label="Show" className={styles.filters}>
          {RUNS_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "join" ? "/runs" : `/runs?show=${f.value}`}
              className={chip.chip}
              aria-current={page.filter === f.value ? "page" : undefined}
            >
              {page.filter === f.value && f.value === "join" ? "✓ " : ""}
              {f.label}
            </Link>
          ))}
          <span className={styles.filterNote}>“Can join” = one of your characters fits the level range</span>
        </nav>

        {!page.anyUpcoming && page.past.length === 0 ? (
          <EmptyState title="No runs planned" action={{ href: "/runs/new", label: "Plan a run" }}>
            Pick a dungeon and a time and friends can sign up here or in Discord. Going right now? Use Ask now on the
            Dungeons tab in the game.
          </EmptyState>
        ) : (
          <>
            {page.thisWeek.length > 0 && <h2 className={styles.section}>This week</h2>}
            {page.thisWeek.map((r) => (
              <RunCard key={r.id} run={r} />
            ))}
            {page.later.length > 0 && <h2 className={styles.section}>Later</h2>}
            {page.later.map((r) => (
              <RunCard key={r.id} run={r} />
            ))}
            {page.thisWeek.length + page.later.length === 0 && <p className={styles.hidden}>No upcoming runs here.</p>}
            {page.hidden !== undefined && (
              <p className={styles.hidden}>
                {page.hidden} <Link href="/runs?show=all">Show all</Link>
              </p>
            )}
            {page.past.length > 0 && (
              <>
                <h2 className={styles.section}>Past</h2>
                <ul className={styles.past}>
                  {page.past.map((p) => (
                    <li key={p.id}>
                      <Link href={p.href}>
                        <span>{p.day}</span>
                        <span>
                          <b>{p.dungeon}</b> · {p.by}
                        </span>
                        <span className={styles.pastResult}>
                          <span className={styles.pill} data-tone={p.result.tone}>
                            {p.result.label}
                          </span>
                          {p.detail !== undefined && <span>{p.detail}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      <aside className={styles.aside}>
        <section className={styles.box} aria-labelledby="going-now">
          <h2 id="going-now" className={styles.boxTitle}>
            Going right now?
          </h2>
          <p className={styles.body}>
            Use <b>Ask now</b> on the Dungeons tab in the game. It whispers online friends who fit and ends in a party
            invite.
          </p>
        </section>
        <section className={styles.box} aria-labelledby="where-runs">
          <h2 id="where-runs" className={styles.boxTitle}>
            Where runs show up
          </h2>
          <div className={styles.where}>
            <span className={styles.dot} aria-hidden="true">
              ●
            </span>
            <span>
              <b>Discord</b> ·{" "}
              {!settings.runs
                ? "not posted: the admin turned run posts off"
                : settings.runsChannel === null
                  ? admin
                    ? "posted once you pick a channel for runs on the Discord page"
                    : "not posted yet"
                  : `posted in the runs channel${settings.reminders ? `, reminder ${settings.reminderMinutes} min before` : ""}`}
            </span>
          </div>
        </section>
        {page.yourAnswers.length > 0 && (
          <section className={styles.box} aria-labelledby="your-answers">
            <h2 id="your-answers" className={styles.boxTitle}>
              Your answers
            </h2>
            <ul className={styles.yourAnswers}>
              {page.yourAnswers.map((a) => (
                <li key={a.href}>
                  <Link href={a.href}>{a.dungeon}</Link> <span>· {a.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
