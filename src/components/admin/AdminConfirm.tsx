"use client";

import { useId, useRef } from "react";
import styles from "./CoAdmins.module.css";

/**
 * "Make admin" or "Remove admin" on a row of the Admins box (WEB-64, board `admin-coadmin-states`): asks first in a
 * modal dialog, a bottom sheet on a phone. Removing someone who is online says it takes effect at once.
 */
export function AdminConfirm({
  kind,
  name,
  battleTag,
  online,
  action,
}: {
  kind: "make" | "remove";
  name: string;
  battleTag: string;
  online: boolean;
  action: (form: FormData) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const make = kind === "make";
  const label = make ? "Make admin" : "Remove admin";
  return (
    <>
      <button type="button" className={make ? styles.make : styles.remove} onClick={() => dialog.current?.showModal()}>
        {label}
        <span className="visually-hidden"> {battleTag}</span>
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-ask`}>
        <form action={action} className={styles.dialogBody} onSubmit={() => dialog.current?.close()}>
          <input type="hidden" name="battleTag" value={battleTag} />
          <h3 id={`${id}-ask`} className={styles.ask}>
            {make ? `Make ${name} an admin?` : `Remove ${name} as admin?`}
          </h3>
          {make ? (
            <>
              <p className={styles.say}>
                {name} can manage guests, blocks, Discord posts and runs, but not the bot token, the launch reset or
                other admins.
              </p>
              <p className={styles.say}>It shows up in Admin changes. You can remove it any time.</p>
            </>
          ) : (
            <>
              <p className={styles.say}>
                {name} stays a member and can still sign in. Guests, blocks, Discord posts and runs go back to you and
                the other admins.
              </p>
              {online && (
                <p className={styles.now}>
                  <span className={styles.online}>● online</span>
                  <span>
                    {name} is signed in right now. It takes effect at once: {name}&apos;s next admin click is refused
                    and the page reloads without the admin boxes. Nothing {name} already saved is undone.
                  </span>
                </p>
              )}
            </>
          )}
          <div className={styles.buttons}>
            <button type="button" className={styles.cancel} onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className={make ? styles.confirm : styles.confirmRemove}>
              {label}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
