"use client";

import { useId, useOptimistic, useState, useTransition, type CSSProperties } from "react";
import { ClassIcon } from "@/components/ui/ClassIcon";
import { FilterChip } from "@/components/ui/FilterChip";
import { CLASSES } from "@/core/gamedata/classes";
import type { Faction } from "@/core/doomsday/rules";
import { CLASS_ORDER, type TargetCell, type TargetRow, type TargetTab } from "@/core/views/hunt";
import styles from "./HuntTargets.module.css";

type Action = (form: FormData) => Promise<void>;

/** One target: a switch (click: off or back on), its count, weight bar and share; the hover tells the rest. */
function Cell({ cell, action, phone }: { cell: TargetCell; action: Action; phone?: boolean }) {
  const [off, setOff] = useOptimistic(cell.state === "off");
  const [, start] = useTransition();
  const tip = useId();
  const name = cell.tip?.split(" · ")[0] ?? "";
  const state = off ? "off" : cell.state === "off" ? "skip" : cell.state;
  const label = off ? "off" : cell.state === "off" ? "" : cell.label;
  const submit = (form: FormData) =>
    start(async () => {
      setOff(form.get("off") === "true");
      await action(form);
    });
  const color = { "--class-text": `var(${CLASSES[cell.classFile].textToken})` } as CSSProperties;
  return (
    <form action={submit} className={styles.form}>
      <input type="hidden" name="race" value={cell.race} />
      <input type="hidden" name="class" value={cell.class} />
      <input type="hidden" name="off" value={String(!off)} />
      <button
        type="submit"
        role="switch"
        aria-checked={!off}
        aria-label={name}
        aria-describedby={cell.tip === undefined ? undefined : tip}
        className={phone ? styles.line : styles.cell}
        data-state={state}
        data-today={cell.today || undefined}
        data-new={cell.fresh || undefined}
        data-testid="target"
        style={phone ? color : undefined}
      >
        {phone ? (
          <>
            <span className={styles.lineClass}>
              <ClassIcon classFile={cell.classFile} decorative />
              {CLASSES[cell.classFile].name}
            </span>
            <span className={styles.lineCount}>{off ? `${cell.count ?? "—"} · off` : cell.line}</span>
          </>
        ) : (
          <>
            <b>{cell.count ?? "—"}</b>
            {state === "draw" && cell.bar !== undefined && (
              <span className={styles.bar} aria-hidden="true">
                <i style={{ width: `${cell.bar}%` }} />
              </span>
            )}
            {label !== undefined && label !== "" && <span className={styles.label}>{label}</span>}
          </>
        )}
      </button>
      {cell.tip !== undefined && (
        <span id={tip} role="tooltip" className={styles.tip}>
          {cell.tip}
        </span>
      )}
    </form>
  );
}

/**
 * The Hunt targets (board `mission-pool-v2-hunt`): per hunting faction, races × classes with Everloot's census, the
 * weight and the share of the draw. A click switches a target off or back on. On a phone one list per race.
 */
export function HuntTargets({
  tabs,
  grids,
  first,
  setTarget,
}: {
  tabs: TargetTab[];
  grids: Readonly<Record<Faction, TargetRow[]>>;
  first: Faction;
  setTarget: Action;
}) {
  const [hunter, setHunter] = useState<Faction>(first);
  const rows = grids[hunter];
  return (
    <>
      <div className={styles.tabs} role="group" aria-label="Hunt targets">
        {tabs.map((t) => (
          <FilterChip key={t.hunter} pressed={t.hunter === hunter} onClick={() => setHunter(t.hunter)}>
            {t.label}
            {t.hunter === hunter && <b className={styles.chipCount}>{t.inDraw}</b>}
          </FilterChip>
        ))}
      </div>
      <ul className={styles.legend} aria-label="Legend">
        <li>
          <span className={styles.swatch} data-kind="draw" /> in the draw, weighted by count
        </li>
        <li>
          <span className={styles.swatch} data-kind="skip" /> under 30 seen: skipped
        </li>
        <li>— not a valid race/class (game files)</li>
        <li>
          <span className={styles.swatch} data-kind="new" /> Forever race, new to the list
        </li>
        <li>
          <span className={styles.swatch} data-kind="today" /> today
        </li>
      </ul>
      <div className={styles.gridWrap}>
        <table className={styles.grid} data-testid="target-grid">
          <thead>
            <tr>
              <td />
              {CLASS_ORDER.map((c) => (
                <th key={c} scope="col">
                  <ClassIcon classFile={c} decorative />
                  <span className={styles.className}>{CLASSES[c].name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.race}>
                <th scope="row" className={styles.race}>
                  {r.name}
                  {r.fresh && <span className={styles.fresh}>NEW</span>}
                </th>
                {r.cells.map((c) => (
                  <td key={c.classFile}>
                    {c.state === "invalid" ? (
                      <span className={styles.na} aria-label="not a valid race/class">
                        —
                      </span>
                    ) : (
                      <Cell cell={c} action={setTarget} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.lists}>
        {rows.map((r) => (
          <div key={r.race} className={styles.list}>
            <h3 className={styles.listRace}>{r.name}</h3>
            {r.cells
              .filter((c) => c.state !== "invalid")
              .map((c) => (
                <Cell key={c.classFile} cell={c} action={setTarget} phone />
              ))}
          </div>
        ))}
      </div>
    </>
  );
}
