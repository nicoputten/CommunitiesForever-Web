"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./InfoTip.module.css";

/**
 * The ⓘ next to a heading (WEB-65, board live-test-site-fixes): an explanation that helps a player, out of the page's
 * way. Opens on hover, focus or tap; Esc, a tap outside or blur closes it. On a phone the panel opens below the icon
 * and is kept inside the screen. The one tooltip of the site.
 */
export function InfoTip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  // Opened by a tap or a click: stays until closed, not with the pointer leaving.
  const pinned = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current?.contains(e.target as Node)) return;
      pinned.current = false;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      pinned.current = false;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Keep the panel inside the screen: centred under the icon, else lined up with the icon's left or right edge.
  const [align, setAlign] = useState<"center" | "start" | "end">("center");
  useLayoutEffect(() => {
    const el = panel.current;
    const anchor = root.current;
    if (!open || el === null || anchor === null) return;
    const margin = 8;
    // The document's width: on a phone `innerWidth` grows with whatever sticks out.
    const screen = document.documentElement.clientWidth;
    const width = el.offsetWidth;
    const icon = anchor.getBoundingClientRect();
    const centre = icon.left + icon.width / 2;
    setAlign(centre + width / 2 > screen - margin ? "end" : centre - width / 2 < margin ? "start" : "center");
  }, [open]);

  return (
    <span
      ref={root}
      className={styles.root}
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && !pinned.current && setOpen(false)}
    >
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-label="More info"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => {
          pinned.current = !pinned.current || !open;
          setOpen(pinned.current);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          pinned.current = false;
          setOpen(false);
        }}
      >
        <span aria-hidden="true" className={styles.icon}>
          i
        </span>
      </button>
      <span ref={panel} id={id} role="tooltip" className={styles.panel} data-align={align} hidden={!open}>
        {children}
      </span>
    </span>
  );
}
