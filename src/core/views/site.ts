import { daysOld, isOld } from "./age";

// Site-wide facts: the site name and the stale-site banner (docs/ARCHITECTURE.md "UI").

export const DEFAULT_SITE_NAME = "CommunitiesForever";

/** An accepted upload, as far as the site name needs it. */
export interface UploadInfo {
  uploadedBy: string;
  uploadedAt: number;
  /** The file's `settings.clubName` (Dataset.community.name). */
  communityName?: string;
}

/**
 * The community name of the newest admin upload that has one; "CommunitiesForever" before that. Uploads of other
 * people never name the site. Equal upload times: the later one in the list wins.
 */
export function siteName(uploads: readonly UploadInfo[], adminBattleTag: string): string {
  let newest: UploadInfo | undefined;
  for (const u of uploads) {
    if (u.uploadedBy !== adminBattleTag || u.communityName === undefined || u.communityName === "") continue;
    if (newest === undefined || u.uploadedAt >= newest.uploadedAt) newest = u;
  }
  return newest?.communityName ?? DEFAULT_SITE_NAME;
}

export interface StaleBanner {
  lastUploadAt: number;
  days: number;
}

/** The site-wide banner when the last upload is 7 days old or more; undefined otherwise (also before any upload). */
export function staleBanner(lastUploadAt: number | undefined, now: number): StaleBanner | undefined {
  if (lastUploadAt === undefined || !isOld(lastUploadAt, now)) return undefined;
  return { lastUploadAt, days: daysOld(lastUploadAt, now) };
}
