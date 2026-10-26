import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDataset } from "@/app/dataset";
import { getSiteInfo } from "@/app/site";
import { getViewer } from "@/app/viewer";
import { SessionReport } from "@/components/report/SessionReport";
import { LocalTime } from "@/components/ui/LocalTime";
import { PageTitle } from "@/components/ui/PageTitle";
import { UploadStateCard } from "@/components/upload/Dropzone";
import { sessionReport } from "@/core/views/report";
import { historyLine, storedOutcome } from "@/core/views/upload";
import { getDb } from "@/server/db";
import { displayNames, getUpload } from "@/server/uploads";
import styles from "./report.module.css";

export const metadata: Metadata = { title: "Session report" };

/**
 * The session report of one upload (board `upload-report`, WEB-20): where an upload and its history line lead.
 * Every signed-in viewer may open one (it shows nothing the map and roster don't); "Upload another" only shows to
 * someone who may upload. A rejected upload, or one that changed nothing, shows its upload screen state instead.
 */
export default async function UploadReportPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (viewer === undefined) notFound();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const db = getDb();
  const upload = getUpload(db, id);
  if (upload === undefined) notFound();
  const { uploader } = historyLine(upload, displayNames(db));

  const outcome = storedOutcome(upload);
  if (outcome !== undefined || upload.summary === undefined) {
    return (
      <div className={styles.page}>
        <PageTitle
          sub={
            <>
              Uploaded <LocalTime at={upload.uploadedAt} phrase /> by {uploader}
            </>
          }
        >
          Session report
        </PageTitle>
        <UploadStateCard
          outcome={outcome ?? { kind: "nothing-new" }}
          community={getSiteInfo().name}
          isAdmin={viewer.role === "admin"}
          mayUpload={viewer.mayUpload}
        />
      </div>
    );
  }

  const report = sessionReport(upload.summary, upload.uploadedAt, getDataset(), uploader, upload.first);
  return <SessionReport report={report} mayUpload={viewer.mayUpload} />;
}
