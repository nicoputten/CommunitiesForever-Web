"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { dungeonHref, planHref } from "@/core/views/dungeon";
import styles from "./LevelSpread.module.css";

export interface BandView {
  id: string;
  name: string;
  /** "SM Graveyard": when the full name doesn't fit its band. */
  short: string;
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

/**
 * What a band shows, the name first (Nico, 2026-11-06): the full text, else the name alone (range, count and runs on
 * hover), else the short name; whatever is shown is cut with "…" when it still doesn't fit.
 */
type Fit = "full" | "name" | "short";

const runCount = (b: BandView) => b.runs.length + b.moreRuns;
const runsText = (b: BandView) => (runCount(b) === 0 ? "" : ` · ${runCount(b)} run${runCount(b) === 1 ? "" : "s"}`);
const count = (b: BandView) => `· ${b.fits}${runsText(b)}`;
/** Everything a band says: "Scarlet Monastery: Graveyard 26–36 · 6 · 1 run". */
const text = (b: BandView) => `${b.name} ${b.range} ${count(b)}`;
const padding = (el: HTMLElement) => {
  const style = getComputedStyle(el);
  return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
};

/** Below this width the bands are a list, and the popover is a bottom sheet (LevelSpread.module.css). */
const PHONE_QUERY = "(max-width: 767px)";

/**
 * The dungeon bands (WEB-45, popover from board `roster-cards-runs`): one dungeon per row under the track, lowest level
 * first, each band exactly from its min to its max level on the track's scale, with the name, range, count and runs
 * inside; a band too narrow for that shows the name alone (`Fit`), the full text on hover (WEB-88, Nico 2026-11-06;
 * before: chips side by side, WEB-65). On a phone a list, never cut. The bands past the 4 rows of `bandLayout` after "Show all N". A click opens the popover
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
  const [fits, setFits] = useState<Readonly<Record<string, Fit>>>({});

  // How much text each band has room for (WEB-88), measured with a hidden copy of its label in place; again on resize.
  useLayoutEffect(() => {
    const ul = list.current;
    if (ul === null) return;
    const measure = () => {
      const next: Record<string, Fit> = {};
      // The phone list has room for everything (and its bands have no box of their own to measure).
      if (!window.matchMedia(PHONE_QUERY).matches)
        for (const li of ul.querySelectorAll<HTMLElement>("li[data-row]")) {
          const b = shown.find((x) => x.id === li.dataset.row);
          const label = li.querySelector<HTMLElement>("[data-label]");
          if (b === undefined || label === null) continue;
          const room = label.parentElement!.clientWidth - padding(label.parentElement!);
          const probe = label.cloneNode() as HTMLElement;
          probe.classList.add(styles.probe!);
          label.parentElement!.append(probe);
          const width = (s: string) => {
            probe.textContent = s;
            return probe.getBoundingClientRect().width;
          };
          next[b.id] = width(text(b)) <= room ? "full" : width(b.name) <= room || b.short === b.name ? "name" : "short";
          probe.remove();
        }
      setFits((prev) =>
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
  }, [shown]);

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

  // "Scarlet Monastery: Graveyard 26–36 · 6 · 1 run".

  return (
    <>
      <ul ref={list} className={styles.bands} aria-label="Dungeon bands">
        {shown.map((b) => {
          return (
            <li
              key={b.id}
              className={styles.bandItem}
              data-row={b.id}
              data-right={b.from + b.to > 1 || undefined}
              style={{ "--from": b.from, "--to": b.to } as CSSProperties}
            >
              <button
                type="button"
                className={styles.band}
                data-band={b.id}
                data-best={b.best || undefined}
                aria-label={text(b)}
                title={(fits[b.id] ?? "full") === "full" ? undefined : text(b)}
                aria-expanded={open === b.id}
                aria-controls={open === b.id && !asSheet ? `band-pop-${b.id}` : undefined}
                onClick={() => {
                  setAsSheet(window.matchMedia(PHONE_QUERY).matches);
                  setOpen(open === b.id ? undefined : b.id);
                }}
              >
                <span className={styles.bar} data-bar>
                  <span className={styles.bandLabel} data-label data-fit={fits[b.id] ?? "full"}>
                    {(fits[b.id] ?? "full") === "full" ? (
                      <>
                        {b.name} <span className={styles.bandRange}>{b.range}</span> {count(b)}
                      </>
                    ) : fits[b.id] === "name" ? (
                      b.name
                    ) : (
                      b.short
                    )}
                  </span>
                </span>
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
