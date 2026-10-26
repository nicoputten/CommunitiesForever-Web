import { PageTitle } from "@/components/ui/PageTitle";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./loading.module.css";

const WIDTHS = [
  ["60%", "80%"],
  ["50%", "70%"],
  ["65%", "75%"],
];

/** While the roster renders (loading board, "Roster loading"): skeleton panels keep the layout still. */
export default function RosterLoading() {
  return (
    <div className={styles.page} aria-busy="true">
      <PageTitle>Roster</PageTitle>
      <p className="visually-hidden" role="status">
        Loading the roster
      </p>
      <div className={styles.friends}>
        {[0, 1].map((panel) => (
          <div key={panel} className={styles.panel}>
            <div className={styles.head}>
              <Skeleton shape="circle" width="var(--size-avatar-friend)" height="var(--size-avatar-friend)" />
              <Skeleton width="var(--size-search-min)" />
              <span className={styles.spacer} />
              <Skeleton shape="pill" />
            </div>
            {WIDTHS.map(([name, sub], i) => (
              <div key={i} className={styles.row}>
                <Skeleton shape="circle" />
                <div className={styles.lines}>
                  <Skeleton width={name} />
                  <Skeleton width={sub} height="var(--s-2-5)" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
