import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import styles from "./placeholder.module.css";

/** A screen that is not built yet; its story replaces the page. */
export function Placeholder({ title, story }: { title: string; story: string }) {
  return (
    <div className={styles.page}>
      <PageTitle>{title}</PageTitle>
      <EmptyState title="Not built yet">This screen arrives with {story}.</EmptyState>
    </div>
  );
}
