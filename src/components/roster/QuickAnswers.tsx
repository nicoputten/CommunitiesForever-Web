import type { CSSProperties } from "react";
import { classInfo } from "@/core/gamedata";
import type { CharacterView } from "@/core/views/characters";
import type { QuickAnswers as Answers } from "@/core/views/roster";
import styles from "./QuickAnswers.module.css";

type Detail = (c: CharacterView) => string;

const levelClass: Detail = (c) => [c.level, c.className].filter((p) => p !== undefined).join(" ");
const level: Detail = (c) => (c.level === undefined ? "" : String(c.level));
const max: Detail = (c) =>
  [[c.mainTreeName, c.className].filter((p) => p !== undefined).join(" "), c.ilvl === undefined ? undefined : `ilvl ${c.ilvl}`]
    .filter((p) => p !== undefined && p !== "")
    .join(" · ");

function Answer({ question, characters, detail }: { question: string; characters: CharacterView[]; detail: Detail }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.q}>{question}</h3>
      <p className={styles.a}>
        {characters.length === 0
          ? "Nobody yet"
          : characters.map((c, i) => {
              const info = classInfo(c.classFile);
              const style =
                info === undefined ? undefined : ({ "--class-text": `var(${info.textToken})` } as CSSProperties);
              const text = detail(c);
              return (
                <span key={c.guid}>
                  {i > 0 && " · "}
                  <span className={styles.name} style={style}>
                    {c.name}
                  </span>
                  {text !== "" && ` ${text}`}
                </span>
              );
            })}
      </p>
    </div>
  );
}

/** Quick answers (roster-cards board): healers, tanks, level 30–40 and level 60, for the whole group. */
export function QuickAnswers({ answers }: { answers: Answers }) {
  return (
    <section className={styles.grid} aria-labelledby="quick-answers">
      <h2 id="quick-answers" className="visually-hidden">
        Quick answers
      </h2>
      <Answer question="Healers" characters={answers.healers} detail={levelClass} />
      <Answer question="Tanks" characters={answers.tanks} detail={levelClass} />
      <Answer question="Level 30 – 40" characters={answers.level30to40} detail={level} />
      <Answer question="Level 60" characters={answers.level60} detail={max} />
    </section>
  );
}
