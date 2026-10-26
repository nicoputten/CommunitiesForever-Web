import { PageTitle } from "@/components/ui/PageTitle";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./professions.module.css";

const ROWS = ["70%", "55%"];

/** While the page renders: skeleton summary, cards and table keep the layout still (loading board). */
export default function ProfessionsLoading() {
  return (
    <div className={styles.page} aria-busy="true">
      <PageTitle>Professions</PageTitle>
      <p className="visually-hidden" role="status">
        Loading professions
      </p>
      <div className={styles.skeletonSummary}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skeletonBox}>
            <Skeleton width="40%" height="var(--fs-summary)" />
            <Skeleton width="80%" />
          </div>
        ))}
      </div>
      <div className={styles.cards}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={styles.skeletonBox}>
            <Skeleton width="50%" />
            {ROWS.map((w, j) => (
              <Skeleton key={j} width={w} height="var(--size-skill-bar)" />
            ))}
          </div>
        ))}
      </div>
      <div className={styles.skeletonBox}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} />
        ))}
      </div>
    </div>
  );
}
