"use client";

import { useRef, type ReactNode } from "react";
import { CLASSES, type ClassFile } from "@/core/gamedata/classes";
import type { Role } from "@/core/views/characters";
import { defaultSortDir, type SortDir } from "@/core/views/roster";
import {
  LEVEL_RANGES,
  ROLE_NAMES,
  ROLES,
  TABLE_SORTS,
  type ProfessionOption,
  type RosterQuery,
} from "@/core/views/rosterQuery";
import { FilterChip } from "@/components/ui/FilterChip";
import { Segmented } from "@/components/ui/Segmented";
import styles from "./RosterSheet.module.css";

export interface RosterSheetProps {
  query: RosterQuery;
  professions: readonly ProfessionOption[];
  /** Applies a change at once (a new URL). */
  onChange: (next: RosterQuery) => void;
  /** Characters shown with the current filters: "Show 11 characters". */
  count: number;
  /** The table's sheet also sorts and groups (WEB-22); the cards' sheet only filters (WEB-65). */
  sort?: boolean;
}

const toggle = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const DIRS = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
] as const;

/**
 * The roster's filters on a phone: one button opens a bottom sheet, a native modal <dialog> (focus trap, Escape)
 * without drag; every choice applies at once. The table's also sorts and groups (WEB-22, no board, decided with
 * Nico); the cards' replaces the four filter menus (WEB-65, board live-test-phone). Clear, and Show N characters.
 */
export function RosterSheet({ query, professions, onChange, count, sort = false }: RosterSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const active =
    query.classes.length +
    query.roles.length +
    (query.level === undefined ? 0 : 1) +
    (query.profession === undefined ? 0 : 1);
  const name = sort ? "Filters & sort" : "Filters";

  return (
    <>
      <span className={styles.open}>
        <FilterChip aria-haspopup="dialog" active={active > 0} onClick={() => dialog.current?.showModal()}>
          {name}
          {active > 0 ? ` · ${active}` : ""}
        </FilterChip>
      </span>
      <dialog
        ref={dialog}
        className={styles.sheet}
        aria-labelledby="roster-sheet-title"
        onClick={(e) => {
          // A tap on the backdrop (outside the sheet's box) closes it.
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div className={styles.body}>
          <h2 id="roster-sheet-title" className={styles.title}>
            {name}
          </h2>

          <Group legend="Class">
            {(Object.keys(CLASSES) as ClassFile[]).map((c) => (
              <FilterChip
                key={c}
                pressed={query.classes.includes(c)}
                onClick={() => onChange({ ...query, classes: toggle(query.classes, c) })}
              >
                {CLASSES[c].name}
              </FilterChip>
            ))}
          </Group>
          <Group legend="Role">
            {ROLES.map((r: Role) => (
              <FilterChip
                key={r}
                pressed={query.roles.includes(r)}
                onClick={() => onChange({ ...query, roles: toggle(query.roles, r) })}
              >
                {ROLE_NAMES[r]}
              </FilterChip>
            ))}
          </Group>
          <Group legend="Level">
            {LEVEL_RANGES.map((r) => (
              <FilterChip
                key={r.key}
                pressed={query.level === r.key}
                onClick={() => onChange({ ...query, level: query.level === r.key ? undefined : r.key })}
              >
                {r.label}
              </FilterChip>
            ))}
          </Group>
          <Group legend="Profession">
            {professions.map((p) => (
              <FilterChip
                key={p.skillLine}
                pressed={query.profession === p.skillLine}
                onClick={() =>
                  onChange({ ...query, profession: query.profession === p.skillLine ? undefined : p.skillLine })
                }
              >
                {p.name}
              </FilterChip>
            ))}
          </Group>
          {sort && (
            <>
              <Group legend="Sort">
                {TABLE_SORTS.map((s) => (
                  <FilterChip
                    key={s.value}
                    pressed={query.sort === s.value}
                    onClick={() => onChange({ ...query, sort: s.value, dir: defaultSortDir(s.value) })}
                  >
                    {s.label}
                  </FilterChip>
                ))}
              </Group>
              <div className={styles.row}>
                <Segmented<SortDir>
                  label="Order"
                  options={DIRS}
                  value={query.dir}
                  onChange={(dir) => onChange({ ...query, dir })}
                />
                <FilterChip pressed={query.group} onClick={() => onChange({ ...query, group: !query.group })}>
                  Group by friend
                </FilterChip>
              </div>
            </>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.clear}
              disabled={active === 0}
              onClick={() => onChange({ ...query, classes: [], roles: [], level: undefined, profession: undefined })}
            >
              Clear
            </button>
            <button type="button" className={styles.done} onClick={() => dialog.current?.close()}>
              Show {count} {count === 1 ? "character" : "characters"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.chips}>{children}</div>
    </fieldset>
  );
}
