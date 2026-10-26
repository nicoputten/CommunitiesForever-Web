"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FilterChip } from "@/components/ui/FilterChip";
import styles from "./FilterMenu.module.css";

export interface FilterMenuItem {
  key: string;
  label: string;
  checked: boolean;
}

export interface FilterMenuProps {
  /** The chip's text ("Class", "Mage", "Class · 2"). */
  label: ReactNode;
  /** Names the menu for screen readers ("Class"). */
  name: string;
  /** checkbox: several at once, the menu stays open; radio: one, picking closes the menu. */
  kind: "checkbox" | "radio";
  items: readonly FilterMenuItem[];
  /** A choice is made: the chip gets its gold border. */
  active: boolean;
  onSelect: (key: string) => void;
}

/**
 * A filter chip that opens an ARIA menu of checkbox or radio items (WEB-21, decided with Nico): arrow keys, Home and
 * End move, Enter or Space picks, Escape or Tab closes, a click outside closes.
 */
export function FilterMenu({ label, name, kind, items, active, onSelect }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [shift, setShift] = useState(false);

  const itemsEls = () => Array.from(menu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? []);

  useEffect(() => {
    if (!open) return;
    // Open towards the left when the menu would leave the viewport (chips near the right edge, phones).
    const rect = menu.current?.getBoundingClientRect();
    setShift(rect !== undefined && rect.right > document.documentElement.clientWidth);
    const els = itemsEls();
    (els.find((el) => el.getAttribute("aria-checked") === "true") ?? els[0])?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = (focusChip: boolean) => {
    setOpen(false);
    setShift(false);
    if (focusChip) root.current?.querySelector<HTMLButtonElement>("[aria-haspopup]")?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = itemsEls();
    const at = els.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => {
      e.preventDefault();
      els[(i + els.length) % els.length]?.focus();
    };
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(els.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") close(false);
  };

  const pick = (key: string) => {
    onSelect(key);
    if (kind === "radio") close(true);
  };

  return (
    <div ref={root} className={styles.root}>
      <FilterChip
        menu
        expanded={open}
        active={active}
        aria-controls={menuId}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {label}
      </FilterChip>
      <div
        ref={menu}
        id={menuId}
        role="menu"
        aria-label={name}
        className={styles.menu}
        data-shift={shift || undefined}
        hidden={!open}
        onKeyDown={onKey}
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role={kind === "checkbox" ? "menuitemcheckbox" : "menuitemradio"}
            aria-checked={item.checked}
            tabIndex={-1}
            className={styles.item}
            onClick={() => pick(item.key)}
          >
            <span aria-hidden="true" className={styles.mark} data-kind={kind} />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
