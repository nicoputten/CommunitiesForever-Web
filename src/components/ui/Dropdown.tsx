"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SEARCH_FROM, filterOptions } from "@/core/controls";
import styles from "./Dropdown.module.css";

// The site's dropdown (WEB-48, board `runs-v2-plan`): replaces every native <select>. Built in house on the ARIA
// combobox and listbox patterns (WAI-ARIA APG "Select-only combobox", and "Editable combobox with list autocomplete"
// for the search from SEARCH_FROM options). Under 640 px it opens as a bottom sheet (a modal <dialog>).
// The value travels in a hidden input named `name`, so forms and server actions read it as from a <select>.

export interface DropdownOption {
  value: string;
  label: string;
  /** Dim text after the label, e.g. a level range. */
  meta?: string;
  /** Right-side hint, e.g. "fits". */
  hint?: string;
  /** Why the option can't be picked; it stays visible with this reason. */
  disabled?: string;
  /** Options with the same group follow each other under its header. */
  group?: string;
}

export interface DropdownProps {
  options: readonly DropdownOption[];
  /** Controlled value; or `defaultValue` for a form that only reads it on submit. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** The hidden input's name, for forms. */
  name?: string;
  /** The trigger's id, for a <label htmlFor>. */
  id?: string;
  /** An accessible name when there's no visible <label>. */
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** "compact": 36 px on desktop, 44 px on phones (the Discord page's settings). */
  size?: "default" | "compact";
  className?: string;
}

const SHEET_QUERY = "(max-width: 639px)";
const TYPE_AHEAD_MS = 600;

export function Dropdown({
  options,
  value,
  defaultValue,
  onChange,
  name,
  id,
  ariaLabel,
  placeholder = "Pick one",
  disabled = false,
  size = "default",
  className,
}: DropdownProps) {
  const own = useId();
  const triggerId = id ?? `${own}-trigger`;
  const listId = `${own}-list`;
  const optionId = (i: number) => `${own}-o${i}`;

  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const searchable = options.length >= SEARCH_FROM;
  const shown = useMemo(
    () => (searchable ? filterOptions(options, query) : [...options]),
    [options, query, searchable],
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const pick = (option: DropdownOption) => {
    if (option.disabled !== undefined) return;
    if (value === undefined) setInner(option.value);
    if (option.value !== current) onChange?.(option.value);
    close();
  };

  const openMenu = (start?: number) => {
    if (disabled || options.length === 0) return;
    const asSheet = window.matchMedia(SHEET_QUERY).matches;
    setSheet(asSheet);
    setQuery("");
    const at = options.findIndex((o) => o.value === current);
    setActive(start ?? (at >= 0 ? at : firstEnabled(options)));
    setOpen(true);
  };

  function close(focusTrigger = true) {
    setOpen(false);
    setQuery("");
    dialogRef.current?.close();
    if (focusTrigger) triggerRef.current?.focus();
  }

  // Opening: the sheet as a modal dialog; the search field takes focus on desktop (on touch the keyboard would cover
  // half the list, so it waits for a tap); the highlighted option scrolls into view.
  useEffect(() => {
    if (!open) return;
    if (sheet) {
      const dialog = dialogRef.current;
      if (dialog && !dialog.open) dialog.showModal();
      listRef.current?.focus();
    } else if (searchable) {
      searchRef.current?.focus();
    }
  }, [open, sheet, searchable]);

  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId only depends on `own`, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  // A click outside the menu closes it (desktop; the sheet has its backdrop).
  useEffect(() => {
    if (!open || sheet) return;
    const outside = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, sheet]);

  // The search keeps the highlight on the first match.
  const search = (text: string) => {
    setQuery(text);
    const matches = filterOptions(options, text);
    setActive(firstEnabled(matches));
  };

  const move = (to: number) => {
    if (shown.length === 0) return;
    setActive(Math.max(0, Math.min(shown.length - 1, to)));
  };

  const typeAhead = (key: string, now: number) => {
    const text = now - typed.current.at > TYPE_AHEAD_MS ? key : typed.current.text + key;
    typed.current = { text, at: now };
    const from = text.length === 1 ? active + 1 : active;
    const order = [...shown.slice(from), ...shown.slice(0, from)];
    const hit = order.find((o) => o.label.toLowerCase().startsWith(text.toLowerCase()));
    return hit === undefined ? -1 : shown.indexOf(hit);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      } else if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const at = typeAhead(e.key, e.timeStamp);
        if (at >= 0) openMenu(at);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (e.altKey) break;
        move(active + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(e.altKey ? active : active - 1);
        if (e.altKey && shown[active]) pick(shown[active]);
        break;
      case "Home":
        if (searchable && e.target === searchRef.current) break;
        e.preventDefault();
        move(0);
        break;
      case "End":
        if (searchable && e.target === searchRef.current) break;
        e.preventDefault();
        move(shown.length - 1);
        break;
      case "PageDown":
        e.preventDefault();
        move(active + 10);
        break;
      case "PageUp":
        e.preventDefault();
        move(active - 10);
        break;
      case "Enter":
        e.preventDefault();
        if (shown[active]) pick(shown[active]);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        // As a native select: Tab keeps the highlighted option and moves on.
        if (sheet) {
          e.preventDefault();
          (e.target === searchRef.current ? listRef.current : searchRef.current)?.focus();
          break;
        }
        if (shown[active] && shown[active].disabled === undefined && shown[active].value !== current) {
          if (value === undefined) setInner(shown[active].value);
          onChange?.(shown[active].value);
        }
        close(false);
        break;
      case " ":
        if (searchable && e.target === searchRef.current) break;
        e.preventDefault();
        if (shown[active]) pick(shown[active]);
        break;
      default:
        if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const at = typeAhead(e.key, e.timeStamp);
          if (at >= 0) setActive(at);
        }
    }
  };

  const activeId = open && active >= 0 && active < shown.length ? optionId(active) : undefined;
  // The search field drives the list while it has focus; otherwise the trigger (desktop) or the list (sheet) does.
  const triggerDrives = open && !sheet && !searchable;

  const list = (
    <div
      ref={listRef}
      id={listId}
      role="listbox"
      aria-labelledby={triggerId}
      tabIndex={sheet ? 0 : -1}
      aria-activedescendant={sheet ? activeId : undefined}
      onKeyDown={sheet ? onKey : undefined}
      className={styles.list}
    >
      {shown.length === 0 && <p className={styles.empty}>No match</p>}
      {groupsOf(shown).map(({ group, items }) => {
        const rows = items.map(({ option, index }) => (
          <div
            key={option.value + index}
            id={optionId(index)}
            role="option"
            aria-selected={option.value === current}
            aria-disabled={option.disabled !== undefined || undefined}
            data-active={index === active || undefined}
            className={styles.option}
            onPointerDown={(e) => e.preventDefault()}
            onPointerMove={() => setActive(index)}
            onClick={() => pick(option)}
          >
            <span className={styles.check} aria-hidden="true">
              {option.value === current ? <CheckIcon /> : null}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{option.label}</span>
              {option.meta !== undefined && <span className={styles.meta}> · {option.meta}</span>}
              {option.disabled !== undefined && <span className={styles.reason}>{option.disabled}</span>}
            </span>
            {option.hint !== undefined && <span className={styles.hint}>{option.hint}</span>}
          </div>
        ));
        return group === undefined ? (
          rows
        ) : (
          <div key={group} role="group" aria-labelledby={`${own}-g-${slug(group)}`}>
            <div id={`${own}-g-${slug(group)}`} role="presentation" className={styles.groupHeader}>
              {group}
            </div>
            {rows}
          </div>
        );
      })}
    </div>
  );

  const menu: ReactNode = (
    <>
      {searchable && (
        <div className={styles.searchRow}>
          <SearchIcon />
          <input
            ref={searchRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
            className={styles.search}
            value={query}
            onChange={(e) => search(e.target.value)}
            onKeyDown={onKey}
          />
        </div>
      )}
      {list}
      <div className={styles.footer}>
        <span className={styles.keys}>↑↓ to move · Enter to pick · Esc to close</span>
        {searchable && (
          <span aria-live="polite">
            {shown.length} of {options.length}
          </span>
        )}
      </div>
    </>
  );

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className ?? ""}`}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={triggerDrives ? activeId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        data-size={size}
        data-open={open || undefined}
        className={styles.trigger}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKey}
      >
        <span className={selected ? styles.value : styles.placeholder}>{selected?.label ?? placeholder}</span>
        {selected?.meta !== undefined && <span className={styles.meta}>{selected.meta}</span>}
        <CaretIcon />
      </button>
      {name !== undefined && <input type="hidden" name={name} value={current} />}
      {open && !sheet && <div className={styles.menu}>{menu}</div>}
      {open && sheet && (
        <dialog
          ref={dialogRef}
          className={styles.sheet}
          aria-labelledby={triggerId}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          onClick={(e) => {
            if (e.target === dialogRef.current) close();
          }}
        >
          <div className={styles.sheetBody}>{menu}</div>
        </dialog>
      )}
    </div>
  );
}

function firstEnabled(options: readonly DropdownOption[]): number {
  const at = options.findIndex((o) => o.disabled === undefined);
  return at >= 0 ? at : options.length > 0 ? 0 : -1;
}

function groupsOf(options: readonly DropdownOption[]) {
  const groups: { group?: string; items: { option: DropdownOption; index: number }[] }[] = [];
  options.forEach((option, index) => {
    const last = groups.at(-1);
    if (last && last.group === option.group) last.items.push({ option, index });
    else groups.push({ group: option.group, items: [{ option, index }] });
  });
  return groups;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function CaretIcon() {
  return (
    <svg className={styles.caret} viewBox="0 0 12 8" aria-hidden="true">
      <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 10" aria-hidden="true">
      <path d="M1 5.5 4.5 9 11 1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className={styles.searchIcon} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11 14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
