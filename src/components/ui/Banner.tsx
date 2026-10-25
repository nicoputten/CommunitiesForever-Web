import type { ReactNode } from "react";
import { ClockIcon } from "./icons";
import styles from "./Banner.module.css";

export interface BannerProps {
  children: ReactNode;
  /** A second, quieter line. */
  detail?: ReactNode;
}

/** Site-wide notice under the top bar (loading board): the stale-site banner when the last upload is 7+ days old. */
export function Banner({ children, detail }: BannerProps) {
  return (
    <div role="status" className={styles.banner}>
      <ClockIcon className={styles.icon} />
      <div className={styles.text}>
        {children}
        {detail !== undefined && <div className={styles.detail}>{detail}</div>}
      </div>
    </div>
  );
}
