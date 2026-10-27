"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapIcon, ProfessionsIcon, RosterIcon, RunsIcon } from "@/components/ui/icons";
import { NAV, isCurrent, type NavHref } from "./nav";
import { RunsBadge } from "./RunsBadge";
import { LinkPending } from "./Pending";
import styles from "./TabBar.module.css";

const ICONS: Record<NavHref, typeof MapIcon> = {
  "/": MapIcon,
  "/roster": RosterIcon,
  "/professions": ProfessionsIcon,
  "/runs": RunsIcon,
};

/**
 * Phone tab bar: Map · Roster · Professions · Runs (phone-map board; Runs with WEB-40). Hidden on desktop, where the
 * top bar has them. `runsBadge`: upcoming runs you can join and haven't answered.
 */
export function TabBar({ runsBadge = 0 }: { runsBadge?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={styles.bar} data-tabbar="">
      {NAV.map((item) => {
        const Icon = ICONS[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={styles.tab}
            aria-current={isCurrent(item.href, pathname) ? "page" : undefined}
          >
            <Icon className={styles.icon} />
            {item.label}
            {item.href === "/runs" && runsBadge > 0 && <RunsBadge count={runsBadge} />}
            <LinkPending />
          </Link>
        );
      })}
    </nav>
  );
}
