import type { Coverage } from "@/core/views/professions";
import styles from "./StatusBadge.module.css";

const LABELS: Record<Coverage, string> = { covered: "Covered", thin: "Thin", gap: "Gap" };

/** Covered / thin / gap (DESIGN.md §8) on a profession card. */
export function StatusBadge({ status }: { status: Coverage }) {
  return (
    <span className={styles.badge} data-status={status}>
      {LABELS[status]}
    </span>
  );
}
