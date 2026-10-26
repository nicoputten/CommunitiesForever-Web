import Link from "next/link";
import type { ProfessionSummary } from "@/core/views/professions";
import { professionSlug } from "@/core/views/rosterQuery";
import { characterHref } from "@/components/roster/CharacterRow";
import { classTextStyle } from "./classStyle";
import { SkillBar } from "./SkillBar";
import { StatusBadge } from "./StatusBadge";
import styles from "./ProfessionCard.module.css";

/** One profession (professions board): its status and everyone's skill bar, the best first and starred. The title
 * opens the roster filtered on it; the card's id lets other pages link here (WEB-23 "Compare with the group"). */
export function ProfessionCard({ profession: p }: { profession: ProfessionSummary }) {
  const slug = professionSlug(p.skillLine);
  const titleId = `profession-${slug}`;
  return (
    <section id={slug} className={styles.card} data-status={p.status} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h3 id={titleId} className={styles.title}>
          <Link href={`/roster?prof=${encodeURIComponent(slug)}`}>{p.name}</Link>
        </h3>
        {p.kind === "secondary" && <span className={styles.kind}>secondary</span>}
        <StatusBadge status={p.status} />
      </div>
      {p.entries.length === 0 ? (
        <p className={styles.nobody}>Nobody has it yet</p>
      ) : (
        <ul className={styles.entries}>
          {p.entries.map((e) => (
            <li key={e.character.guid} className={styles.entry}>
              <Link href={characterHref(e.character.guid)} className={styles.name} style={classTextStyle(e.character)}>
                {e.character.name}
                {e.best && (
                  <>
                    <span className={styles.best} aria-hidden="true">
                      ★
                    </span>
                    <span className="visually-hidden">, best in the group</span>
                  </>
                )}
              </Link>
              <SkillBar rank={e.rank} max={e.max} best={e.best} old={e.old} />
              <span className={styles.value}>{e.max === undefined ? e.rank : `${e.rank} / ${e.max}`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
