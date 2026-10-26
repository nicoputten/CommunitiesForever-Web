"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { CLASSES, type ClassFile } from "@/core/gamedata/classes";
import type { Role } from "@/core/views/characters";
import { defaultSortDir } from "@/core/views/roster";
import {
  LEVEL_RANGES,
  ROLE_NAMES,
  ROLES,
  ROSTER_SORTS,
  professionSlug,
  rosterSearch,
  type ProfessionOption,
  type RosterQuery,
} from "@/core/views/rosterQuery";
import { FilterChip } from "@/components/ui/FilterChip";
import { SearchIcon } from "@/components/ui/icons";
import { FilterMenu } from "./FilterMenu";
import { RosterSheet } from "./RosterSheet";
import styles from "./RosterToolbar.module.css";

/** Search waits this long after the last key (decided with Nico for WEB-21). */
const SEARCH_DELAY_MS = 300;

const ANY = "";

export interface RosterToolbarProps {
  query: RosterQuery;
  professions: readonly ProfessionOption[];
  /** "4 of 10 characters" while a filter is set. */
  shown?: { count: number; of: number };
  /**
   * The table (WEB-22): its headers sort, so no Sort menu; a "Group by friend" chip; on a phone the filters, sort and
   * grouping move into a sheet.
   */
  table?: boolean;
}

/** The page the toolbar navigates on. */
const pathFor = (table: boolean) => (table ? "/roster/table" : "/roster");

const toggle = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/** "Class" without a choice, "Mage" with one, "Class · 2" with several; screen readers also hear the filter's name. */
function chipLabel(name: string, chosen: readonly string[]): ReactNode {
  if (chosen.length === 0) return name;
  if (chosen.length === 1) return <Named name={name}>{chosen[0]}</Named>;
  return `${name} · ${chosen.length}`;
}

function Named({ name, children }: { name: string; children: ReactNode }) {
  return (
    <span>
      <span className="visually-hidden">{name}: </span>
      {children}
    </span>
  );
}

/**
 * Search, filters and sort of the roster (roster-cards board). The state lives in the URL: filters and sort add a
 * history entry (Back undoes them), typing replaces it. Without script the search is a plain GET form.
 */
export function RosterToolbar({ query, professions, shown, table = false }: RosterToolbarProps) {
  const path = pathFor(table);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(query.search);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A new URL (Back, a link) brings its own search text.
  const [shownFor, setShownFor] = useState(query.search);
  if (shownFor !== query.search) {
    setShownFor(query.search);
    setSearch(query.search);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const go = (next: RosterQuery, replace = false) => {
    clearTimeout(timer.current);
    const href = `${path}${rosterSearch(next)}`;
    startTransition(() => (replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })));
  };
  const current = (): RosterQuery => ({ ...query, search });

  const onSearch = (value: string) => {
    setSearch(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => go({ ...query, search: value }, true), SEARCH_DELAY_MS);
  };

  const classFiles = Object.keys(CLASSES) as ClassFile[];
  const profession = professions.find((p) => p.skillLine === query.profession);
  const level = LEVEL_RANGES.find((r) => r.key === query.level);
  const sort = ROSTER_SORTS.find((s) => s.value === query.sort) ?? ROSTER_SORTS[0]!;

  return (
    <div className={styles.bar}>
      <form
        role="search"
        action={path}
        className={styles.searchForm}
        onSubmit={(e) => {
          e.preventDefault();
          go(current(), true);
        }}
      >
        <label className={styles.search}>
          <SearchIcon className={styles.icon} />
          <span className="visually-hidden">Search characters</span>
          <input
            type="search"
            name="q"
            value={search}
            placeholder="Search characters"
            autoComplete="off"
            maxLength={64}
            className={styles.input}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
        {/* Without script, the form keeps the other choices. */}
        {query.classes.length > 0 && <input type="hidden" name="class" value={query.classes.join(",").toLowerCase()} />}
        {query.roles.length > 0 && <input type="hidden" name="role" value={query.roles.join(",")} />}
        {query.level !== undefined && <input type="hidden" name="level" value={query.level} />}
        {query.profession !== undefined && <input type="hidden" name="prof" value={professionSlug(query.profession)} />}
        {query.sort !== "lastPlayed" && <input type="hidden" name="sort" value={query.sort} />}
        {query.dir !== defaultSortDir(query.sort) && <input type="hidden" name="dir" value={query.dir} />}
        {query.group && <input type="hidden" name="group" value="friend" />}
      </form>

      <div className={styles.filters} data-table={table || undefined}>
        <FilterMenu
          label={chipLabel(
            "Class",
            query.classes.map((c) => CLASSES[c].name),
          )}
          name="Class"
          kind="checkbox"
          active={query.classes.length > 0}
          items={[
            { key: ANY, label: "Any class", checked: query.classes.length === 0 },
            ...classFiles.map((c) => ({ key: c, label: CLASSES[c].name, checked: query.classes.includes(c) })),
          ]}
          onSelect={(key) => go({ ...current(), classes: key === ANY ? [] : toggle(query.classes, key as ClassFile) })}
        />
        <FilterMenu
          label={chipLabel(
            "Role",
            query.roles.map((r) => ROLE_NAMES[r]),
          )}
          name="Role"
          kind="checkbox"
          active={query.roles.length > 0}
          items={[
            { key: ANY, label: "Any role", checked: query.roles.length === 0 },
            ...ROLES.map((r) => ({ key: r, label: ROLE_NAMES[r], checked: query.roles.includes(r) })),
          ]}
          onSelect={(key) => go({ ...current(), roles: key === ANY ? [] : toggle(query.roles, key as Role) })}
        />
        <FilterMenu
          label={level === undefined ? "Level" : `Level ${level.label}`}
          name="Level"
          kind="radio"
          active={level !== undefined}
          items={[
            { key: ANY, label: "Any level", checked: level === undefined },
            ...LEVEL_RANGES.map((r) => ({ key: r.key, label: r.label, checked: r.key === query.level })),
          ]}
          onSelect={(key) => go({ ...current(), level: key === ANY ? undefined : key })}
        />
        <FilterMenu
          label={profession === undefined ? "Profession" : <Named name="Profession">{profession.name}</Named>}
          name="Profession"
          kind="radio"
          active={profession !== undefined}
          items={[
            { key: ANY, label: "Any profession", checked: profession === undefined },
            ...professions.map((p) => ({ key: p.skillLine, label: p.name, checked: p.skillLine === query.profession })),
          ]}
          onSelect={(key) => go({ ...current(), profession: key === ANY ? undefined : key })}
        />
        {table && (
          <FilterChip pressed={query.group} onClick={() => go({ ...current(), group: !query.group })}>
            Group by friend
          </FilterChip>
        )}
      </div>

      {table && <RosterSheet query={{ ...query, search }} professions={professions} onChange={(next) => go(next)} />}

      <div className={styles.end}>
        {shown !== undefined && (
          <p className={styles.shown}>
            {shown.count} of {shown.of} characters ·{" "}
            <Link
              href={`${path}${rosterSearch({ ...query, search: "", classes: [], roles: [], level: undefined, profession: undefined })}`}
              className={styles.clear}
            >
              Clear filters
            </Link>
          </p>
        )}
        {!table && (
          <>
            <span className={styles.sortLabel} aria-hidden="true">
              Sort
            </span>
            <FilterMenu
              label={<Named name="Sort">{sort.label}</Named>}
              name="Sort"
              kind="radio"
              active
              items={ROSTER_SORTS.map((s) => ({ key: s.value, label: s.label, checked: s.value === query.sort }))}
              onSelect={(key) => {
                const next = key as RosterQuery["sort"];
                go({ ...current(), sort: next, dir: defaultSortDir(next) });
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
