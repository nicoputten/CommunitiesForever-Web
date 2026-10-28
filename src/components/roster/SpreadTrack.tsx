"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./LevelSpread.module.css";

export interface TrackLine {
  name: string;
  level: number;
  /** "you", the owner's name, or undefined when unknown. */
  owner?: string;
  /** The class text colour, a var(). */
  color: string;
}

export interface TrackDot {
  key: string;
  /** "52.54%" */
  position: string;
  /** "Sela Moonbrook 12", "3 characters around level 39" */
  label: string;
  /** Shown in the dot when characters merge. */
  count?: number;
  own: boolean;
  /** The dot's fill: a class colour, or a conic gradient of them. */
  fill: string;
  lines: TrackLine[];
}

/**
 * The dots on the level spread's track (board `roster-cards-runs`, WEB-32): names in a tooltip on hover, keyboard
 * focus or tap. A tap pins it until the next tap, a tap elsewhere or Escape.
 */
export function SpreadTrack({ dots, layout }: { dots: TrackDot[]; layout: "wide" | "phone" }) {
  const [shown, setShown] = useState<string>();
  const [pinned, setPinned] = useState<string>();
  const track = useRef<HTMLDivElement>(null);
  // WEB-45 (finding 14): the shown tooltip's width, and whether it goes below the dot for lack of room above.
  const [fit, setFit] = useState<{ key: string; width: number; below: boolean }>();

  useLayoutEffect(() => {
    if (shown === undefined) return;
    const tip = document.getElementById(`spread-tip-${layout}-${shown}`);
    const panel = track.current?.closest("section") ?? track.current;
    if (tip === null || panel == null) return;
    const room = tip.getBoundingClientRect().top - Math.max(0, panel.getBoundingClientRect().top);
    setFit((f) => {
      const below = f?.key === shown && f.below ? true : room < 0;
      return { key: shown, width: tip.offsetWidth, below };
    });
  }, [shown, layout]);

  useEffect(() => {
    if (shown === undefined) return;
    const close = () => {
      setShown(undefined);
      setPinned(undefined);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !track.current?.contains(e.target)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [shown]);

  return (
    <div ref={track} className={styles.track} data-layout={layout}>
      <span className={styles.line} aria-hidden="true" />
      {dots.map((d) => {
        const tip = `spread-tip-${layout}-${d.key}`;
        return (
          <span key={d.key} className={styles.mark} style={{ "--pos": d.position } as CSSProperties}>
            <button
              type="button"
              className={styles.dot}
              aria-label={d.label}
              aria-describedby={tip}
              aria-expanded={shown === d.key}
              data-own={d.own || undefined}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse" && pinned === undefined) setShown(d.key);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse" && pinned === undefined) setShown(undefined);
              }}
              onFocus={() => {
                if (pinned === undefined) setShown(d.key);
              }}
              onBlur={() => {
                if (pinned === undefined) setShown(undefined);
              }}
              onClick={() => {
                const pin = pinned === d.key ? undefined : d.key;
                setPinned(pin);
                setShown(pin);
              }}
            >
              <span
                className={styles.disc}
                data-group={d.count !== undefined || undefined}
                style={{ "--fill": d.fill } as CSSProperties}
              >
                {d.count !== undefined && <span className={styles.count}>{d.count}</span>}
              </span>
            </button>
            <span
              id={tip}
              role="tooltip"
              className={styles.tip}
              hidden={shown !== d.key}
              data-below={(fit?.key === d.key && fit.below) || undefined}
              style={fit?.key === d.key ? ({ "--tip-width": `${fit.width}px` } as CSSProperties) : undefined}
            >
              {d.lines.map((l, i) => (
                <span key={i} className={styles.tipLine}>
                  <span style={{ color: l.color }}>{l.name}</span> {l.level}
                  {l.owner !== undefined && <span className={styles.owner}> · {l.owner}</span>}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
}
