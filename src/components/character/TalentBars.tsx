import type { CSSProperties } from "react";
import type { CharacterPage } from "@/core/views/character";
import type { TreeTooltip } from "@/core/views/talentTooltip";
import { classColours } from "./classStyle";
import panel from "./Panel.module.css";
import styles from "./TalentBars.module.css";
import { TalentTreeRow } from "./TalentTooltip";

/**
 * Talents (character board): points spent of level − 9, one bar per tree out of 31, the main tree in class colour.
 * WEB-100: each tree's row opens its tooltip (`tooltips`, one per tree; ./TalentTooltip.tsx).
 */
export function TalentBars({
  talents,
  classFile,
  tooltips,
}: {
  talents: CharacterPage["talents"];
  classFile?: string;
  tooltips?: TreeTooltip[];
}) {
  const colours = classColours(classFile);
  let body;
  if (talents.available === 0) {
    body = <p className={panel.empty}>Talents start at level 10</p>;
  } else if (talents.trees.length === 0) {
    body = <p className={panel.empty}>No talents recorded yet</p>;
  } else {
    body = (
      <>
        <p className={panel.meta}>
          {talents.available === undefined
            ? `${talents.spent} points spent`
            : `${talents.spent} of ${talents.available} points spent (level − 9)`}
        </p>
        <ul className={panel.rows}>
          {talents.trees.map((t, i) => {
            const cells = (
              <>
                <span className={panel.label} data-tone={t.main ? "class" : undefined}>
                  {t.name ?? `Tree ${i + 1}`}
                  {t.main && <span className="visually-hidden"> (main tree)</span>}
                </span>
                <span
                  aria-hidden="true"
                  className={styles.track}
                  data-main={t.main || undefined}
                  style={{ "--fill": t.fill } as CSSProperties}
                />
                <span className={panel.value} data-tone={t.main ? "strong" : undefined}>
                  {t.points}
                </span>
              </>
            );
            const tip = tooltips?.[i];
            return tip === undefined ? (
              <li key={i} className={panel.row}>
                {cells}
              </li>
            ) : (
              <li key={i} className={styles.item}>
                <TalentTreeRow tip={tip} style={colours}>
                  {cells}
                </TalentTreeRow>
              </li>
            );
          })}
        </ul>
        <p className={panel.note}>Bars are out of {talents.maxTreePoints}, the deepest a tree goes</p>
      </>
    );
  }
  return (
    <section className={panel.box} aria-labelledby="talents" style={colours}>
      <h2 id="talents" className={panel.title}>
        Talents
      </h2>
      {body}
    </section>
  );
}
