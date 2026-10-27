import { PageTitle } from "@/components/ui/PageTitle";
import { Skeleton } from "@/components/ui/Skeleton";
import pageStyles from "../admin.module.css";
import styles from "./loading.module.css";

/** While the admin page renders: skeleton rows in the three panels keep the layout still (WEB-18). */
export default function AdminLoading() {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <div key={i} className={styles.row}>
        <div className={styles.lines}>
          <Skeleton width="50%" />
          <Skeleton width="70%" height="var(--s-2-5)" />
        </div>
        <Skeleton shape="pill" />
      </div>
    ));
  return (
    <div className={pageStyles.page} aria-busy="true">
      <PageTitle>Admin</PageTitle>
      <p className="visually-hidden" role="status">
        Loading the admin page
      </p>
      <div className={pageStyles.columns}>
        <div className={pageStyles.main}>
          <div className={styles.panel}>{rows(5)}</div>
        </div>
        <div className={pageStyles.side}>
          <div className={styles.panel}>{rows(2)}</div>
          <div className={styles.panel}>{rows(1)}</div>
        </div>
      </div>
    </div>
  );
}
