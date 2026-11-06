"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { dungeonHref, planHref } from "@/core/views/dungeon";
import styles from "./LevelSpread.module.css";

export interface BandView {
  id: string;
  name: string;
  range: string;
  fits: number;
  /** "no healer in range". */
  missing?: string;
  /** Its upcoming runs: "Fri 20:30 · 3 in", each a link. */
  runs: { href: string; label: string }[];
  moreRuns: number;
  best: boolean;
  /** Not within the 4 rows: shown after "Show all". */
  extra: boolean;
  /** Track positions (0–1) of the range's ends, on the same scale as the dots. */
  from: number;
  to: number;
}

/** Where a band's text goes: inside the band, or beside it when the band is too narrow (never cut). */
type Side = "in" | "right" | "left";

/** Before measuring: beside the band, on the side with the most room. */
const outside = (b: BandView): Side => (b.from + b.to > 1 ? "left" : "right");

/** Below this width the bands are a list, and the popover is a bottom sheet (LevelSpread.module.css). */
const PHONE_QUERY = "(max-width: 767px)";

/**
 * The dungeon bands (WEB-45, popover from board `roster-cards-runs`): one dungeon per row under the track, lowest level
 * first, each band from its min to its max level on the track's scale, with the full name, range, count and runs
 * inside, or beside it when the band is too narrow, never cut (WEB-88, Nico 2026-11-06; before: chips side by side,
 * WEB-65). On a phone a list. The bands past the 4 rows of `bandLayout` after "Show all N". A click opens the popover
 * (who fits, missing roles, planned runs, Plan a run, View run, Dungeon page), on a phone as a bottom sheet.
 */
export function DungeonBands({ bands }: { bands: BandView[] }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string>();
  const [asSheet, setAsSheet] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const extra = bands.filter((b) => b.extra).length;
  const shown = all ? bands : bands.filter((b) => !b.extra);
  const band = bands.find((b) => b.id === open);
  const [sides, setSides] = useState<Record<string, Side>>({});

  // The text goes inside a band where it fits, else beside it where there is room (WEB-88). Measured again on resize.
  useLayoutEffect(() => {
    const ul = list.current;
    if (ul === null) return;
    const measure = () => {
      if (window.matchMedia(PHONE_QUERY).matches) return; // The phone list has the text inside.
      const width = ul.clientWidth;
      const next: Record<string, Side> = {};
      for (const li of ul.querySelectorAll<HTMLElement>("li[data-row]")) {
        const label = li.querySelector<HTMLElement>("[data-label]");
        const bar = li.querySelector<HTMLElement>("[data-bar]");
        if (label === null || bar === null) continue;
        const style = getComputedStyle(bar);
        const room = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        // Beside the band: the text and the gap to it.
        const text = label.getBoundingClientRect().width;
        const beside = text + parseFloat(getComputedStyle(bar.parentElement!).columnGap || "0");
        const right = width * (1 - Number(li.dataset.to));
        const left = width * Number(li.dataset.from);
        next[li.dataset.row!] = text <= room ? "in" : right >= beside || right >= left ? "right" : "left";
      }
      setSides((prev) =>
        Object.keys(next).length === Object.keys(prev).length && Object.entries(next).every(([k, v]) => prev[k] === v)
          ? prev
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(ul);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [shown.length]);

  useEffect(() => {
    if (open === undefined) {
      if (sheet.current?.open) sheet.current.close();
      return;
    }
    if (asSheet && sheet.current && !sheet.current.open) sheet.current.showModal();
    const close = (focus: boolean) => {
      setOpen(undefined);
      if (focus) list.current?.querySelector<HTMLButtonElement>(`button[data-band="${open}"]`)?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node) || list.current?.contains(t) || sheet.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, asSheet]);

  const popover = (b: BandView) => (
    <>
      <div className={styles.popHead}>
        <span className={styles.popName}>{b.name}</span>
        <span className={styles.popRange}>{b.range}</span>
      </div>
      <p className={styles.popFits}>
        {b.fits} characters fit{b.missing === undefined ? "" : ` · ${b.missing}`}
      </p>
      {b.runs.length === 1 && <p className={styles.popRuns}>1 run planned · {b.runs[0]!.label}</p>}
      {b.runs.length > 1 && (
        <ul className={styles.popRunList} aria-label="Planned runs">
          {b.runs.map((r) => (
            <li key={r.href}>
              <Link href={r.href}>{r.label}</Link>
            </li>
          ))}
          {b.moreRuns > 0 && (
            <li>
              <Link href="/runs?show=all">and {b.moreRuns} more</Link>
            </li>
          )}
        </ul>
      )}
      <div className={styles.popButtons}>
        <Link href={planHref(b.id)} className={styles.popPrimary}>
          Plan a run
        </Link>
        {b.runs.length === 1 && (
          <Link href={b.runs[0]!.href} className={styles.popSecondary}>
            View run
          </Link>
        )}
        <Link href={dungeonHref(b.id)} className={styles.popSecondary}>
          Dungeon page
        </Link>
      </div>
    </>
  );

  const runCount = (b: BandView) => b.runs.length + b.moreRuns;
  const runsText = (b: BandView) => (runCount(b) === 0 ? "" : ` · ${runCount(b)} run${runCount(b) === 1 ? "" : "s"}`);
  const count = (b: BandView) => `· ${b.fits}${runsText(b)}`;
  // "Scarlet Monastery: Graveyard 26–36 · 6 · 1 run".
  const label = (b: BandView) => `${b.name} ${b.range} ${count(b)}`;

  return (
    <>
      <ul ref={list} className={styles.bands} aria-label="Dungeon bands">
        {shown.map((b) => {
          const side = sides[b.id] ?? outside(b);
          const text = (
            <span className={styles.bandLabel} data-label>
              {b.name} <span className={styles.bandRange}>{b.range}</span> {count(b)}
            </span>
          );
          return (
            <li
              key={b.id}
              className={styles.bandItem}
              data-row={b.id}
              data-from={b.from}
              data-to={b.to}
              data-side={side}
              data-right={b.from + b.to > 1 || undefined}
              style={{ "--from": b.from, "--to": b.to } as CSSProperties}
            >
              <button
                type="button"
                className={styles.band}
                data-band={b.id}
                data-best={b.best || undefined}
                aria-label={label(b)}
                aria-expanded={open === b.id}
                aria-controls={open === b.id && !asSheet ? `band-pop-${b.id}` : undefined}
                onClick={() => {
                  setAsSheet(window.matchMedia(PHONE_QUERY).matches);
                  setOpen(open === b.id ? undefined : b.id);
                }}
              >
                <span className={styles.bar} data-bar>
                  {side === "in" && text}
                </span>
                {side !== "in" && text}
              </button>
              {open === b.id && !asSheet && (
                <div id={`band-pop-${b.id}`} role="dialog" aria-label={b.name} className={styles.pop}>
                  {popover(b)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {extra > 0 && (
        <div className={styles.bandsFoot}>
          <span className={styles.hint}>
            {all ? `All ${bands.length} shown` : `${bands.length - extra} of ${bands.length} shown`}
          </span>
          <button type="button" className={styles.showAll} onClick={() => setAll(!all)} aria-expanded={all}>
            {all ? "Show fewer" : `Show all ${bands.length}`}
          </button>
        </div>
      )}
      <dialog
        ref={sheet}
        className={styles.sheet}
        aria-label={band?.name ?? "Dungeon"}
        onClose={() => setOpen(undefined)}
        onClick={(e) => {
          if (e.target === sheet.current) setOpen(undefined);
        }}
      >
        {band !== undefined && asSheet && <div className={styles.sheetBody}>{popover(band)}</div>}
      </dialog>
    </>
  );
}
