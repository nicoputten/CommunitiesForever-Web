import Link from "next/link";
import { CHANGES_PATH } from "@/core/releases";
import styles from "./Changes.module.css";

const TABS = [
  { tab: "app", href: "/uploader", label: "The app" },
  { tab: "changes", href: CHANGES_PATH, label: "What’s new" },
] as const;

/** The uploader's two tabs under its title (board `uploader-changes`, WEB-73): The app · What's new. */
export function UploaderTabs({ tab }: { tab: (typeof TABS)[number]["tab"] }) {
  return (
    <nav aria-label="Uploader" className={styles.tabs}>
      {TABS.map((t) => (
        <Link key={t.tab} href={t.href} className={styles.tab} aria-current={t.tab === tab ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
