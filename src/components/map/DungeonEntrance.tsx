"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import type { MapDungeon } from "@/core/views/dungeon";
import { DungeonIcon } from "@/components/ui/icons";
import sheetStyles from "./CharacterSheet.module.css";
import styles from "./DungeonEntrance.module.css";

const planned = (n: number) => `${n} planned`;
/** Room the popover keeps from the map frame's edges and the top bar over it (px). */
const EDGE = 8;

/**
 * A dungeon entrance on the map (WEB-42): its name at zone zoom, a badge with the planned runs (with runs planned, the
 * entrance shows from any zoom past the whole world: a continent or closer). A dungeon's entrance is a button that opens its popover (Plan a run, Dungeon page); a
 * raid's is only drawn. Below 1024 px the popover opens in the bottom sheet instead (`inSheet`).
 */
export function DungeonEntrance({
  dungeon: d,
  at,
  open,
  inSheet,
  onToggle,
}: {
  dungeon: MapDungeon;
  at: CSSProperties;
  open: boolean;
  inSheet: boolean;
  onToggle: (name: string | undefined) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  /** Opened from the keyboard (Enter or Space): focus moves into the popover; a click leaves it on the entrance. */
  const byKeyboard = useRef(false);
  // Away from the map frame's edges it is near, as the hover card (MapStage placeCard): the map may be zoomed and
  // panned, so measured.
  useLayoutEffect(() => {
    const a = anchor.current;
    const frame = a?.closest<HTMLElement>("[data-map-frame]");
    if (!open || a == null || frame == null) return;
    const at = a.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    const fx = (at.left - f.left) / f.width;
    const fy = (at.top - f.top) / f.height;
    a.dataset.side = fx > 0.62 ? "left" : "right";
    a.dataset.v = fy > 0.7 ? "up" : fy < 0.25 ? "down" : "mid";
    // Then whatever still sticks out (under the top bar, which lies over the map) is moved back in.
    const pop = a.firstElementChild;
    if (pop === null) return;
    a.style.setProperty("--pop-shift", "0px");
    const r = pop.getBoundingClientRect();
    const bar = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    const top = Math.max(f.top, bar) + EDGE;
    const bottom = Math.min(f.bottom, window.innerHeight) - EDGE;
    const shift = r.top < top ? top - r.top : r.bottom > bottom ? Math.max(bottom - r.bottom, top - r.top) : 0;
    a.style.setProperty("--pop-shift", `${shift}px`);
  }, [open]);
  const icon = (
    <span className={styles.icon}>
      <DungeonIcon className={styles.svg} />
      {d.planned > 0 && <span className={styles.count}>{d.planned}</span>}
    </span>
  );
  if (d.kind === "raid") {
    return (
      <span className={styles.entrance} style={at} aria-hidden="true">
        <span className={styles.mark}>
          {icon}
          <span className={styles.name}>{d.name}</span>
        </span>
      </span>
    );
  }
  const close = () => {
    onToggle(undefined);
    button.current?.focus();
  };
  return (
    <span
      className={styles.entrance}
      style={at}
      data-planned={d.planned > 0 || undefined}
      data-open={open || undefined}
      data-map-item=""
    >
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-label={d.planned > 0 ? `${d.name}, ${planned(d.planned)}` : d.name}
        onClick={(e) => {
          byKeyboard.current = e.detail === 0;
          onToggle(open ? undefined : d.name);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            onToggle(undefined);
          }
        }}
      >
        {icon}
      </button>
      <span className={`${styles.label} ${styles.name}`} aria-hidden="true">
        {d.name}
      </span>
      {open && !inSheet && (
        <span ref={anchor} className={styles.anchor}>
          <DungeonPopover dungeon={d} onClose={close} focusFirst={byKeyboard.current} />
        </span>
      )}
    </span>
  );
}

/** The popover of a dungeon entrance: name, typical levels, planned runs, the wings, Plan a run and Dungeon page. */
export function DungeonPopover({
  dungeon: d,
  onClose,
  variant = "popover",
  focusFirst = false,
}: {
  dungeon: MapDungeon;
  onClose: () => void;
  variant?: "popover" | "sheet";
  /** Moves focus to the first link (opened from the keyboard). */
  focusFirst?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focusFirst) root.current?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
  }, [focusFirst]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    onClose();
  };
  const wings = d.pages.length > 1;
  const id = `dungeon-${d.name.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section
      ref={root}
      className={variant === "sheet" ? `${sheetStyles.sheet} ${styles.sheet}` : styles.popover}
      aria-labelledby={id}
      onKeyDown={onKeyDown}
      data-testid="dungeon-popover"
    >
      <div className={styles.head}>
        <div className={styles.titles}>
          <h2 id={id} className={styles.title}>
            {d.name}
          </h2>
          <p className={styles.sub}>
            Levels {d.levels} (typical){d.planned > 0 && ` · ${planned(d.planned)}`}
          </p>
        </div>
        {variant === "sheet" && (
          <button type="button" className={sheetStyles.close} aria-label="Close" onClick={onClose}>
            <svg aria-hidden="true" viewBox="0 0 14 14" className={sheetStyles.cross}>
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        )}
      </div>
      {wings && (
        <ul className={styles.wings}>
          {d.pages.map((p) => (
            <li key={p.href}>
              <Link href={p.href} className={styles.wing}>
                {p.label}
                {p.planned > 0 && <span className={styles.wingCount}>{planned(p.planned)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <Link href={d.planHref} className={styles.primary}>
          Plan a run
        </Link>
        {!wings && d.pages[0] !== undefined && (
          <Link href={d.pages[0].href} className={styles.secondary}>
            Dungeon page
          </Link>
        )}
      </div>
    </section>
  );
}
