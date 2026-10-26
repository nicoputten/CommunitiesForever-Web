"use client";

import { Children, type ReactNode, useId, useRef, useState } from "react";
import styles from "./SessionReport.module.css";

/** Rows shown before "Show N more" (Nico, WEB-20). */
export const SHOWN_ROWS = 6;

/** A list that shows its first rows and a "Show N more" button for the rest (the first upload's long lists). */
export function MoreList({ children, className }: { children: ReactNode; className?: string }) {
  const rows = Children.toArray(children);
  const [open, setOpen] = useState(false);
  const id = useId();
  const hidden = rows.length - SHOWN_ROWS;
  return (
    <>
      <div id={id} className={className}>
        {open || hidden <= 0 ? rows : rows.slice(0, SHOWN_ROWS)}
      </div>
      {hidden > 0 && (
        <button
          type="button"
          className={styles.more}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {open ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </>
  );
}

/**
 * "Replay": restarts every animation of the report (the rise, the bars, the pops) where it stands, so focus stays
 * on the button. Hidden by CSS when motion is off.
 */
export function ReplayButton() {
  const button = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={button}
      type="button"
      className={`${styles.button} ${styles.outline} ${styles.replay}`}
      onClick={() => {
        const report = button.current?.closest("[data-report]");
        for (const a of report?.getAnimations({ subtree: true }) ?? []) {
          a.cancel();
          a.play();
        }
      }}
    >
      Replay
    </button>
  );
}
