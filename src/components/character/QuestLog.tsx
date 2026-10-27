import { timeAgo } from "@/core/views/age";
import type { QuestView } from "@/core/views/characters";
import panel from "./Panel.module.css";
import styles from "./QuestLog.module.css";

export interface QuestLogProps {
  quests: QuestView[];
  /** When the addon recorded the character (its updatedAt). */
  recordedAt?: number;
  now: number;
}

/** The quest log (character board): titles only, as the addon recorded them. */
export function QuestLog({ quests, recordedAt, now }: QuestLogProps) {
  return (
    <section className={panel.box} aria-labelledby="quest-log">
      <h2 id="quest-log" className={panel.title}>
        Quest log
      </h2>
      {quests.length === 0 ? (
        <p className={panel.empty}>No quests in the log</p>
      ) : (
        <>
          <ul className={styles.list}>
            {quests.map((q) => (
              <li key={q.id} className={styles.quest}>
                {q.title ?? `Quest ${q.id}`}
              </li>
            ))}
          </ul>
          <p className={panel.note}>
            Titles only, as the addon recorded them{recordedAt === undefined ? "" : ` ${timeAgo(recordedAt, now)}`}
          </p>
        </>
      )}
    </section>
  );
}
