"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapIcon, ProfessionsIcon, RosterIcon } from "@/components/ui/icons";
import { NAV, isCurrent, type NavHref } from "./nav";
import { LinkPending } from "./Pending";
import styles from "./TabBar.module.css";

const ICONS: Record<NavHref, typeof MapIcon> = { "/": MapIcon, "/roster": RosterIcon, "/professions": ProfessionsIcon };

/** Phone tab bar: Map · Roster · Professions (phone-map board). Hidden on desktop, where the top bar has them. */
export function TabBar() {
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
            <LinkPending />
          </Link>
        );
      })}
    </nav>
  );
}
