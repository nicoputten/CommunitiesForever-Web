"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { CUTOFF_CONFIRM } from "@/core/cutoff";
import { WhoTag } from "./CoAdmins";
import styles from "./DangerZone.module.css";

type Action = (form: FormData) => Promise<void>;

/** What the cut-off hides and what it keeps (WEB-62), in the box and in the dialog. */
function Lists() {
  return (
    <div className={styles.lists}>
      <div>
        <p className={styles.listTitle}>Hidden, not deleted</p>
        <ul className={styles.list}>
          <li>Every character, sighting and the activity from before it</li>
          <li>Runs and asks that started before it</li>
          <li>Recaps, feats and Doomsday from before it</li>
        </ul>
      </div>
      <div>
        <p className={styles.listTitle}>Kept</p>
        <ul className={styles.list}>
          <li>Who may sign in, guests and blocks</li>
          <li>Discord links, time zones, the bot&apos;s settings and token</li>
          <li>Uploaders and every uploaded file</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * The admin page's Danger zone (WEB-62, no board: built from the design system, Nico 2026-10-29): "Start fresh from
 * launch" asks in a modal dialog, where typing "delete all" enables the button; Undo when it's set. Nothing is
 * deleted either way: the site rebuilds from the uploads after the cut-off.
 */
export function DangerZone({
  set,
  start,
  undo,
}: {
  /** The cut-off, when set: when and by whom, already formatted. */
  set?: ReactNode;
  start: Action;
  undo: Action;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const id = useId();
  const ok = typed.trim() === CUTOFF_CONFIRM;
  return (
    <section aria-labelledby={`${id}-title`} className={styles.zone}>
      <div className={styles.head}>
        <h2 id={`${id}-title`} className={styles.title}>
          Danger zone
        </h2>
        <WhoTag owner />
      </div>
      <div className={styles.row}>
        <div className={styles.text}>
          <p className={styles.name}>Start fresh from launch</p>
          {set === undefined ? (
            <p className={styles.sub}>
              The site forgets everything from before now: the beta characters, runs, recaps, feats and Doomsday.
              Nothing is deleted, and Undo brings it back.
            </p>
          ) : (
            <p className={styles.sub}>{set}</p>
          )}
        </div>
        {set === undefined ? (
          <button
            type="button"
            className={styles.danger}
            onClick={() => {
              setTyped("");
              dialog.current?.showModal();
            }}
          >
            Start fresh from launch…
          </button>
        ) : (
          <form action={undo}>
            <button type="submit" className={styles.ghost}>
              Undo
            </button>
          </form>
        )}
      </div>
      <Lists />

      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-ask`}>
        <form action={start} className={styles.dialogBody} onSubmit={() => dialog.current?.close()}>
          <h3 id={`${id}-ask`} className={styles.ask}>
            Are you sure? This is destructive
          </h3>
          <p className={styles.sub}>
            From now on the site shows only what is uploaded after this moment. The uploads themselves stay, and Undo
            brings everything back.
          </p>
          <Lists />
          <label htmlFor={`${id}-confirm`} className={styles.label}>
            Type <span className={styles.code}>{CUTOFF_CONFIRM}</span> to confirm
          </label>
          <input
            id={`${id}-confirm`}
            name="confirm"
            className={styles.input}
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <div className={styles.buttons}>
            <button type="button" className={styles.ghost} onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className={styles.danger} disabled={!ok}>
              Start fresh from launch
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
