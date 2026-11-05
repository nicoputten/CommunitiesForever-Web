"use client";

import { useId, useRef, type ReactNode } from "react";
import missions from "@/components/missions/MissionPool.module.css";
import styles from "./CoAdmins.module.css";

type Action = () => Promise<void>;

/**
 * The owner's Community box (WEB-83, no board; the Probe results box's entry look and buttons, and the Make admin
 * dialog): which community uploads are held to, and "Switch community…", which asks first in a modal dialog (a bottom
 * sheet on a phone). Not in the Danger zone: nothing is hidden or deleted. While the owner hasn't uploaded since a
 * switch, Undo.
 */
export function CommunitySwitch({
  line,
  state,
  switchAction,
  undo,
}: {
  /** What the box says, already formatted. */
  line: ReactNode;
  /** `set`: Switch is offered; `pending`: Undo is offered; `unset`: neither (a new site or a fresh start). */
  state: "set" | "pending" | "unset";
  switchAction: Action;
  undo: Action;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <div className={missions.entry}>
      <p className={styles.hint} data-testid="community-line">
        {line}
      </p>
      {state === "set" && (
        <button
          type="button"
          className={`${missions.button} ${missions.secondary}`}
          onClick={() => dialog.current?.showModal()}
        >
          Switch community…
        </button>
      )}
      {state === "pending" && (
        <form action={undo}>
          <button type="submit" className={missions.button}>
            Undo
            <span className="visually-hidden"> community switch</span>
          </button>
        </form>
      )}
      {state === "set" && (
        <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-ask`}>
          <form action={switchAction} className={styles.dialogBody} onSubmit={() => dialog.current?.close()}>
            <h3 id={`${id}-ask`} className={styles.ask}>
              Switch to another community?
            </h3>
            <p className={styles.say}>
              Pick the new community in the addon, /reload and upload: your next upload sets the site&apos;s community.
              Until then friends&apos; uploads are refused; they upload again after yours.
            </p>
            <p className={styles.say}>
              Nothing is hidden or deleted: characters, Doomsday, feats, activity and recaps stay. It shows up in Admin
              changes, and Undo takes it back until your next upload.
            </p>
            <div className={styles.buttons}>
              <button type="button" className={styles.cancel} onClick={() => dialog.current?.close()}>
                Cancel
              </button>
              <button type="submit" className={styles.confirm}>
                Switch community
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
