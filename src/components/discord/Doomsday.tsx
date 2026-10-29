"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import styles from "./Discord.module.css";

type Action = (form: FormData) => Promise<void>;

/**
 * The Doomsday reset in realm time (board `discord-page`, WEB-58): hours and minutes as two fields, saved when both
 * hold a valid time and one of them loses focus. A change counts from the next reset.
 */
export function ResetTime({ value, action }: { value: string; action: Action }) {
  const [hours, minutes] = value.split(":") as [string, string];
  const [h, setH] = useState(hours);
  const [m, setM] = useState(minutes);
  const [pending, start] = useTransition();
  const save = () => {
    const hh = h.padStart(2, "0");
    const mm = m.padStart(2, "0");
    if (!/^([01]\d|2[0-3])$/.test(hh) || !/^[0-5]\d$/.test(mm) || `${hh}:${mm}` === value) return;
    const form = new FormData();
    form.set("field", "doomsdayReset");
    form.set("value", `${hh}:${mm}`);
    start(() => action(form));
  };
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 2);
  return (
    <div className={styles.time} aria-busy={pending || undefined}>
      <input
        className={styles.timeSegment}
        inputMode="numeric"
        aria-label="Reset hour, realm time"
        value={h}
        onChange={(e) => setH(digits(e.target.value))}
        onBlur={save}
      />
      <span className={styles.timeColon} aria-hidden="true">
        :
      </span>
      <input
        className={styles.timeSegment}
        inputMode="numeric"
        aria-label="Reset minutes"
        value={m}
        onChange={(e) => setM(digits(e.target.value))}
        onBlur={save}
      />
    </div>
  );
}

const noChange = () => () => {};

/**
 * "Use Europe/London": a friend without a time zone of their own takes the browser's (board `discord-page-states`).
 * Shown only when the browser's differs from the one in use.
 */
export function UseBrowserZone({ current, action }: { current: string; action: Action }) {
  // The browser's own zone is only known on the client; the server renders nothing.
  const zone = useSyncExternalStore(
    noChange,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => undefined,
  );
  if (zone === undefined || zone === current) return null;
  return (
    <form action={action}>
      <input type="hidden" name="timeZone" value={zone} />
      <button type="submit" className={styles.secondary}>
        Use {zone.replace(/_/g, " ")}
      </button>
    </form>
  );
}
