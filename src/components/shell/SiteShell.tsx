import type { ReactNode } from "react";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { Banner } from "@/components/ui/Banner";
import { timeAgo } from "@/core/views/age";
import { staleBanner } from "@/core/views/site";
import { PendingProvider } from "./Pending";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";
import type { Viewer } from "./viewer";
import styles from "./SiteShell.module.css";

export interface SiteShellProps {
  siteName: string;
  /** Unix seconds of the newest accepted upload; undefined before the first one. */
  lastUploadAt?: number;
  /** Unix seconds. */
  now: number;
  /** Undefined: signed out (no user menu, no Upload). */
  viewer?: Viewer;
  signOut: () => Promise<void>;
  children: ReactNode;
}

/**
 * The app shell around every signed-in page: top bar, stale-site banner, content, phone tab bar. Pages
 * are calm by default (the data-page glow); the map page adds its own <Atmosphere variant="map"> over it.
 */
export function SiteShell({ siteName, lastUploadAt, now, viewer, signOut, children }: SiteShellProps) {
  const stale = staleBanner(lastUploadAt, now);
  return (
    <PendingProvider>
      <div className={styles.shell}>
        <Atmosphere variant="calm" />
        <a href="#content" className={styles.skip}>
          Skip to content
        </a>
        <TopBar
          siteName={siteName}
          dataAgo={lastUploadAt === undefined ? undefined : timeAgo(lastUploadAt, now)}
          viewer={viewer}
          signOut={signOut}
        />
        {stale !== undefined && (
          <div className={styles.banner}>
            <Banner>
              Last upload was <b>{stale.days} days ago</b>. Positions and levels may be behind.
            </Banner>
          </div>
        )}
        <main id="content" tabIndex={-1} className={styles.main}>
          {children}
        </main>
        <TabBar />
      </div>
    </PendingProvider>
  );
}
