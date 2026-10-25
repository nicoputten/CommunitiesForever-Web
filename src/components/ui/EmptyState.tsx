import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  title: string;
  /** Heading level: h1 when it is the page's only content. */
  as?: "h1" | "h2";
  children: ReactNode;
  action?: { href: string; label: string };
  /** A quiet line under the action. */
  note?: ReactNode;
}

/** Centre card for a screen without data (empty-site board): empty map, no-addon friend, gate closed. */
export function EmptyState({ title, as: Heading = "h2", children, action, note }: EmptyStateProps) {
  return (
    <section className={styles.card} aria-label={title}>
      <Heading className={styles.title}>{title}</Heading>
      <div className={styles.body}>{children}</div>
      {action !== undefined && (
        <Link href={action.href} className={styles.action}>
          {action.label}
        </Link>
      )}
      {note !== undefined && <p className={styles.note}>{note}</p>}
    </section>
  );
}
