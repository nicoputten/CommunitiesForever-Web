"use client";

import styles from "./Segmented.module.css";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  /** Names the group for screen readers ("Continent", "View"). */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** One-of-n switch of aria-pressed buttons (continent switch, cards/table view). */
export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={styles.group}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={styles.option}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
