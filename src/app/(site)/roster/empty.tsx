import { getViewer } from "@/app/viewer";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import styles from "./roster.module.css";

/** Before the first upload (WEB-21): cards and table alike. */
export async function RosterEmpty() {
  const viewer = await getViewer();
  return (
    <div className={styles.page}>
      <PageTitle>Roster</PageTitle>
      {viewer?.mayUpload ? (
        <EmptyState title="The roster is still empty" action={{ href: "/upload", label: "Upload the first file" }}>
          Upload the addon&apos;s file after your next play session. Everyone&apos;s characters appear here, on the map
          and in professions.
        </EmptyState>
      ) : (
        <EmptyState title="The roster is still empty">
          Nobody has uploaded data yet. Check back after the next session.
        </EmptyState>
      )}
    </div>
  );
}
