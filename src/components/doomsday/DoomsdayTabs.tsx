"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { DOOMSDAY_TABS, type DoomsdayTab } from "@/core/views/doomsday";
import styles from "./Doomsday.module.css";

/**
 * The Doomsday tabs. At 375 px the six don't fit and the row scrolls sideways (Nico, 2026-10-29), so the current tab
 * is scrolled into view; `tab` undefined marks none (the error state). On a phone they are pill chips without a
 * scrollbar, with a fade at the right edge (WEB-65, board live-test-phone).
 */
export function DoomsdayTabs({ tab }: { tab?: DoomsdayTab }) {
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = nav.current;
    const current = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (row === null || current === null || current === undefined) return;
    // Only the row scrolls, never the page.
    if (current.offsetLeft + current.offsetWidth > row.clientWidth) row.scrollLeft = current.offsetLeft;
  }, [tab]);
  return (
    <div className={styles.tabsWrap}>
      <nav ref={nav} aria-label="Doomsday" className={styles.tabs}>
        {DOOMSDAY_TABS.map((t) => (
          <Link key={t.tab} href={t.href} className={styles.tab} aria-current={t.tab === tab ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
