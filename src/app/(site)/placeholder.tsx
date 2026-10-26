import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import styles from "./placeholder.module.css";

/** A screen that is not built yet; its story replaces the page. A map page sets `map` for its background. */
export function Placeholder({ title, story, map = false }: { title: string; story: string; map?: boolean }) {
  return (
    <div className={styles.page} data-page={map ? "map" : undefined}>
      <PageTitle>{title}</PageTitle>
      <EmptyState title="Not built yet">This screen arrives with {story}.</EmptyState>
    </div>
  );
}
