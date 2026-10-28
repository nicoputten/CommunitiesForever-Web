import Link from "next/link";
import type { NextRunView } from "@/core/views/runs";
import styles from "./NextRun.module.css";

/**
 * The "Next run" card on the roster (WEB-45, board `roster-cards-runs`): the next upcoming run, whoever can join it;
 * not shown when nothing is planned (Nico, 2026-10-28).
 */
export function NextRun({ run }: { run: NextRunView }) {
  return (
    <section className={styles.card} aria-label="Next run">
      <span className={styles.label} aria-hidden="true">
        Next run
      </span>
      <Link href={run.href} className={styles.title}>
        {run.dungeon} · {run.when}
      </Link>
      <span className={styles.line}>{run.line}</span>
      <Link href="/runs" className={styles.all}>
        All runs →
      </Link>
    </section>
  );
}
