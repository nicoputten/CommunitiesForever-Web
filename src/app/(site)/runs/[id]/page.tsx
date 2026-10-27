import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { nowSeconds } from "@/app/clock";
import { getViewer } from "@/app/viewer";
import { ROLE_LABEL, runDetail } from "@/core/views/runs";
import { AnswerButtons } from "@/components/runs/AnswerButtons";
import { DeleteRun } from "@/components/runs/DeleteRun";
import styles from "@/components/runs/Runs.module.css";
import { getDb } from "@/server/db";
import { getBotSettings } from "@/server/discord";
import { runsInput } from "@/server/runsInput";
import { deleteAction } from "../actions";

export const metadata: Metadata = { title: "Run" };

const color = (token: string | undefined) =>
  token === undefined ? undefined : ({ color: `var(${token})` } as CSSProperties);

/** A run's page (WEB-40, board `run-detail`): your answer, the group's five slots, the answers, who could join. */
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const id = Number((await params).id);
  if (viewer === undefined || !Number.isInteger(id)) notFound();
  const db = getDb();
  const run = runDetail(runsInput(db, viewer.battleTag, nowSeconds()), id);
  if (run === undefined) notFound();
  const settings = getBotSettings(db);
  const c = run.card;

  return (
    <div className={styles.main}>
      <p className={styles.crumbs}>
        <Link href="/runs">Runs</Link> › {c.dungeon}
      </p>
      <div className={styles.titleBlock}>
        <div className={styles.titleRow}>
          <span className={styles.pill} data-tone={c.pill.tone}>
            {c.pill.label}
          </span>
          <span className={styles.small}>{run.cancelled ?? run.plannedBy}</span>
        </div>
        <h1 className={styles.runTitle}>{c.dungeon}</h1>
        <p className={styles.meta}>{run.time}</p>
        <p className={styles.meta}>{run.levels}</p>
        {run.note !== undefined && <p className={styles.quote}>“{run.note}”</p>}
      </div>

      <div className={styles.page}>
        <div className={styles.main}>
          {run.answer.open && (
            <section className={`${styles.box} ${styles.answerBar}`} aria-labelledby="your-answer">
              <h2 id="your-answer" className={styles.boxTitle}>
                Your answer
              </h2>
              {run.outOfRange !== undefined && <p className={styles.body}>{run.outOfRange}</p>}
              <AnswerButtons choice={run.answer} label={`Your answer for ${c.dungeon}`} />
              {run.planOther !== undefined && (
                <Link href={run.planOther.href} className={styles.small}>
                  {run.planOther.label}
                </Link>
              )}
            </section>
          )}

          <section className={styles.box} aria-labelledby="group">
            <div className={styles.boxHead}>
              <h2 id="group" className={styles.boxTitle}>
                Group
              </h2>
              <span className={styles.small}>{run.group}</span>
            </div>
            <ul className={styles.slotGrid}>
              {run.slots.map((s, i) => (
                <li key={i} className={styles.slot} data-open={s.who === undefined || undefined}>
                  <span className={styles.slotRole}>
                    {ROLE_LABEL[s.role]}
                    {s.who === undefined ? " · Open" : ""}
                  </span>
                  {s.who === undefined ? (
                    <span>{s.open}</span>
                  ) : (
                    <>
                      <span className={styles.slotName} style={color(s.who.colorToken)}>
                        {s.who.character}
                      </span>
                      <span>
                        {[s.who.level, s.who.className].filter((x) => x !== undefined).join(" ")} · {s.who.friend}
                        {s.who.note === undefined ? "" : ` · ${s.who.note}`}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.box} aria-labelledby="answers">
            <h2 id="answers" className={styles.boxTitle}>
              Answers
            </h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Character</th>
                  <th scope="col">Friend</th>
                  <th scope="col">Role</th>
                  <th scope="col">Answer</th>
                  <th scope="col">Where</th>
                </tr>
              </thead>
              <tbody>
                {run.answers.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <span style={color(a.colorToken)}>{a.character}</span>
                      {a.level === undefined ? "" : ` ${a.level}`}
                    </td>
                    <td data-dim="">{a.friend}</td>
                    <td>{a.role}</td>
                    <td data-answer={a.answerTone}>{a.answer}</td>
                    <td data-dim="">{a.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {run.answers.length === 0 && <p className={styles.small}>Nobody answered yet.</p>}
          </section>
        </div>

        <aside className={styles.aside}>
          {run.couldJoin.length > 0 && (
            <section className={styles.box} aria-labelledby="could-join">
              <h2 id="could-join" className={styles.boxTitle}>
                Could join
              </h2>
              <ul className={styles.couldJoin}>
                {run.couldJoin.map((c) => (
                  <li key={c.character}>
                    <span style={color(c.colorToken)}>{c.character}</span>
                    {c.level === undefined ? "" : ` ${c.level}`} · {c.friend} · {c.role}
                    {c.off === undefined ? "" : ` · ${c.off}`}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {settings.runs && settings.reminders && run.answer.open && (
            <section className={styles.box} aria-labelledby="reminder">
              <h2 id="reminder" className={styles.boxTitle}>
                Reminder
              </h2>
              <p className={styles.body}>
                Discord reminds everyone who answered I&apos;m in or Maybe {settings.reminderMinutes} min before, and
                again at the start.
              </p>
            </section>
          )}
          {(run.mayEdit || run.mayDelete) && (
            <section className={styles.box} aria-label="Organiser">
              <div className={styles.buttons}>
                {run.mayEdit && (
                  <Link href={`/runs/${id}/edit`} className={styles.secondary}>
                    Edit run
                  </Link>
                )}
                {run.mayDelete && <DeleteRun action={deleteAction.bind(null, id)} admin={run.adminDelete} />}
              </div>
              <p className={styles.small}>
                Only the organiser can edit. Deleting tells everyone who answered and marks the Discord post cancelled.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
