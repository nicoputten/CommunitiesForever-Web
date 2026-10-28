"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import type { PickerView } from "@/core/views/runs";
import { PickerFields, initialPick, type PickerValue } from "./Picker";
import styles from "./Picker.module.css";
import runStyles from "./Runs.module.css";

// The picker in a dialog (WEB-49): a popover under its button on desktop, a sheet from the bottom under 640 px (CSS).
// A modal <dialog>: focus stays inside, Esc closes and focus goes back to the button. "lead" mode (the organiser's
// "Change character or role", "Join again") has no answer step and answers I'm in.

const SHEET_QUERY = "(max-width: 639px)";

export function AnswerPicker({
  view,
  mode,
  label,
  className,
}: {
  view: PickerView;
  mode: "answer" | "lead";
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const own = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const start = initialPick(view);
  const [value, setValue] = useState<PickerValue | undefined>(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const open = () => {
    const dialog = dialogRef.current;
    const button = buttonRef.current;
    if (!dialog || !button) return;
    setValue(initialPick(view));
    setError(undefined);
    dialog.style.top = "";
    dialog.style.left = "";
    dialog.showModal();
    // Desktop: under the button, kept inside the window. The sheet's place comes from the CSS.
    if (!window.matchMedia(SHEET_QUERY).matches) {
      const r = button.getBoundingClientRect();
      const box = dialog.getBoundingClientRect();
      const gap = r.height / 4;
      const below = r.bottom + gap;
      const top = below + box.height <= window.innerHeight - gap ? below : Math.max(gap, r.top - gap - box.height);
      dialog.style.top = `${top}px`;
      dialog.style.left = `${Math.max(gap, Math.min(r.left, window.innerWidth - gap - box.width))}px`;
    }
    // Start on the chosen character, not the close button.
    dialog.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus();
  };

  const close = () => dialogRef.current?.close();

  const save = async () => {
    if (value === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/runs/${view.runId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: mode === "lead" ? "in" : value.answer,
          characterId: value.guid,
          role: value.role,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "That didn't go through. Try again.");
        return;
      }
      close();
      router.refresh();
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (view.characters.length === 0 || value === undefined) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className ?? runStyles.secondary}
        aria-haspopup="dialog"
        onClick={open}
      >
        {label}
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={`${own}-title`}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        onClose={() => buttonRef.current?.focus()}
      >
        <div className={styles.body}>
          <div className={styles.head}>
            <div>
              <h2 id={`${own}-title`} className={styles.title}>
                {mode === "lead" ? "Lead as" : view.title}
              </h2>
              <p className={styles.sub}>{view.sub}</p>
            </div>
            <button type="button" className={styles.close} aria-label="Close" onClick={close}>
              ✕
            </button>
          </div>
          <PickerFields view={view} value={value} onChange={setValue} withAnswer={mode === "answer"} />
          {error !== undefined && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button type="button" className={runStyles.primary} disabled={busy} onClick={() => void save()}>
              {mode === "lead" ? "Save" : "Save answer"}
            </button>
            <button type="button" className={runStyles.ghost} onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
