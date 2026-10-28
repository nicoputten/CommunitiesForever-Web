import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { nowSeconds } from "@/app/clock";
import { getViewer } from "@/app/viewer";
import { AnswerPicker } from "@/components/runs/AnswerPicker";
import { DeleteRun } from "@/components/runs/DeleteRun";
import styles from "@/components/runs/Runs.module.css";
import { MoveStatus, SlotMenu } from "@/components/runs/SlotMenu";
import { ClassDisc } from "@/components/ui/ClassDisc";
import type { ClassFile } from "@/core/gamedata/classes";
import { ROLE_LABEL, runDetail } from "@/core/views/runs";
import { getDb } from "@/server/db";
import { getBotSettings } from "@/server/discord";
import { runsInput } from "@/server/runsInput";
import { deleteAction } from "../actions";

export const metadata: Metadata = { title: "Run" };

const color = (token: string | undefined) =>
  token === undefined ? undefined : ({ color: `var(${token})` } as CSSProperties);

/**
 * A run's page (WEB-40; v2 WEB-49, board `runs-v2-run-detail`): the time as large as the title, your answer through
 * the picker (or the organiser's bar), the group with each slot's ⋯ menu for the organiser and the admin, Could fill,
 * Maybe and Reserve, the answers with role, fit and day.
 */
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const id = Number((await params).id);
  if (viewer === undefined || !Number.isInteger(id)) notFound();
  const db = getDb();
  const run = runDetail(runsInput(db, viewer.battleTag, nowSeconds()), id);
  if (run === undefined) notFound();
  const settings = getBotSettings(db);
  // The site doesn't see the bot's edits; a runs channel with run posts on means the post follows the answers.
  const discordPost = settings.runs && settings.runsChannel !== null;
  const c = run.card;
  const open = run.answer.open;
  const bar = run.leadBar;

  return (
    <div className={styles.main}>
      <p className={styles.crumbs}>
        <Link href="/runs">Runs</Link> › {c.dungeon}
      </p>

      <div className={styles.hero}>
        <div className={styles.titleBlock}>
          <div className={styles.titleRow}>
            <span className={styles.pill} data-tone={c.pill.tone}>
              {c.pill.label}
            </span>
            {run.isOrganiser && (
              <span className={styles.pill} data-tone="dim">
                Yours
              </span>
            )}
            <span className={styles.small}>
              {run.cancelled ?? run.plannedBy}
              {run.outcome === undefined ? "" : ` · ${run.outcome}`}
            </span>
          </div>
          <h1 className={styles.runTitle}>{c.dungeon}</h1>
          <p className={styles.whenBig}>
            <span className={styles.runTitle}>{run.when}</span>
            {run.countdown !== undefined && <span className={styles.countdown}>{run.countdown}</span>}
          </p>
          {c.organiserTime !== undefined && <p className={styles.meta}>{c.organiserTime}</p>}
          <p className={styles.meta}>{run.levels}</p>
          {run.note !== undefined && <p className={styles.quote}>“{run.note}”</p>}
        </div>
        {(run.mayEdit || run.mayDelete) && (
          <div className={styles.buttons}>
            {run.mayEdit && (
              <Link href={`/runs/${id}/edit`} className={styles.secondary}>
                Edit run
              </Link>
            )}
            {run.mayDelete && <DeleteRun action={deleteAction.bind(null, id)} admin={run.adminDelete} />}
          </div>
        )}
      </div>

      <div className={styles.page}>
        <div className={styles.main}>
          {open && bar !== undefined && (
            <section className={`${styles.box} ${styles.leadBar}`} aria-label="You lead">
              {bar.character !== undefined && (
                <ClassDisc name={bar.character} classFile={bar.classFile as ClassFile | undefined} />
              )}
              {bar.state === "playing" ? (
                <p className={styles.leadText}>
                  You lead as{" "}
                  <strong className={styles.leadName} style={color(bar.colorToken)}>
                    {bar.character}
                  </strong>{" "}
                  · {bar.role}
                  {bar.line !== undefined && <span className={styles.leadLine}>{bar.line}</span>}
                </p>
              ) : (
                <p className={styles.leadText}>
                  {bar.state === "benched" ? (
                    <>
                      You&apos;re on the bench as{" "}
                      <strong className={styles.leadName} style={color(bar.colorToken)}>
                        {bar.character}
                      </strong>{" "}
                      · still the organiser
                    </>
                  ) : (
                    "You organise without playing"
                  )}
                </p>
              )}
              <AnswerPicker
                view={run.picker}
                mode="lead"
                label={bar.state === "playing" ? "Change character or role" : "Join again"}
              />
            </section>
          )}

          {open && bar === undefined && (
            <section className={`${styles.box} ${styles.answerBar}`} aria-labelledby="your-answer">
              <h2 id="your-answer" className={styles.boxTitle}>
                Your answer
              </h2>
              {run.summary !== undefined ? (
                <div className={styles.summaryRow}>
                  <p>
                    {run.summary.lead} {run.summary.character !== undefined && <strong>{run.summary.character}</strong>}
                    {run.summary.role !== undefined && ` · ${run.summary.role}`}
                  </p>
                  {run.summary.detail !== undefined && <p className={styles.small}>{run.summary.detail}</p>}
                  {run.answeredAt !== undefined && (
                    <p className={styles.small}>
                      {run.answeredAt}
                      {discordPost ? " · Discord updated" : ""}
                    </p>
                  )}
                </div>
              ) : (
                run.outOfRange !== undefined && <p className={styles.body}>{run.outOfRange}</p>
              )}
              {run.picker.characters.length > 0 ? (
                <AnswerPicker
                  view={run.picker}
                  mode="answer"
                  label={run.summary === undefined ? "Answer" : "Change"}
                  className={run.summary === undefined ? styles.primary : styles.secondary}
                />
              ) : (
                <p className={styles.small}>Upload your SavedVariables first: then your characters can join.</p>
              )}
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
            <MoveStatus />
            <ul className={styles.slotList}>
              {run.slots.map((s, i) => (
                <li key={i} className={styles.slot} data-open={s.who === undefined || undefined}>
                  {s.who === undefined ? (
                    <>
                      <span className={styles.slotRole}>{ROLE_LABEL[s.role]}</span>
                      <span className={styles.slotBody}>
                        <span className={styles.slotOpen}>Open</span>
                        <span>{s.open}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <ClassDisc
                        name={s.who.character}
                        classFile={s.who.classFile as ClassFile | undefined}
                        size="sm"
                      />
                      <span className={styles.slotRole}>{ROLE_LABEL[s.role]}</span>
                      <span className={styles.slotBody}>
                        <span className={styles.slotName} style={color(s.who.colorToken)}>
                          {s.who.character}
                        </span>
                        <span>
                          {[
                            [s.who.level, s.who.className].filter((x) => x !== undefined).join(" "),
                            s.who.yours ? "you" : s.who.friend,
                            s.who.note,
                          ]
                            .filter((x) => x !== undefined && x !== "")
                            .join(" · ")}
                        </span>
                      </span>
                      {s.who.fit !== undefined && (
                        <span className={styles.fitTag} data-fit={s.who.fit.kind}>
                          {s.who.fit.label}
                        </span>
                      )}
                      {s.menu !== undefined && s.who.guid !== undefined && (
                        <SlotMenu
                          runId={id}
                          guid={s.who.guid}
                          character={s.who.character}
                          yours={s.who.yours}
                          options={s.menu}
                        />
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
            <dl className={styles.groupRows}>
              {run.couldFill.length > 0 && (
                <div>
                  <dt>Could fill</dt>
                  <dd>{run.couldFill.join(" · ")} · not answered yet</dd>
                </div>
              )}
              <div>
                <dt>Maybe</dt>
                <dd>{run.maybes.length > 0 ? run.maybes.join(" · ") : "nobody"}</dd>
              </div>
              <div>
                <dt>Reserve</dt>
                <dd>{run.reserves.length > 0 ? run.reserves.join(" · ") : "nobody"}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.box} aria-labelledby="answers">
            <h2 id="answers" className={styles.boxTitle}>
              Answers
            </h2>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Character</th>
                    <th scope="col">Friend</th>
                    <th scope="col">Role</th>
                    <th scope="col">Fit</th>
                    <th scope="col">Answer</th>
                    <th scope="col">When · where</th>
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
                      <td>
                        {a.role}
                        {a.usualRole !== undefined && <span className={styles.usual}> {a.usualRole}</span>}
                      </td>
                      <td data-dim="">{a.fit ?? "—"}</td>
                      <td data-answer={a.answerTone}>{a.answer}</td>
                      <td data-dim="">{a.where}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {run.answers.length === 0 && <p className={styles.small}>Nobody answered yet.</p>}
          </section>
        </div>

        <aside className={styles.aside}>
          {run.mayMove && (
            <section className={styles.box} aria-labelledby="tools">
              <h2 id="tools" className={styles.boxTitle}>
                Organiser tools
              </h2>
              <p className={styles.body}>
                Use ⋯ on a slot to move someone to another role or to reserve, or to swap two people. They get a quiet
                notice in Discord. On your own slot you can bench yourself or leave the group, and stay the organiser.
              </p>
              {run.mayDelete && (
                <p className={styles.small}>
                  Deleting the run tells everyone who answered and marks the Discord post cancelled.
                </p>
              )}
              {!run.isOrganiser && <p className={styles.small}>Only the organiser can edit.</p>}
            </section>
          )}
          {settings.runs && settings.reminders && open && (
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
        </aside>
      </div>
    </div>
  );
}
