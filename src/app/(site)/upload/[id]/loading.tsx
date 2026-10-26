import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./loading.module.css";

/** While the report renders (Nico, WEB-20): skeletons for the hero, the counters and two panels keep the layout still. */
export default function ReportLoading() {
  return (
    <div className={styles.page} aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading the session report
      </p>
      <div className={styles.hero}>
        <Skeleton shape="circle" width="var(--size-report-emblem)" height="var(--size-report-emblem)" />
        <Skeleton width="var(--size-search-min)" height="var(--fs-display)" />
        <Skeleton width="var(--size-history)" />
      </div>
      <div className={styles.counters}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.box}>
            <Skeleton width="var(--s-8)" height="var(--fs-counter)" />
            <Skeleton width="60%" />
          </div>
        ))}
      </div>
      <div className={styles.columns}>
        {[0, 1].map((panel) => (
          <div key={panel} className={styles.box}>
            <Skeleton width="var(--size-row-seen)" />
            {[0, 1, 2].map((row) => (
              <div key={row} className={styles.row}>
                <Skeleton shape="circle" width="var(--size-report-disc)" height="var(--size-report-disc)" />
                <div className={styles.lines}>
                  <Skeleton width="60%" />
                  <Skeleton width="100%" height="var(--size-report-track)" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
