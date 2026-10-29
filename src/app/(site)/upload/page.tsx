import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteInfo } from "@/app/site";
import { getViewer } from "@/app/viewer";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { InfoIcon } from "@/components/ui/icons";
import { PageTitle } from "@/components/ui/PageTitle";
import { Dropzone } from "@/components/upload/Dropzone";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { historyLine } from "@/core/views/upload";
import { getDb } from "@/server/db";
import { displayNames, listUploads } from "@/server/uploads";
import styles from "./upload.module.css";

export const metadata: Metadata = { title: "Upload" };

/** The upload page (boards `upload`, `upload-states`; WEB-19): admin, members and guests with "may upload". */
export default async function UploadPage() {
  const viewer = await getViewer();
  if (!viewer?.mayUpload) notFound();
  const db = getDb();
  const names = displayNames(db);
  const lines = listUploads(db).map((u) => historyLine(u, names));
  return (
    <div className={styles.page}>
      <Atmosphere variant="calm" />
      <div className={styles.main}>
        <PageTitle sub="After a play session, drop the addon's saved file here. Everyone sees what changed.">
          Upload the ledger
        </PageTitle>
        <Dropzone community={getSiteInfo().name} isAdmin={viewer.owner === true} />
        <p className={styles.hint}>
          <InfoIcon className={styles.hintIcon} />
          <span>
            The game writes this file when you log out or type <span className={styles.em}>/reload</span>. Upload after
            that, or you&apos;ll send the previous session.
          </span>
        </p>
      </div>
      <div className={styles.side}>
        <UploadHistory lines={lines} />
      </div>
    </div>
  );
}
