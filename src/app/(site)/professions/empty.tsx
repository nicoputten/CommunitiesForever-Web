import { getFirstUpload } from "@/app/first-upload";
import { FirstUploadState } from "@/components/ui/FirstUploadState";
import { PageTitle } from "@/components/ui/PageTitle";
import styles from "./professions.module.css";

/** Before the first upload (WEB-24, WEB-29): the roster's empty state under this page's title. */
export async function ProfessionsEmpty() {
  const first = await getFirstUpload();
  return (
    <div className={styles.page}>
      <PageTitle>Professions</PageTitle>
      <FirstUploadState title="No professions yet" elsewhere="on the map and in the roster" {...first} />
    </div>
  );
}
