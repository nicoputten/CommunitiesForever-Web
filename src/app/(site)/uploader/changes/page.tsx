import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/app/viewer";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { PageTitle } from "@/components/ui/PageTitle";
import { UploaderTabs } from "@/components/uploader/UploaderTabs";
import { VersionList } from "@/components/uploader/VersionList";
import { readCurrent, readReleaseNotes } from "@/server/releases";
import styles from "@/components/uploader/Changes.module.css";

export const metadata: Metadata = { title: "What’s new · Uploader" };

/**
 * The uploader's "What's new" (boards `uploader-changes`, `uploader-changes-states`, WEB-73): the release notes of each
 * version the update feed keeps, newest first. The app opens it at its new version (`notesUrl`). The same people as
 * the uploader page (404 for others).
 */
export default async function UploaderChangesPage() {
  const viewer = await getViewer();
  if (!viewer?.mayUpload) notFound();
  const [versions, current] = await Promise.all([readReleaseNotes(), readCurrent()]);
  // Only the newest release has a date, and only when the feed's newest is that release.
  const releasedAt =
    current !== undefined && current.version === versions[0]?.version ? current.publishedAt : undefined;

  return (
    <div className={styles.page}>
      <Atmosphere variant="calm" />
      <PageTitle>Automatic uploader</PageTitle>
      <UploaderTabs tab="changes" />
      {versions.length === 0 ? (
        <section aria-label="What’s new" className={`${styles.version} ${styles.empty}`}>
          <p className={styles.emptyTitle}>No versions yet</p>
          <Link href="/uploader" className={styles.back}>
            Back to the app
          </Link>
        </section>
      ) : (
        <VersionList versions={versions} releasedAt={releasedAt} />
      )}
    </div>
  );
}
