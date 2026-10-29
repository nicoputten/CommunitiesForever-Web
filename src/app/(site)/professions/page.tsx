import type { Metadata } from "next";
import { InfoTip } from "@/components/ui/InfoTip";
import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { professions, recordCharacters } from "@/core/views";
import { ProfessionCard } from "@/components/professions/ProfessionCard";
import { ProfessionMatrix } from "@/components/professions/ProfessionMatrix";
import { ProfessionSummaryBoxes } from "@/components/professions/ProfessionSummary";
import { PageTitle } from "@/components/ui/PageTitle";
import { ProfessionsEmpty } from "./empty";
import styles from "./professions.module.css";

export const metadata: Metadata = { title: "Professions" };

const SUB = "Who can craft what across the group";

/** Who can craft what across the group (WEB-24, board `professions`). */
export default async function ProfessionsPage() {
  const data = getDataset();
  const now = nowSeconds();
  if (data === undefined || recordCharacters(data, now).length === 0) return <ProfessionsEmpty />;

  const view = professions(data, now);
  return (
    <div className={styles.page}>
      <PageTitle sub={SUB}>Professions</PageTitle>
      {/* The recipe search (RecipeSearch) is hidden until the addon shares recipes (WEB-65). */}
      <ProfessionSummaryBoxes view={view} />

      <section className={styles.section} aria-labelledby="by-profession">
        <div className={styles.head}>
          <h2 id="by-profession" className={styles.title}>
            By profession
          </h2>
          <InfoTip>
            The light part of a bar is the room left until the current cap. ★ marks the best in the group.
          </InfoTip>
        </div>
        <div className={styles.cards}>
          {view.professions.map((p) => (
            <ProfessionCard key={p.skillLine} profession={p} />
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="by-character">
        <div className={styles.head}>
          <h2 id="by-character" className={styles.title}>
            By character
          </h2>
          <p className={styles.hint}>Brighter cell = higher skill</p>
        </div>
        <ProfessionMatrix matrix={view.matrix} />
      </section>
    </div>
  );
}
