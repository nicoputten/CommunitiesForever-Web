"use client";

import { useState, useTransition } from "react";
import styles from "./Runs.module.css";

/** Delete run (run-detail board), asking inline first: deleting tells everyone who answered and cancels the post. */
export function DeleteRun({ action, admin }: { action: () => Promise<void>; admin: boolean }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const label = admin ? "Delete run (admin)" : "Delete run";
  if (!asking) {
    return (
      <button type="button" className={styles.danger} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <div className={styles.answer} role="group" aria-label="Delete this run?">
      <p className={styles.small}>
        Delete this run? Everyone who answered is told, and the Discord post says cancelled.
      </p>
      <div className={styles.buttons}>
        <button type="button" className={styles.danger} disabled={pending} onClick={() => start(() => action())}>
          Delete
        </button>
        <button type="button" className={styles.ghost} onClick={() => setAsking(false)}>
          Keep it
        </button>
      </div>
    </div>
  );
}
