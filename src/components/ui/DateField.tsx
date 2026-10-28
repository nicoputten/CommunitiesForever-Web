"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  WEEKDAYS,
  addDays,
  addMonths,
  dayLabel,
  dayLabelLong,
  monthGrid,
  monthLabel,
  weekdayOf,
  type IsoDate,
} from "@/core/controls";
import styles from "./DateField.module.css";

// A styled date field (WEB-48): the day as text and a 44×44 calendar button that opens a month grid (WAI-ARIA APG
// "Date picker dialog"). No native date input, so no OS icon. Weeks start on Monday; days before `min` can't be
// picked. The value is "YYYY-MM-DD" in a hidden input named `name`.

export interface DateFieldProps {
  value: IsoDate | "";
  onChange: (value: IsoDate) => void;
  /** The first day that can be picked (today for a run). */
  min?: IsoDate;
  name?: string;
  /** The field's accessible name, e.g. "Other date". */
  label: string;
  placeholder?: string;
  /** Only the calendar button, the value shown elsewhere (Plan's day chips, WEB-49). */
  buttonOnly?: boolean;
}

export function DateField({
  value,
  onChange,
  min,
  name,
  label,
  placeholder = "Pick a day",
  buttonOnly = false,
}: DateFieldProps) {
  const own = useId();
  const [open, setOpen] = useState(false);
  const start = value || min || new Date().toISOString().slice(0, 10);
  const [focused, setFocused] = useState<IsoDate>(start);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);

  const tooEarly = (day: IsoDate) => min !== undefined && day < min;

  const openPicker = () => {
    setFocused(value || min || new Date().toISOString().slice(0, 10));
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const pick = (day: IsoDate) => {
    if (tooEarly(day)) return;
    onChange(day);
    close();
  };

  // The focused day takes focus whenever it changes (roving tabindex).
  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [open, focused]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!dialogRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const onGridKey = (e: KeyboardEvent) => {
    const moves: Record<string, () => IsoDate> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -weekdayOf(focused)),
      End: () => addDays(focused, 6 - weekdayOf(focused)),
      PageUp: () => addMonths(focused, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, e.shiftKey ? 12 : 1),
    };
    const to = moves[e.key];
    if (to) {
      e.preventDefault();
      setFocused(to());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(focused);
    }
  };

  const onDialogKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      // Focus stays in the popover: month buttons and the grid.
      const stops = [...(dialogRef.current?.querySelectorAll<HTMLElement>("[data-stop]") ?? [])];
      const day = gridRef.current?.querySelector<HTMLElement>(`[data-day="${focused}"]`);
      const order = day ? [...stops, day] : stops;
      const at = order.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      order[(at + (e.shiftKey ? -1 : 1) + order.length) % order.length]?.focus();
    }
  };

  const weeks = monthGrid(focused);
  const headingId = `${own}-month`;

  return (
    <div className={styles.wrap}>
      <div className={styles.field}>
        {!buttonOnly && (
          <span className={value ? styles.value : styles.placeholder} id={`${own}-value`}>
            {value ? dayLabel(value) : placeholder}
          </span>
        )}
        <button
          ref={buttonRef}
          type="button"
          className={styles.button}
          aria-label={value ? `${label}: ${dayLabelLong(value)}. Change` : `${label}: choose a day`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? close() : openPicker())}
        >
          <CalendarIcon />
        </button>
      </div>
      {name !== undefined && <input type="hidden" name={name} value={value} />}
      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          className={styles.popover}
          onKeyDown={onDialogKey}
        >
          <div className={styles.head}>
            <button
              type="button"
              data-stop
              className={styles.monthButton}
              aria-label="Previous month"
              onClick={() => setFocused(addMonths(focused, -1))}
            >
              <ChevronIcon left />
            </button>
            <h2 id={headingId} className={styles.month} aria-live="polite">
              {monthLabel(focused)}
            </h2>
            <button
              type="button"
              data-stop
              className={styles.monthButton}
              aria-label="Next month"
              onClick={() => setFocused(addMonths(focused, 1))}
            >
              <ChevronIcon />
            </button>
          </div>
          <table ref={gridRef} role="grid" aria-labelledby={headingId} className={styles.grid} onKeyDown={onGridKey}>
            <thead>
              <tr>
                {WEEKDAYS.map(([short, long]) => (
                  <th key={short} scope="col" abbr={long} className={styles.weekday}>
                    {short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week[0]?.date}>
                  {week.map(({ date, inMonth }) => (
                    <td key={date} role="gridcell" aria-selected={date === value}>
                      <button
                        type="button"
                        data-day={date}
                        tabIndex={date === focused ? 0 : -1}
                        aria-label={dayLabelLong(date)}
                        aria-disabled={tooEarly(date) || undefined}
                        data-outside={!inMonth || undefined}
                        data-selected={date === value || undefined}
                        className={styles.day}
                        onClick={() => pick(date)}
                      >
                        {Number(date.slice(8))}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="3" width="13" height="11.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ left = false }: { left?: boolean }) {
  return (
    <svg className={styles.chevron} viewBox="0 0 8 12" aria-hidden="true">
      <path
        d={left ? "M6.5 1 1.5 6l5 5" : "M1.5 1l5 5-5 5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
