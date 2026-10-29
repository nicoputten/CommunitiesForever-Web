import type { ReactNode } from "react";
import { InfoTip } from "@/components/ui/InfoTip";
import styles from "./Admin.module.css";

/**
 * One admin page panel (WEB-18, no board): the upload board's history panel with a section heading. WEB-64: a count
 * or hint and a tag ("Owner & admins") at the end of the heading line; `strong` for the Admins box's gold line. WEB-65:
 * `sub`, what the panel is for, is the ⓘ next to the title (player copy only).
 */
export function AdminPanel({
  id,
  title,
  sub,
  aside,
  strong = false,
  children,
}: {
  id: string;
  title: string;
  sub?: string;
  aside?: ReactNode;
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={styles.panel} data-strong={strong || undefined}>
      <div className={styles.head}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {sub !== undefined && <InfoTip>{sub}</InfoTip>}
        {aside !== undefined && <span className={styles.aside}>{aside}</span>}
      </div>
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
