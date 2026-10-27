"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { parseTime, stepTime } from "@/core/controls";
import styles from "./TimeField.module.css";

// A styled 24-hour time input (WEB-48): a text field that reads "2030", "20:30", "20.30" or "8:30" and shows it as
// "20:30" when it loses focus; ↑ and ↓ step 15 minutes. No native time input, so no spinner and no OS icon. The
// normalised value goes in a hidden input named `name`, so Enter in the form submits "20:30" even before a blur.

export interface TimeFieldProps {
  /** "HH:MM", or what the user is typing. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  ariaDescribedBy?: string;
  /** An accessible name when there's no visible <label>. */
  ariaLabel?: string;
}

const STEP_MINUTES = 15;

export function TimeField({ value, onChange, id, name, required, ariaDescribedBy, ariaLabel }: TimeFieldProps) {
  const own = useId();
  const errorId = `${own}-error`;
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);

  // A value set from outside (a chip, a reset) replaces what's shown; what the user types is reported up as typed.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (parseTime(text) !== value) setText(value);
  }

  const change = (next: string) => {
    setText(next);
    setInvalid(false);
    onChange(parseTime(next) ?? next);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = stepTime(parseTime(text), e.key === "ArrowUp" ? STEP_MINUTES : -STEP_MINUTES);
      setText(next);
      setInvalid(false);
      onChange(next);
    }
  };

  const parsed = parseTime(text);
  const describedBy = [ariaDescribedBy, invalid ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.wrap}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="20:30"
        maxLength={5}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={styles.input}
        value={text}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => {
          if (text.trim() === "") return;
          if (parsed === undefined) setInvalid(true);
          else if (parsed !== text) setText(parsed);
        }}
      />
      {name !== undefined && <input type="hidden" name={name} value={parsed ?? text} />}
      {invalid && (
        <p id={errorId} className={styles.error} role="alert">
          Use a time like 20:30
        </p>
      )}
    </div>
  );
}
