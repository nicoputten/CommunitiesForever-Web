import type { ReactNode } from "react";
import styles from "./Admin.module.css";

/** One admin page panel (WEB-18, no board): the upload board's history panel with a section heading. */
export function AdminPanel({
  id,
  title,
  sub,
  children,
}: {
  id: string;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={styles.panel}>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {sub !== undefined && <p className={styles.sub}>{sub}</p>}
      {children}
    </section>
  );
}

/** A panel without rows. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

/** A row's small submit button: Block, Unblock, Remove. `danger` in the amber of a warning. */
export function RowButton({
  action,
  battleTag,
  label,
  danger = false,
}: {
  action: (form: FormData) => Promise<void>;
  battleTag: string;
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="battleTag" value={battleTag} />
      <button type="submit" className={danger ? `${styles.button} ${styles.danger}` : styles.button}>
        {label}
        <span className="visually-hidden"> {battleTag}</span>
      </button>
    </form>
  );
}

/** A small neutral pill next to a name: "Admin", "Blocked", "Member". */
export function RowBadge({ children }: { children: ReactNode }) {
  return <span className={styles.badge}>{children}</span>;
}
