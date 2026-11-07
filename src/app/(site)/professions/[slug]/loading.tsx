import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./profession.module.css";

/** While the page renders (board recipes-states "Loading"): the header, the controls and skeleton rows keep the layout
 * still. */
export default function ProfessionLoading() {
  return (
    <div className={styles.page} aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading recipes
      </p>
      <Skeleton width="var(--size-filter-search)" height="var(--fs-display)" />
      <div className={styles.crafters}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height="var(--size-skill-bar)" />
        ))}
      </div>
      <Skeleton width="var(--size-crafters)" height="var(--size-filter)" />
      <div className={styles.skeletonRows}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={styles.skeletonRow}>
            <Skeleton width="var(--size-item-icon)" height="var(--size-item-icon)" />
            <Skeleton width={i % 2 === 0 ? "60%" : "45%"} />
          </div>
        ))}
      </div>
    </div>
  );
}
