import Link from "next/link";
import type { RunCardView } from "@/core/views/runs";
import { AnswerButtons } from "./AnswerButtons";
import styles from "./Runs.module.css";

/** A run in the list (runs board): when, what, who, the five slots, and answer buttons when you can join it. */
export function RunCard({ run }: { run: RunCardView }) {
  const [day, time] = splitWhen(run.when);
  return (
    <article className={styles.run} data-yours={run.yours || undefined} aria-labelledby={`run-${run.id}`}>
      <div className={styles.when}>
        <span>{day}</span>
        <b>{time}</b>
        <span data-soon={run.pill.tone === "soon" || undefined}>{run.organiserTime ?? run.until}</span>
      </div>
      <div>
        <div className={styles.titleRow}>
          <Link id={`run-${run.id}`} href={run.href} className={styles.runName}>
            {run.dungeon}
          </Link>
          <span className={styles.pill} data-tone={run.pill.tone}>
            {run.pill.label}
          </span>
          {run.yours && (
            <span className={styles.pill} data-tone="yours">
              Yours
            </span>
          )}
        </div>
        <p className={styles.runLine}>{run.line}</p>
        {run.hint !== undefined && (
          <p className={styles.hint} data-tone={run.hint.tone}>
            {run.hint.text}
          </p>
        )}
      </div>
      <div className={styles.side}>
        <span className={styles.slots} aria-hidden="true">
          {run.slots.map((s, i) => (
            <i key={i} data-filled={s.filled || undefined} />
          ))}
        </span>
        {run.answer === undefined ? (
          <span className={styles.tally}>{run.tally}</span>
        ) : (
          <AnswerButtons choice={run.answer} size="small" label={`Answer for ${run.dungeon}`} />
        )}
      </div>
    </article>
  );
}

/** "Today 20:30" → ["Today", "20:30"]; "Thu 29 Oct 21:00" → ["Thu 29 Oct", "21:00"]. */
function splitWhen(when: string): [string, string] {
  const at = when.lastIndexOf(" ");
  return [when.slice(0, at), when.slice(at + 1)];
}
