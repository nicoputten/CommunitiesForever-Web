import styles from "./LoadingLine.module.css";

/** The thin gold line under the top bar while a page loads (loading board); it shows only after 300 ms, so a quick
 * page never flashes it. Screen readers hear "Loading". Drawn by the shell (PendingProvider). */
export function LoadingLine() {
  return (
    <div role="status" className={styles.line}>
      <span className={styles.run} />
      <span className="visually-hidden">Loading</span>
    </div>
  );
}
