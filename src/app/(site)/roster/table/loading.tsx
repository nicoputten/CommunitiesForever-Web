import { PageTitle } from "@/components/ui/PageTitle";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "../loading.module.css";

const WIDTHS = ["60%", "45%", "70%", "55%", "65%", "50%"];

/** While the roster table renders (WEB-22): the table's frame with skeleton rows keeps the layout still. */
export default function RosterTableLoading() {
  return (
    <div className={styles.page} aria-busy="true">
      <PageTitle>Roster</PageTitle>
      <p className="visually-hidden" role="status">
        Loading the roster
      </p>
      <div className={styles.panel}>
        {WIDTHS.map((width, i) => (
          <div key={i} className={styles.head}>
            <Skeleton shape="circle" width="var(--size-disc-xs)" height="var(--size-disc-xs)" />
            <Skeleton width={width} />
          </div>
        ))}
      </div>
    </div>
  );
}
