"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CONTINENTS, parseContinent } from "@/core/views/mapMarkers";
import { SegmentedNav } from "@/components/ui/SegmentedNav";
import { EmblemIcon, UploadIcon } from "@/components/ui/icons";
import { NAV, isCurrent } from "./nav";
import { UserMenu } from "./UserMenu";
import type { Viewer } from "./viewer";
import styles from "./TopBar.module.css";

export interface TopBarProps {
  /** The site name from the data (siteName view model), never hardcoded. */
  siteName: string;
  /** "just now", "2 h ago"; undefined before the first upload. */
  dataAgo?: string;
  viewer?: Viewer;
  signOut: () => Promise<void>;
}

/** Desktop top bar and phone app bar (map, roster-cards, upload and phone-map boards). */
export function TopBar({ siteName, dataAgo, viewer, signOut }: TopBarProps) {
  const pathname = usePathname();
  const onMap = pathname === "/";
  const uploadCurrent = isCurrent("/upload", pathname);
  const continent = parseContinent(useSearchParams().get("continent"));
  return (
    <header className={styles.bar} data-variant={onMap ? "map" : "data"}>
      <Link href="/" className={styles.brand}>
        <EmblemIcon className={styles.emblem} />
        <span>{siteName}</span>
      </Link>
      <nav aria-label="Main" className={styles.nav}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={styles.navLink}
            aria-current={isCurrent(item.href, pathname) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {onMap && (
        <div className={styles.continents}>
          <SegmentedNav
            label="Continent"
            options={CONTINENTS.map((c) => ({
              href: c.value === "azeroth" ? "/" : `/?continent=${c.value}`,
              label: c.label,
              current: c.value === continent,
            }))}
          />
          {/* The zone in the centre at zone zoom (4×, WEB-26): MapStage fills this slot. */}
          <span className={styles.zone} data-map-zone="" />
        </div>
      )}
      <span className={styles.spacer} />
      <span className={styles.age} data-testid="data-age">
        <span className={styles.ageDesktop}>{dataAgo === undefined ? "No data yet" : `Data uploaded ${dataAgo}`}</span>
        <span className={styles.agePhone}>{dataAgo === undefined ? "No data yet" : `Updated ${dataAgo}`}</span>
      </span>
      {viewer?.mayUpload && (
        <Link href="/upload" className={styles.upload} aria-current={uploadCurrent ? "page" : undefined}>
          <UploadIcon className={styles.uploadIcon} />
          Upload
        </Link>
      )}
      {viewer !== undefined && <UserMenu viewer={viewer} signOut={signOut} />}
    </header>
  );
}
