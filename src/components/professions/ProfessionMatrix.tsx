import Link from "next/link";
import type { CSSProperties } from "react";
import { MAX_SKILL } from "@/core/gamedata";
import { COVERED_FROM, type ProfessionsView } from "@/core/views/professions";
import { characterHref } from "@/components/roster/CharacterRow";
import { classTextStyle } from "./classStyle";
import styles from "./ProfessionMatrix.module.css";

/** Column headings of the professions board, by skill line ID; a skill line not listed shows its name. */
const SHORT: Readonly<Record<string, string>> = {
  "171": "Alch",
  "164": "BS",
  "333": "Ench",
  "202": "Eng",
  "182": "Herb",
  "165": "LW",
  "186": "Mining",
  "393": "Skin",
  "197": "Tailor",
  "185": "Cook",
  "129": "First Aid",
  "356": "Fish",
};

/** Characters × professions (professions board): a brighter cell is a higher skill. */
export function ProfessionMatrix({ matrix }: { matrix: ProfessionsView["matrix"] }) {
  return (
    <div className={styles.frame} role="region" aria-label="Professions by character" tabIndex={0}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Character</th>
            {matrix.columns.map((c) => (
              <th key={c.skillLine} scope="col">
                {SHORT[c.skillLine] === undefined || SHORT[c.skillLine] === c.name ? (
                  c.name
                ) : (
                  <abbr title={c.name}>{SHORT[c.skillLine]}</abbr>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.character.guid}>
              <th scope="row">
                <Link href={characterHref(r.character.guid)} style={classTextStyle(r.character)}>
                  {r.character.name}
                </Link>{" "}
                {r.character.level}
              </th>
              {r.none ? (
                <td colSpan={matrix.columns.length} className={styles.none}>
                  No professions yet
                </td>
              ) : (
                matrix.columns.map((c) => {
                  const cell = r.cells[c.skillLine];
                  if (cell === undefined) return <td key={c.skillLine} />;
                  const style = { "--skill": Math.min(cell.rank, MAX_SKILL) / MAX_SKILL } as CSSProperties;
                  return (
                    <td key={c.skillLine}>
                      <span className={styles.cell} style={style} data-high={cell.rank >= COVERED_FROM || undefined}>
                        {cell.rank}
                      </span>
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
