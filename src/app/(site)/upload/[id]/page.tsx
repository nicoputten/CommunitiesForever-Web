import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/app/viewer";
import { EmptyState } from "@/components/ui/EmptyState";
import { LocalTime } from "@/components/ui/LocalTime";
import { PageTitle } from "@/components/ui/PageTitle";
import { historyLine, plural } from "@/core/views/upload";
import { getDb } from "@/server/db";
import { displayNames, getUpload } from "@/server/uploads";
import styles from "./report.module.css";

export const metadata: Metadata = { title: "Session report" };

// A plain stand-in for the session report (board `upload-report`) that WEB-20 replaces: where an upload and its
// history line lead. Same access as the upload page.
export default async function UploadReportPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getViewer())?.mayUpload) notFound();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const db = getDb();
  const upload = getUpload(db, id);
  if (upload === undefined) notFound();
  const line = historyLine(upload, displayNames(db));
  const counts = upload.summary?.counts;
  return (
    <div className={styles.page}>
      <PageTitle
        sub={
          <>
            Uploaded <LocalTime at={upload.uploadedAt} /> by {line.uploader}
          </>
        }
      >
        Session report
      </PageTitle>
      <EmptyState
        title={line.status === "done" ? line.text : `Rejected: ${line.text}`}
        action={{ href: "/upload", label: "Upload another" }}
        note="The full session report arrives with WEB-20."
      >
        {counts !== undefined ? (
          <ul className={styles.counts}>
            <li>{plural(counts.levelsGained, "level gained", "levels gained")}</li>
            <li>{plural(counts.skillGains, "skill gain")}</li>
            <li>{plural(counts.newCharacters, "new character")}</li>
            <li>{plural(counts.sightings, "new sighting")}</li>
            <li>New data from {plural(counts.peopleWithNewData, "friend")}</li>
          </ul>
        ) : (
          "Nothing was changed."
        )}
      </EmptyState>
    </div>
  );
}
