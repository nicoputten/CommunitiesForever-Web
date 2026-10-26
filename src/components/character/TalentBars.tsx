import type { CSSProperties } from "react";
import type { CharacterPage } from "@/core/views/character";
import { classColours } from "./classStyle";
import panel from "./Panel.module.css";
import styles from "./TalentBars.module.css";

/** Talents (character board): points spent of level − 9, one bar per tree out of 31, the main tree in class colour. */
export function TalentBars({ talents, classFile }: { talents: CharacterPage["talents"]; classFile?: string }) {
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
          {talents.trees.map((t, i) => (
            <li key={i} className={panel.row}>
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
            </li>
          ))}
        </ul>
        <p className={panel.note}>Bars are out of {talents.maxTreePoints}, the deepest a tree goes</p>
      </>
    );
  }
  return (
    <section className={panel.box} aria-labelledby="talents" style={classColours(classFile)}>
      <h2 id="talents" className={panel.title}>
        Talents
      </h2>
      {body}
    </section>
  );
}
