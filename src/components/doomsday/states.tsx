import type { ReactNode } from "react";
import { Banner } from "@/components/ui/Banner";
import { DoomsdayEmblem } from "@/components/ui/icons";
import { PageTitle } from "@/components/ui/PageTitle";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./Doomsday.module.css";
import { DoomsdayTabs } from "./DoomsdayTabs";

// The Doomsday page's loading and error states (WEB-61, board doomsday-phone "Today · loading"; the error has no
// board: Nico 2026-10-29). Title and tabs stay, so another tab is one tap away.

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <DoomsdayEmblem className={styles.emblem} />
        <div className={styles.headText}>
          <PageTitle>Doomsday</PageTitle>
        </div>
      </div>
      <DoomsdayTabs />
      {children}
    </div>
  );
}

export function DoomsdayLoading() {
  return (
    <Shell>
      <div className={`${styles.card} ${styles.skeletons}`} aria-busy="true">
        <Skeleton width="60%" height="var(--s-5)" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height="var(--size-goal-row)" />
        ))}
        <p className={styles.note} role="status">
          Loading today’s goals…
        </p>
      </div>
    </Shell>
  );
}

/** `retry` is the error boundary's reset; the states page passes none (nothing to retry). */
export function DoomsdayError({ retry }: { retry?: () => void }) {
  return (
    <Shell>
      <Banner detail="The rest of the site works; try again in a minute.">Doomsday couldn&apos;t load.</Banner>
      <div>
        <button type="button" className={styles.retry} onClick={retry}>
          Try again
        </button>
      </div>
    </Shell>
  );
}
