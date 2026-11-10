"use client";

import { Fragment, useId, useOptimistic, useRef, useState, useTransition } from "react";
import type { Often } from "@/core/doomsday/missionPool";
import type { HuntGroup, PoolGroup, PoolRow } from "@/core/views/missionPool";
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

/** Done: the bar and the share. */
function DoneCell({ row }: { row: Pick<PoolRow, "donePct" | "done"> }) {
  return (
    <td className={styles.dim}>
      {row.donePct !== undefined && (
        <span className={styles.bar} aria-hidden="true">
          <i style={{ width: `${row.donePct}%` }} />
        </span>
      )}
      {row.done}
    </td>
  );
}

/**
 * The Hunt's details (WEB-107): how the kill counts, today's combination per hunting faction and every combination the
 * pool version draws from, by race.
 */
function HuntInfo({ hunt }: { hunt: HuntGroup }) {
  return (
    <div className={styles.hunt}>
      <p className={styles.huntText}>{hunt.about}</p>
      <ul className={styles.huntToday} aria-label="Today’s Hunt">
        {hunt.today.map((t) => (
          <li key={t.label} className={styles.mission} data-pvp>
            {t.label}: <b>{t.combo}</b>
          </li>
        ))}
      </ul>
      <p className={styles.huntText}>{hunt.drawsFrom}</p>
      <div className={styles.huntLists}>
        {hunt.factions.map((f) => (
          <div key={f.faction}>
            <p className={styles.huntTitle}>{f.title}</p>
            <dl className={styles.huntRaces}>
              {f.races.map((r) => (
                <div key={r.race} className={styles.contents}>
                  <dt>{r.race}</dt>
                  <dd>{r.classes}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The pool (board `mission-pool`): per kind, each mission with its stats and how often it comes up, or Off. A table on
 * a desktop; on a phone one block per mission, the first 7 until "Show all". The Hunt (WEB-107), which the owner
 * doesn't steer, after the dailies.
 */
export function PoolControls({
  groups,
  hunt,
  offFrom,
  setOff,
  setOften,
}: {
  groups: PoolGroup[];
  hunt?: HuntGroup;
  offFrom: string;
  setOff: Action;
  setOften: Action;
}) {
  const [all, setAll] = useState(false);
  const total = groups.reduce((a, g) => a + g.rows.length, 0) + (hunt !== undefined ? 1 : 0);
  let index = 0;
  const huntLines = (h: HuntGroup) => {
    const blockHidden = !all && index >= SHOWN;
    const hidden = !all && index++ >= SHOWN;
    return (
      <div data-hidden={blockHidden || undefined} className={styles.lineBlock} data-testid="hunt-lines">
        <h3 className={styles.lineGroup}>{h.title}</h3>
        <div className={styles.line} data-hidden={hidden || undefined}>
          <div className={styles.lineHead}>
            <span>{h.row.text}</span>
            <span className={styles.offText}>{h.often}</span>
          </div>
          <div className={styles.lineStats}>{h.row.line}</div>
          <HuntInfo hunt={h} />
        </div>
      </div>
    );
  };
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
          <Fragment key={g.kind}>
            <tbody>
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
                  <DoneCell row={r} />
                  <td className={styles.dim}>{r.last}</td>
                  <td className={styles.end}>
                    <Often row={r} offFrom={offFrom} setOff={setOff} setOften={setOften} />
                  </td>
                </tr>
              ))}
            </tbody>
            {g.kind === "daily" && hunt !== undefined && (
              <tbody data-testid="hunt-group">
                <tr className={styles.group}>
                  <th scope="colgroup" colSpan={8}>
                    {hunt.title}
                  </th>
                </tr>
                <tr>
                  <td className={styles.name}>{hunt.row.text}</td>
                  <td className={styles.short}>{hunt.row.short}</td>
                  <td className={styles.num}>{hunt.row.points}</td>
                  <td className={styles.num}>{hunt.row.cameUp}</td>
                  <td className={styles.num}>{hunt.row.swapped}</td>
                  <DoneCell row={hunt.row} />
                  <td className={styles.dim}>{hunt.row.last}</td>
                  <td className={`${styles.end} ${styles.offText}`}>{hunt.often}</td>
                </tr>
                <tr>
                  <td colSpan={8}>
                    <HuntInfo hunt={hunt} />
                  </td>
                </tr>
              </tbody>
            )}
          </Fragment>
        ))}
      </table>
      <div className={styles.lines}>
        {groups.map((g) => (
          <Fragment key={g.kind}>
            <div data-hidden={(!all && index >= SHOWN) || undefined} className={styles.lineBlock}>
              <h3 className={styles.lineGroup}>{g.title}</h3>
              {g.rows.map((r) => {
                const hidden = !all && index++ >= SHOWN;
                return (
                  <div
                    key={r.id}
                    className={styles.line}
                    data-off={r.off || undefined}
                    data-hidden={hidden || undefined}
                  >
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
            {g.kind === "daily" && hunt !== undefined && huntLines(hunt)}
          </Fragment>
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
