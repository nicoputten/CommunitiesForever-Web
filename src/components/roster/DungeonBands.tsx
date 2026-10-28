"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./LevelSpread.module.css";

export interface BandView {
  id: string;
  name: string;
  /** "SM Graveyard"; the name itself when the dungeon has no short one. */
  shortName: string;
  range: string;
  fits: number;
  /** "no healer in range". */
  missing?: string;
  /** Its upcoming runs: "Fri 20:30 · 3 in", each a link. */
  runs: { href: string; label: string }[];
  moreRuns: number;
  best: boolean;
  /** Track positions ("12.3%") and rows: within the 4 rows, and with all bands shown. */
  from: string;
  to: string;
  row: number;
  rowAll: number;
  /** Not within the 4 rows: shown after "Show all". */
  extra: boolean;
  /** By level, the best band first: the phone list's order. */
  order: number;
  /** In the track's right half: the popover opens towards the left. */
  right: boolean;
}

/** Below this width the bands are a list, and the popover is a bottom sheet (LevelSpread.module.css). */
const PHONE_QUERY = "(max-width: 767px)";
const LABELS = ["full", "short", "count"] as const;

/**
 * The dungeon bands (WEB-45, board `runs-v2-plan` "Roster bands v2", popover from `roster-cards-runs`): at most 4 rows
 * with "Show all N"; each label the full name where it fits, else the short name, else only the range and count, never
 * cut mid-word; a click opens the popover (who fits, missing roles, planned runs, Plan a run, View run, Dungeon page),
 * on a phone as a bottom sheet.
 */
export function DungeonBands({
  bands,
  rows,
  rowsAll,
  dungeonPages,
}: {
  bands: BandView[];
  rows: number;
  rowsAll: number;
  /** WEB-42's dungeon pages exist: the popover links to them. */
  dungeonPages: boolean;
}) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string>();
  const [asSheet, setAsSheet] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const extra = bands.filter((b) => b.extra).length;
  const shown = all ? bands : bands.filter((b) => !b.extra);
  const band = bands.find((b) => b.id === open);

  // The label that fits each band, measured in the browser: full, short, or the range and count only.
  useLayoutEffect(() => {
    const ul = list.current;
    if (ul === null) return;
    const fit = () => {
      for (const button of ul.querySelectorAll<HTMLButtonElement>("button[data-band]")) {
        for (const label of LABELS) {
          button.dataset.fit = label;
          if (button.scrollWidth <= button.clientWidth) break;
        }
        // The visible label first, then the full name: screen readers hear what is seen (WCAG 2.5.3).
        const { name = "", short = name, rest = "" } = button.dataset;
        const fit = button.dataset.fit;
        button.setAttribute(
          "aria-label",
          fit === "full" ? `${name} ${rest}` : `${fit === "short" ? `${short} ` : ""}${rest}, ${name}`,
        );
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(ul);
    return () => observer.disconnect();
  }, [all]);

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
        <Link href={`/runs/new?dungeon=${b.id}`} className={styles.popPrimary}>
          Plan a run
        </Link>
        {b.runs.length === 1 && (
          <Link href={b.runs[0]!.href} className={styles.popSecondary}>
            View run
          </Link>
        )}
        {dungeonPages && (
          <Link href={`/dungeons/${b.id}`} className={styles.popSecondary}>
            Dungeon page
          </Link>
        )}
      </div>
    </>
  );

  const runCount = (b: BandView) => b.runs.length + b.moreRuns;
  const runsText = (b: BandView) => (runCount(b) === 0 ? "" : ` · ${runCount(b)} run${runCount(b) === 1 ? "" : "s"}`);
  const rest = (b: BandView) => `${b.range} · ${b.fits}${runsText(b)}`;
  // Before the label is measured: the full name ("Scarlet Monastery: Graveyard 26–36 · 6 · 1 run").
  const label = (b: BandView) => `${b.name} ${rest(b)}`;

  return (
    <>
      <ul
        ref={list}
        className={styles.bands}
        aria-label="Dungeon bands"
        style={{ "--band-rows": all ? rowsAll : rows } as CSSProperties}
      >
        {shown.map((b) => (
          <li
            key={b.id}
            className={styles.bandItem}
            data-right={b.right || undefined}
            style={
              {
                "--from": b.from,
                "--to": b.to,
                "--row": all ? b.rowAll : b.row,
                "--order": b.order,
              } as CSSProperties
            }
          >
            <button
              type="button"
              className={styles.band}
              data-band={b.id}
              data-best={b.best || undefined}
              title={`${b.name} ${b.range}`}
              aria-label={label(b)}
              data-name={b.name}
              data-short={b.shortName}
              data-rest={rest(b)}
              aria-expanded={open === b.id}
              aria-controls={open === b.id && !asSheet ? `band-pop-${b.id}` : undefined}
              onClick={() => {
                setAsSheet(window.matchMedia(PHONE_QUERY).matches);
                setOpen(open === b.id ? undefined : b.id);
              }}
            >
              <span className={styles.bandFull}>{b.name} </span>
              {b.shortName !== b.name && <span className={styles.bandShort}>{b.shortName} </span>}
              <span>
                {b.range} · {b.fits}
                {runsText(b)}
              </span>
            </button>
            {open === b.id && !asSheet && (
              <div id={`band-pop-${b.id}`} role="dialog" aria-label={b.name} className={styles.pop}>
                {popover(b)}
              </div>
            )}
          </li>
        ))}
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
