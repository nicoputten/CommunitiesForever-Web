import type { ProfessionSummary, ProfessionsView } from "@/core/views/professions";
import styles from "./ProfessionSummary.module.css";

const names = (list: readonly ProfessionSummary[]) => list.map((p) => p.name).join(", ");
const withBest = (list: readonly ProfessionSummary[]) =>
  list.map((p) => `${p.name} ${p.best === undefined ? "nobody" : p.best}`).join(", ");

/** Covered / thin / gaps with the professions named (professions board, DESIGN.md §8). */
export function ProfessionSummaryBoxes({ view }: { view: ProfessionsView }) {
  const boxes = [
    {
      status: "covered",
      count: `${view.covered.length} covered`,
      text:
        view.covered.length === 0
          ? "Nobody is at 225 or higher yet"
          : `Someone is at 225 or higher: ${names(view.covered)}`,
    },
    {
      status: "thin",
      count: `${view.thin.length} thin`,
      text: view.thin.length === 0 ? "No best between 175 and 224" : `Best is 175–224: ${names(view.thin)}`,
    },
    {
      status: "gap",
      count: `${view.gaps.length} ${view.gaps.length === 1 ? "gap" : "gaps"}`,
      text: view.gaps.length === 0 ? "No profession is under 175" : `Best is under 175: ${withBest(view.gaps)}`,
    },
  ];
  return (
    <ul className={styles.summary} aria-label="Summary">
      {boxes.map((b) => (
        <li key={b.status} className={styles.box} data-status={b.status}>
          <span className={styles.count}>{b.count}</span>
          <span className={styles.text}>{b.text}</span>
        </li>
      ))}
    </ul>
  );
}
