import type { Editor } from "@/core/views/missionPool";
import { InfoTip } from "@/components/ui/InfoTip";
import { LockIcon, PinIcon } from "@/components/ui/icons";
import { PickButton } from "./PickButton";
import styles from "./MissionPool.module.css";

type Action = (form: FormData) => Promise<void>;

/**
 * A day or week opened under the days (boards `mission-pool-steering`, `mission-pool-states`): its slots with Reroll and
 * Pick…, Reroll day and Back to normal draw; a locked one shows its set only. A changed day says who saw the normal
 * draw.
 */
export function DayEditor({
  editor,
  pin,
  reroll,
  rerollDay,
  backToNormal,
}: {
  editor: Editor;
  pin: Action;
  reroll: Action;
  rerollDay: Action;
  backToNormal: Action;
}) {
  const hidden = { period: editor.period, n: String(editor.n) };
  const fields = (
    <>
      <input type="hidden" name="period" value={editor.period} />
      <input type="hidden" name="n" value={editor.n} />
    </>
  );
  return (
    <section className={styles.box} data-open aria-labelledby="mission-editor" id="editor">
      <div className={styles.head}>
        <h2 id="mission-editor" className={styles.boxTitle}>
          {editor.title}
        </h2>
        {editor.locked ? (
          <LockIcon className={styles.lock} aria-label="Locked" role="img" aria-hidden={undefined} />
        ) : editor.changed ? (
          <span className={styles.badge}>changed</span>
        ) : (
          <span className={styles.aside}>normal draw</span>
        )}
      </div>
      {editor.locked ? (
        <div className={styles.locks}>Locked</div>
      ) : (
        editor.span !== undefined && <div className={styles.span}>{editor.span}</div>
      )}
      {editor.sawNormal.map((name) => (
        <p key={name} className={styles.warn}>
          <span>{name} saw the normal draw</span>
          <InfoTip>
            {name}’s points count for the missions {name} had.
          </InfoTip>
        </p>
      ))}
      <ul className={styles.slots}>
        {editor.slots.map((s) => (
          <li key={s.slot} className={styles.slot}>
            <span className={styles.slotKey}>{s.name}</span>
            <span className={styles.slotText}>
              {s.text}
              {s.tag !== undefined && (
                <span className={styles.tag}>
                  {s.tag === "pinned" && <PinIcon className={styles.pin} />}
                  {s.tag}
                </span>
              )}
            </span>
            {!editor.locked && (
              <span className={styles.slotActions}>
                <form action={reroll}>
                  {fields}
                  <input type="hidden" name="slot" value={s.slot} />
                  <button type="submit" className={styles.small}>
                    Reroll<span className="visually-hidden"> {s.name}</span>
                  </button>
                </form>
                <PickButton slot={s} hidden={hidden} action={pin} />
              </span>
            )}
          </li>
        ))}
        {editor.period === "day" && (
          <li className={styles.slot}>
            <span className={styles.slotKey}>Duel</span>
            <span className={styles.slotText}>
              First duel with each friend<span className={styles.tag}>every day</span>
            </span>
          </li>
        )}
      </ul>
      {!editor.locked &&
        editor.warnings.map((w) => (
          <p key={w} className={styles.warn}>
            {w}
          </p>
        ))}
      {editor.locks !== undefined && <div className={styles.locks}>{editor.locks}</div>}
      {!editor.locked && (
        <div className={styles.buttons}>
          <form action={rerollDay}>
            {fields}
            <button type="submit" className={`${styles.button} ${styles.secondary}`}>
              {editor.period === "day" ? "Reroll day" : "Reroll week"}
            </button>
          </form>
          {editor.canReset && (
            <form action={backToNormal}>
              {fields}
              <button type="submit" className={styles.button}>
                Back to normal draw
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
