import { getViewer } from "@/app/viewer";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import styles from "./professions.module.css";

/** Before the first upload (WEB-24): the roster's empty state (WEB-21) under this page's title. */
export async function ProfessionsEmpty() {
  const viewer = await getViewer();
  return (
    <div className={styles.page}>
      <PageTitle>Professions</PageTitle>
      {viewer?.mayUpload ? (
        <EmptyState title="No professions yet" action={{ href: "/upload", label: "Upload the first file" }}>
          Upload the addon&apos;s file after your next play session. Everyone&apos;s characters appear here, on the map
          and in the roster.
        </EmptyState>
      ) : (
        <EmptyState title="No professions yet">
          Nobody has uploaded data yet. Check back after the next session.
        </EmptyState>
      )}
    </div>
  );
}
