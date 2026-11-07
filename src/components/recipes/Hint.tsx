"use client";

import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
} from "@floating-ui/react";
import { useState, type ReactNode } from "react";
import styles from "./bits.module.css";

/**
 * A short hover hint on a recipe screen (WEB-92, board recipes-page "Tooltips & menus": the skill numbers, a coloured
 * dot): opens on hover after 150 ms, flips at the screen's edges (Floating UI). Not a control: its text is in the page
 * for screen readers (visually hidden), and the visible children are hidden from them.
 */
export function Hint({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const {
    refs: { setReference, setFloating },
    floatingStyles,
    context,
  } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "top",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { delay: { open: 150, close: 0 }, move: false }),
    useDismiss(context),
  ]);
  return (
    <>
      <span ref={setReference} className={styles.hintTrigger} {...getReferenceProps()}>
        <span aria-hidden="true">{children}</span>
        <span className="visually-hidden">{text}</span>
      </span>
      {open && (
        <FloatingPortal>
          <span
            ref={setFloating}
            className={styles.hint}
            style={floatingStyles}
            aria-hidden="true"
            {...getFloatingProps()}
          >
            {text}
          </span>
        </FloatingPortal>
      )}
    </>
  );
}
