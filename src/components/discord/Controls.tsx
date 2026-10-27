"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import type { PickOption } from "@/core/guild";
import styles from "./Discord.module.css";

type Action = (form: FormData) => Promise<void>;

/**
 * A setting with an on/off switch (board: `.opt` with `.sw`). A form, so it works before hydration; the switch shows
 * the new state at once and the server's after the save.
 */
export function SettingSwitch({
  field,
  on,
  name,
  text,
  action,
}: {
  field: string;
  on: boolean;
  name: string;
  text: string;
  action: Action;
}) {
  const [shown, setShown] = useOptimistic(on);
  const [pending, start] = useTransition();
  const nameId = `switch-${field}`;
  return (
    <li className={styles.option}>
      <span>
        <span id={nameId} className={styles.optionName}>
          {name}
        </span>
        <span className={styles.optionText}>{text}</span>
      </span>
      <form
        action={(form) =>
          start(async () => {
            setShown(!on);
            await action(form);
          })
        }
      >
        <input type="hidden" name="field" value={field} />
        <input type="hidden" name="value" value={String(!on)} />
        <button
          type="submit"
          role="switch"
          aria-checked={shown}
          aria-labelledby={nameId}
          aria-busy={pending || undefined}
          className={styles.switchButton}
        >
          <span className={styles.switch} aria-hidden="true" />
        </button>
      </form>
    </li>
  );
}

/** A setting that is always on (board: "Starting now", `.ok` "Always on"). */
export function SettingFixed({ name, text, state }: { name: string; text: string; state: string }) {
  return (
    <li className={styles.option}>
      <span>
        <span className={styles.optionName}>{name}</span>
        <span className={styles.optionText}>{text}</span>
      </span>
      <span className={styles.ok}>{state}</span>
    </li>
  );
}

export type { PickOption } from "@/core/guild";

/**
 * A dropdown that saves on change (board: `.lab` over `.sel`). Disabled with `none` as its one line while there is
 * nothing to pick (the bot's channels and roles before the bot reported them, WEB-38).
 */
export function SettingPick({
  field,
  label,
  value,
  options,
  none,
  hint,
  action,
}: {
  field: string;
  label: string;
  value: string;
  options: PickOption[];
  none?: string;
  hint?: ReactNode;
  action: Action;
}) {
  const [shown, setShown] = useOptimistic(value);
  const [, start] = useTransition();
  const id = `pick-${field}`;
  const empty = options.length === 0;
  return (
    <div>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={empty ? "" : shown}
        disabled={empty}
        onChange={(e) => {
          const form = new FormData();
          form.set("field", field);
          form.set("value", e.target.value);
          start(async () => {
            setShown(e.target.value);
            await action(form);
          });
        }}
      >
        {empty ? (
          <option value="">{none}</option>
        ) : (
          options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        )}
      </select>
      {hint !== undefined && <p className={`${styles.small} ${styles.hint}`}>{hint}</p>}
    </div>
  );
}
