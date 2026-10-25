import styles from "./SiteFooter.module.css";

/** Footer credit, exactly as DESIGN.md §1 and WEB-15 word it (the zone outlines are CC BY-SA 4.0). */
export const FOOTER_CREDIT =
  "Private fan site · not affiliated with Blizzard Entertainment · Zone outlines: Syrio, Wikimedia Commons (CC BY-SA 4.0), adapted";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <p>{FOOTER_CREDIT}</p>
    </footer>
  );
}
