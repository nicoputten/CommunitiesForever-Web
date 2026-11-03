"use client";

import { useId, useOptimistic, useRef, useState, useTransition } from "react";
import type { Often } from "@/core/doomsday/missionPool";
import type { PoolGroup, PoolRow } from "@/core/views/missionPool";
import styles from "./MissionPool.module.css";

type Action = (form: FormData) => Promise<void>;

/** Lines shown on a phone before "Show all" (board `mission-pool`). */
const SHOWN = 7;

const OFTEN: readonly { value: Often; label: string }[] = [
  { value: "rare", label: "Rare" },
  { value: "normal", label: "Normal" },
  { value: "often", label: "Often" },
];

/**
 * On or off, the Discord page's switch. Switching off asks first (board `mission-pool-states`); switching on doesn't.
 * Forms, so it works before hydration; the switch shows the new state at once.
 */
function OffSwitch({ row, offFrom, action }: { row: PoolRow; offFrom: string; action: Action }) {
  const [on, setOn] = useOptimistic(!row.off);
  const [, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const submit = (form: FormData) =>
    start(async () => {
      setOn(form.get("off") !== "true");
      await action(form);
    });
  const fields = (off: boolean) => (
    <>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="off" value={String(off)} />
    </>
  );
  return (
    <>
      <form
        action={submit}
        onSubmit={(e) => {
          if (!on) return;
          e.preventDefault();
          dialog.current?.showModal();
        }}
      >
        {fields(on)}
        <button type="submit" role="switch" aria-checked={on} aria-label={row.text} className={styles.switchButton}>
          <span className={styles.switch} aria-hidden="true" />
        </button>
      </form>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-ask`}>
        <form action={submit} className={styles.dialogBody} onSubmit={() => dialog.current?.close()}>
          {fields(true)}
          <h3 id={`${id}-ask`} className={styles.boxTitle}>
            Switch off “{row.text}”?
          </h3>
          <p className={styles.dialogText}>{offFrom}</p>
          <div className={styles.buttons}>
            <button type="button" className={styles.button} onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className={`${styles.button} ${styles.primary}`}>
              Switch off
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** Rare · Normal · Often: one form per choice. */
function OftenChoice({ row, action }: { row: PoolRow; action: Action }) {
  const [shown, setShown] = useOptimistic(row.often);
  const [, start] = useTransition();
  return (
    <div role="group" aria-label={`How often: ${row.text}`} className={styles.seg}>
      {OFTEN.map((o) => (
        <form
          key={o.value}
          action={(form) =>
            start(async () => {
              setShown(o.value);
              await action(form);
            })
          }
          className={styles.contents}
        >
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="often" value={o.value} />
          <button type="submit" aria-pressed={shown === o.value}>
            {o.label}
          </button>
        </form>
      ))}
    </div>
  );
}

function Often({
  row,
  offFrom,
  setOff,
  setOften,
}: {
  row: PoolRow;
  offFrom: string;
  setOff: Action;
  setOften: Action;
}) {
  return (
    <span className={styles.often}>
      {row.off ? <span className={styles.offText}>Off</span> : <OftenChoice row={row} action={setOften} />}
      <OffSwitch row={row} offFrom={offFrom} action={setOff} />
    </span>
  );
}

/**
 * The pool (board `mission-pool`): per kind, each mission with its stats and how often it comes up, or Off. A table on
 * a desktop; on a phone one block per mission, the first 7 until "Show all".
 */
export function PoolControls({
  groups,
  offFrom,
  setOff,
  setOften,
}: {
  groups: PoolGroup[];
  offFrom: string;
  setOff: Action;
  setOften: Action;
}) {
  const [all, setAll] = useState(false);
  const total = groups.reduce((a, g) => a + g.rows.length, 0);
  let index = 0;
  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Mission</th>
            <th scope="col">Short</th>
            <th scope="col" className={styles.num}>
              Points
            </th>
            <th scope="col" className={styles.num}>
              Came up
            </th>
            <th scope="col" className={styles.num}>
              Swapped
            </th>
            <th scope="col">Done</th>
            <th scope="col">Last</th>
            <th scope="col" className={styles.end}>
              How often
            </th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.kind}>
            <tr className={styles.group}>
              <th scope="colgroup" colSpan={8}>
                {g.title}
              </th>
            </tr>
            {g.rows.map((r) => (
              <tr key={r.id} data-off={r.off || undefined}>
                <td className={styles.name}>{r.text}</td>
                <td className={styles.short}>{r.short}</td>
                <td className={styles.num}>{r.points}</td>
                <td className={styles.num}>{r.cameUp}</td>
                <td className={styles.num}>{r.swapped}</td>
                <td className={styles.dim}>
                  {r.donePct !== undefined && (
                    <span className={styles.bar} aria-hidden="true">
                      <i style={{ width: `${r.donePct}%` }} />
                    </span>
                  )}
                  {r.done}
                </td>
                <td className={styles.dim}>{r.last}</td>
                <td className={styles.end}>
                  <Often row={r} offFrom={offFrom} setOff={setOff} setOften={setOften} />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <div className={styles.lines}>
        {groups.map((g) => (
          <div key={g.kind} data-hidden={(!all && index >= SHOWN) || undefined} className={styles.lineBlock}>
            <h3 className={styles.lineGroup}>{g.title}</h3>
            {g.rows.map((r) => {
              const hidden = !all && index++ >= SHOWN;
              return (
                <div key={r.id} className={styles.line} data-off={r.off || undefined} data-hidden={hidden || undefined}>
                  <div className={styles.lineHead}>
                    <span>{r.text}</span>
                    <OffSwitch row={r} offFrom={offFrom} action={setOff} />
                  </div>
                  <div className={styles.lineStats}>{r.line}</div>
                  {!r.off && <OftenChoice row={r} action={setOften} />}
                </div>
              );
            })}
          </div>
        ))}
        {!all && total > SHOWN && (
          <button type="button" className={styles.button} onClick={() => setAll(true)}>
            Show all {total}
          </button>
        )}
      </div>
    </>
  );
}
