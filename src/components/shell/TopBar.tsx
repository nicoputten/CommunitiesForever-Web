"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CONTINENTS, parseContinent } from "@/core/views/mapMarkers";
import { SegmentedNav } from "@/components/ui/SegmentedNav";
import { requestSheet } from "@/components/map/flyTo";
import { BackIcon, EmblemIcon, FiltersIcon, UploadIcon } from "@/components/ui/icons";
import { NAV, isCurrent } from "./nav";
import { LinkPending } from "./Pending";
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
  // "Uploader" (WEB-34): the uploader page, and the manual upload page and reports it links to.
  const uploadCurrent = isCurrent("/uploader", pathname) || isCurrent("/upload", pathname);
  const params = useSearchParams();
  const continent = parseContinent(params.get("continent"));
  // The phone map with a character open in its sheet: back, the zone and "2 here" (phone-character board, WEB-28).
  const character = onMap && params.get("character") !== null;
  return (
    <header className={styles.bar} data-variant={onMap ? "map" : "data"} data-character={character || undefined}>
      {character && (
        <>
          <button type="button" className={styles.back} aria-label="Back to map" onClick={() => requestSheet("close")}>
            <BackIcon className={styles.backIcon} />
          </button>
          {/* MapStage fills this slot with the zone and the count. */}
          <span className={styles.phoneTitle} data-map-phone-title="" />
        </>
      )}
      <Link href="/" className={styles.brand}>
        <EmblemIcon className={styles.emblem} />
        <span>{siteName}</span>
        <LinkPending />
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
            <LinkPending />
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
      {onMap && (
        <button type="button" className={styles.filters} aria-label="Filters" onClick={() => requestSheet("full")}>
          <FiltersIcon className={styles.filtersIcon} />
        </button>
      )}
      {viewer?.mayUpload && (
        <Link href="/uploader" className={styles.upload} aria-current={uploadCurrent ? "page" : undefined}>
          <UploadIcon className={styles.uploadIcon} />
          Uploader
          <LinkPending />
        </Link>
      )}
      {/* "Discord" (WEB-39, board `discord-settings-runs`): everyone links their own account here. */}
      {viewer !== undefined && (
        <Link
          href="/discord"
          className={styles.discord}
          aria-current={isCurrent("/discord", pathname) ? "page" : undefined}
        >
          Discord
          <LinkPending />
        </Link>
      )}
      {viewer !== undefined && <UserMenu viewer={viewer} signOut={signOut} />}
    </header>
  );
}
