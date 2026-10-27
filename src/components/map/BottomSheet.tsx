"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { motionOn } from "@/components/atmosphere/motion";
import styles from "./BottomSheet.module.css";

export type Snap = "peek" | "half" | "full";

const SNAPS: readonly Snap[] = ["peek", "half", "full"];

/** Pixels the pointer moves before a press on the sheet becomes a drag (below that it is a tap). */
const DRAG_SLOP = 6;
/** A flick this fast (px/ms) goes on to the next snap point in its direction. */
const FLICK = 0.5;

/** A size or duration token in px or ms (tokens.css), read from the page. */
function tokenPx(name: string): number {
  const n = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(n) ? n : 0;
}

/**
 * How much of the screen the sheet covers at each snap point, from the bottom of the viewport, in px: the boards'
 * peek and half above the tab bar (phone-map, phone-character), full up to 96 px from the top (phone-roll-call).
 */
export function sheetHeights(): Record<Snap, number> & { tab: number } {
  const tab = document.querySelector("[data-tabbar]")?.getBoundingClientRect().height ?? 0;
  return {
    tab,
    peek: tokenPx("--size-sheet-peek") + tab,
    half: tokenPx("--size-sheet-half") + tab,
    full: window.innerHeight - tokenPx("--size-sheet-top"),
  };
}

export interface BottomSheetProps {
  snap: Snap;
  /** Dragged or tapped to another snap point. */
  onSnap: (snap: Snap) => void;
  /** The roll call shows a handle button (open and collapse); the character sheet a plain bar. */
  handle?: { open: string; collapse: string };
  children: ReactNode;
}

/**
 * The phone map's bottom sheet (WEB-28, DESIGN.md §5 and §6): peek → half → full, 280 ms ease-out and following the
 * finger while dragged; without motion it jumps and fades in (120 ms). Not a dialog: the map stays usable next to it.
 * At full the strip of map above it dims and a tap there collapses it. Below 1024 px only (the panel takes over).
 *
 * Not `vaul` (ARCHITECTURE.md): its Drawer always opens Radix's modal Dialog, which hides the rest of the page from
 * screen readers, traps focus and blocks the map's pointer events, also with `modal={false}`.
 */
export function BottomSheet({ snap, onSnap, handle, children }: BottomSheetProps) {
  const [heights, setHeights] = useState<ReturnType<typeof sheetHeights>>();
  const [drag, setDrag] = useState<number>();
  const root = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);

  useEffect(() => {
    const measure = () => setHeights(sheetHeights());
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Without motion the sheet jumps to its snap point and fades in (DESIGN.md §6: 120 ms fade).
  const shown = useRef(snap);
  useEffect(() => {
    if (shown.current === snap) return;
    shown.current = snap;
    if (motionOn()) return;
    root.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: tokenPx("--dur-sheet-fade") });
  }, [snap]);

  // A press on the sheet becomes a drag once it moves; it follows the pointer anywhere on the page until released.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const h = heights;
    if (h === undefined || e.button !== 0) return;
    // A scrolled list scrolls; a drag from its top moves the sheet.
    const list = (e.target as Element).closest("[data-sheet-scroll]");
    if (list !== null && list.scrollTop > 0) return;
    const from = snap;
    const y0 = e.clientY;
    const t0 = e.timeStamp;
    let at: number | undefined;

    const move = (m: globalThis.PointerEvent) => {
      if (m.pointerId !== e.pointerId) return;
      const dy = m.clientY - y0;
      if (at === undefined && Math.abs(dy) < DRAG_SLOP) return;
      at = Math.min(Math.max(h[from] - dy, h.peek), h.full);
      setDrag(at);
    };
    const end = (u: globalThis.PointerEvent) => {
      if (u.pointerId !== e.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (at === undefined) return;
      const drag = at;
      dragged.current = true;
      setDrag(undefined);
      if (u.type === "pointercancel") return;
      const velocity = (y0 - u.clientY) / Math.max(u.timeStamp - t0, 1);
      // A flick goes on to the next snap point past the finger in its direction; else the nearest one.
      const to =
        velocity > FLICK
          ? (SNAPS.find((s) => h[s] > drag) ?? "full")
          : velocity < -FLICK
            ? ([...SNAPS].reverse().find((s) => h[s] < drag) ?? "peek")
            : SNAPS.reduce((best, s) => (Math.abs(h[s] - drag) < Math.abs(h[best] - drag) ? s : best));
      if (to !== from) onSnap(to);
      // The click that ends a drag is dropped (below); a drag that ends off the sheet has none.
      setTimeout(() => {
        dragged.current = false;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const height = drag ?? heights?.[snap];
  const style =
    height === undefined || heights === undefined
      ? undefined
      : ({
          "--sheet-y": `${window.innerHeight - height}px`,
          "--sheet-visible": `${heights[snap] - heights.tab}px`,
        } as CSSProperties);

  return (
    <>
      {snap === "full" && (
        <button type="button" className={styles.dim} aria-label="Collapse roll call" onClick={() => onSnap("peek")} />
      )}
      <div
        ref={root}
        className={styles.sheet}
        data-snap={snap}
        data-ready={heights !== undefined || undefined}
        data-dragging={drag !== undefined || undefined}
        style={style}
        onPointerDown={onPointerDown}
        // A drag ends without the tap on whatever it started on.
        onClickCapture={(e) => {
          if (!dragged.current) return;
          dragged.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className={styles.inner}>
          {handle === undefined ? (
            <span aria-hidden="true" className={styles.bar} />
          ) : (
            <button
              type="button"
              className={styles.handle}
              aria-label={snap === "peek" ? handle.open : handle.collapse}
              onClick={() => onSnap(snap === "peek" ? "full" : "peek")}
            >
              <span aria-hidden="true" className={styles.bar} />
            </button>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
