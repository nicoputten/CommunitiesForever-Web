"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { MoveOption } from "@/core/views/runs";
import styles from "./SlotMenu.module.css";

// The organiser's (and the admin's) ⋯ menu on a filled slot (WEB-49, board `runs-v2-run-detail`), in WEB-48's menu
// look: another role (open, or a swap), reserve, off the run; on the organiser's own slot bench yourself and leave the
// group. No confirm step: everything can be undone from the same menu. A status line says what happened.

const STATUS_EVENT = "run-status";

export function SlotMenu({
  runId,
  guid,
  character,
  yours,
  options,
}: {
  runId: number;
  guid: string;
  character: string;
  yours: boolean;
  options: MoveOption[];
}) {
  const router = useRouter();
  const own = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    items.current.find((b) => b && b.getAttribute("aria-disabled") !== "true")?.focus();
    const outside = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const choose = async (o: MoveOption) => {
    if (o.disabled || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/runs/${runId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: guid,
          to: o.to,
          ...(o.swapWith === undefined ? {} : { swapWith: o.swapWith }),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      announce(res.ok ? statusText(o, character, yours) : (body.error ?? "That didn't go through. Try again."));
      if (res.ok) router.refresh();
    } catch {
      announce("No connection. Try again.");
    } finally {
      setBusy(false);
      close();
    }
  };

  const onKey = (e: KeyboardEvent) => {
    const enabled = items.current.filter((b): b is HTMLButtonElement => b !== null);
    const at = enabled.indexOf(document.activeElement as HTMLButtonElement);
    const to: Record<string, number> = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: enabled.length - 1 };
    if (e.key in to) {
      e.preventDefault();
      enabled[(to[e.key]! + enabled.length) % enabled.length]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      close();
    }
  };

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={yours ? "Change your place" : `Move ${character}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${own}-menu` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          id={`${own}-menu`}
          role="menu"
          aria-label={yours ? "Your place" : `Move ${character} to`}
          className={styles.menu}
          onKeyDown={onKey}
        >
          <p className={styles.head} aria-hidden="true">
            {yours ? "Your place" : `Move ${character} to`}
          </p>
          {options.map((o, i) => (
            <button
              key={`${o.to}-${o.swapWith ?? ""}`}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={o.disabled || undefined}
              data-danger={o.danger || undefined}
              className={styles.item}
              onClick={() => void choose(o)}
            >
              <span>{o.label}</span>
              {o.detail !== undefined && <span className={styles.detail}>{o.detail}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function statusText(o: MoveOption, character: string, yours: boolean): string {
  const notice = yours ? "" : " · they get a quiet notice in Discord";
  if (o.to === "remove")
    return yours ? "You left the group; you're still the organiser." : `${character} removed from the run${notice}`;
  if (o.to === "reserve")
    return yours ? "You're on the bench; you're still the organiser." : `${character} moved to reserve${notice}`;
  if (o.swapWith !== undefined) return `${yours ? "You" : character} swapped places: now ${o.detail ?? o.to}${notice}`;
  return `${yours ? "You moved" : `${character} moved`} to ${o.label.replace(/^Move to /, "")}${notice}`;
}

function announce(text: string) {
  window.dispatchEvent(new CustomEvent<string>(STATUS_EVENT, { detail: text }));
}

/** The run page's status line for moves (a polite live region); it outlives the refresh that follows a move. */
export function MoveStatus() {
  const [text, setText] = useState("");
  useEffect(() => {
    const on = (e: Event) => setText((e as CustomEvent<string>).detail);
    window.addEventListener(STATUS_EVENT, on);
    return () => window.removeEventListener(STATUS_EVENT, on);
  }, []);
  return (
    <p role="status" className={styles.status}>
      {text}
    </p>
  );
}
