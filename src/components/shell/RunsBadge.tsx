import styles from "./RunsBadge.module.css";

/** The gold count on Runs in the top bar and tab bar (runs boards, WEB-40). */
export function RunsBadge({ count }: { count: number }) {
  return (
    <span className={styles.badge}>
      {count}
      <span className="visually-hidden"> {count === 1 ? "run" : "runs"} you can join</span>
    </span>
  );
}
