import type { ReactNode } from "react";
import styles from "./PageTitle.module.css";

/** Page heading: display type (DESIGN.md §3) with an optional meta line (roster-cards board). */
export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className={styles.head}>
      <h1 className={styles.title}>{children}</h1>
      {sub !== undefined && <p className={styles.sub}>{sub}</p>}
    </div>
  );
}
