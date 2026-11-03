"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { EditorSlot } from "@/core/views/missionPool";
import styles from "./MissionPool.module.css";

/**
 * "Pick…" on a slot (board `mission-pool-steering`): the missions of that kind that are on, "also Wed 5" for one already
 * planned on another day. Each is a form that pins it. Esc or a click outside closes the list.
 */
export function PickButton({
  slot,
  hidden,
  action,
}: {
  slot: EditorSlot;
  /** period and n of the day or week. */
  hidden: Record<string, string>;
  action: (form: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
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

  return (
    <div ref={root} className={styles.contents}>
      <button
        ref={button}
        type="button"
        className={styles.small}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        Pick…<span className="visually-hidden"> {slot.name}</span>
      </button>
      <div id={id} className={styles.pickList} hidden={!open}>
        <div className={styles.pickLabel}>Pick for {slot.name}</div>
        <ul>
          {slot.options.map((o) => (
            <li key={o.id}>
              <form action={action} onSubmit={() => setOpen(false)}>
                {Object.entries(hidden).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
                <input type="hidden" name="slot" value={slot.slot} />
                <input type="hidden" name="id" value={o.id} />
                <button type="submit" className={styles.option}>
                  {o.text}
                  {o.also !== undefined && <span className={styles.also}>{o.also}</span>}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
