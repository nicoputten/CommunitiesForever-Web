import { getFirstUpload } from "@/app/first-upload";
import { FirstUploadState } from "@/components/ui/FirstUploadState";
import { PageTitle } from "@/components/ui/PageTitle";
import styles from "./roster.module.css";

/** Before the first upload (WEB-21, WEB-29): cards and table alike. */
export async function RosterEmpty() {
  const first = await getFirstUpload();
  return (
    <div className={styles.page}>
      <PageTitle>Roster</PageTitle>
      <FirstUploadState title="The roster is still empty" elsewhere="on the map and in professions" {...first} />
    </div>
  );
}
