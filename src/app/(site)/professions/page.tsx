import type { Metadata } from "next";
import { InfoTip } from "@/components/ui/InfoTip";
import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { professions, recordCharacters } from "@/core/views";
import { RECIPE_PROFESSIONS, SMELTING, recipeTotals } from "@/core/views/recipes";
import { getDb } from "@/server/db";
import { recipeTotalRows } from "@/server/recipeViews";
import { ProfessionCard } from "@/components/professions/ProfessionCard";
import { ProfessionMatrix } from "@/components/professions/ProfessionMatrix";
import { ProfessionSummaryBoxes } from "@/components/professions/ProfessionSummary";
import { RecipeSearch } from "@/components/professions/RecipeSearch";
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
  const guids = new Set(recordCharacters(data, now).map((c) => c.guid));
  const rows = recipeTotalRows(getDb());
  const totals = recipeTotals(rows.recipes, rows.known, guids);
  // The recipe line on each crafting card (WEB-92); Mining only once the scans have Smelting recipes.
  const recipeLine = (skillLine: string) => {
    const t = totals[skillLine];
    const line = Number(skillLine);
    if (t === undefined || t.total === 0) return undefined;
    return RECIPE_PROFESSIONS.includes(line) || (line === SMELTING && t.known > 0) ? t : undefined;
  };
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
          <InfoTip>
            The light part of a bar is the room left until the current cap. ★ marks the best in the group.
          </InfoTip>
        </div>
        <div className={styles.cards}>
          {view.professions.map((p) => (
            <ProfessionCard key={p.skillLine} profession={p} recipes={recipeLine(p.skillLine)} />
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
