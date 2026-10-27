import type { Metadata } from "next";
import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { professions, recordCharacters } from "@/core/views";
import { ProfessionCard } from "@/components/professions/ProfessionCard";
import { ProfessionMatrix } from "@/components/professions/ProfessionMatrix";
import { ProfessionSummaryBoxes } from "@/components/professions/ProfessionSummary";
import { RecipeSearch } from "@/components/professions/RecipeSearch";
import { PageTitle } from "@/components/ui/PageTitle";
import { ProfessionsEmpty } from "./empty";
import styles from "./professions.module.css";

export const metadata: Metadata = { title: "Professions" };

const SUB = "Who can craft what across the group · skill caps grow in steps of 75, 150, 225 and 300";

/** Who can craft what across the group (WEB-24, board `professions`). */
export default async function ProfessionsPage() {
  const data = getDataset();
  const now = nowSeconds();
  if (data === undefined || recordCharacters(data, now).length === 0) return <ProfessionsEmpty />;

  const view = professions(data, now);
  return (
    <div className={styles.page}>
      <PageTitle sub={SUB}>Professions</PageTitle>
      <RecipeSearch />
      <ProfessionSummaryBoxes view={view} />

      <section className={styles.section} aria-labelledby="by-profession">
        <div className={styles.head}>
          <h2 id="by-profession" className={styles.title}>
            By profession
          </h2>
          <p className={styles.hint}>
            Light part of a bar = room left until the current cap · <span className={styles.star}>★</span> best in the
            group
          </p>
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
