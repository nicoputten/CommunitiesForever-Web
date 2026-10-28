import styles from "@/components/doomsday/Doomsday.module.css";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";

/** Before any Doomsday data: nothing uploaded that shares goals yet (WEB-59; the full set of states is WEB-61). */
export function NoDoomsday() {
  return (
    <div className={styles.page}>
      <PageTitle sub="Daily goals, feats for bragging, and a ladder per track. Suggestions, never rules.">
        Doomsday
      </PageTitle>
      <EmptyState title="No Doomsday data yet">
        Goals start counting once friends upload with a CommunitiesForever version that shares them.
      </EmptyState>
    </div>
  );
}
