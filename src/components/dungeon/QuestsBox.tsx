import type { CSSProperties } from "react";
import { ClassDisc } from "@/components/ui/ClassDisc";
import { InfoTip } from "@/components/ui/InfoTip";
import type { DungeonQuest, FitCharacter } from "@/core/views/dungeon";
import styles from "./Dungeon.module.css";
import runs from "@/components/runs/Runs.module.css";

/** Holders shown per quest before the "+N" chip (board dungeon-quests): 4 on desktop, 3 on a phone. */
const DESKTOP = 4;
const PHONE = 3;

const color = (token: string | undefined) =>
  token === undefined ? undefined : ({ color: `var(${token})` } as CSSProperties);

function Holder({ c }: { c: FitCharacter }) {
  return (
    <>
      <ClassDisc name={c.name} classFile={c.classFile} size="quest" />
      <span style={color(c.colorToken)}>{c.name}</span>
    </>
  );
}

/** The holders that didn't fit, in the ⓘ tooltip behind a "+N" chip; `only` shows it at one size. */
function More({ rest, only }: { rest: readonly FitCharacter[]; only: "desktop" | "phone" }) {
  return (
    <li className={styles.more} data-only={only}>
      <InfoTip chip={{ text: `+${rest.length}`, label: `${rest.length} more` }}>
        <b className={styles.moreTitle}>Also has it</b>
        {rest.map((c) => (
          <span key={c.guid} className={styles.moreName} style={color(c.colorToken)}>
            {c.name}
          </span>
        ))}
      </InfoTip>
    </li>
  );
}

/**
 * The dungeon's quests in friends' quest logs and who has them (WEB-76, board dungeon-quests), most holders first.
 * The box stays when nobody has one, so players know it exists.
 */
export function QuestsBox({ quests }: { quests: readonly DungeonQuest[] }) {
  return (
    <section className={runs.box} aria-labelledby="quests">
      <div className={styles.fitsHead}>
        <div className={styles.questsTitle}>
          <h2 id="quests" className={runs.boxTitle}>
            Quests
          </h2>
          <InfoTip>Quests for this dungeon in friends’ quest logs, from the last upload.</InfoTip>
        </div>
        {quests.length > 0 && (
          <span className={styles.questCount}>
            {quests.length} {quests.length === 1 ? "quest" : "quests"}
          </span>
        )}
      </div>
      {quests.length === 0 ? (
        <p className={styles.noQuests}>Nobody has a quest for this dungeon</p>
      ) : (
        <ul className={styles.quests}>
          {quests.map((q) => (
            <li key={q.id} className={styles.quest}>
              <h3 className={styles.questTitle}>{q.title}</h3>
              <ul className={styles.holders} aria-label={`Who has ${q.title}`}>
                {q.holders.slice(0, DESKTOP).map((c, i) => (
                  <li key={c.guid} className={styles.holder} data-only={i >= PHONE ? "desktop" : undefined}>
                    <Holder c={c} />
                  </li>
                ))}
                {q.holders.length > PHONE && <More rest={q.holders.slice(PHONE)} only="phone" />}
                {q.holders.length > DESKTOP && <More rest={q.holders.slice(DESKTOP)} only="desktop" />}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
