import Link from "next/link";
import styles from "./Segmented.module.css";

export interface SegmentedNavOption {
  href: string;
  label: string;
  current: boolean;
}

/** Segmented as links between pages (roster cards/table view): the current page looks like the pressed option. */
export function SegmentedNav({ label, options }: { label: string; options: readonly SegmentedNavOption[] }) {
  return (
    <nav aria-label={label} className={styles.group}>
      {options.map((o) => (
        <Link key={o.href} href={o.href} className={styles.option} aria-current={o.current ? "page" : undefined}>
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
