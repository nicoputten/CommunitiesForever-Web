import { CLASSES, PROFESSIONS, type ClassFile } from "../gamedata";
import type { CharacterView, Role } from "./characters";
import { compareText } from "./characters";
import type { RosterFilter, RosterSort } from "./roster";

// The roster's search, filters and sort as they live in the URL (WEB-21), so a view can be shared and Back undoes a
// filter: /roster?q=ves&class=warlock,mage&role=heal&level=30-39&prof=tailoring&sort=level. Anything unknown in the
// URL is ignored, never an error.

export interface LevelRange {
  key: string;
  label: string;
  min: number;
  max: number;
}

/** The Level filter's choices (decided with Nico for WEB-21, 2026-10-26). */
export const LEVEL_RANGES: readonly LevelRange[] = [
  { key: "1-19", label: "1–19", min: 1, max: 19 },
  { key: "20-29", label: "20–29", min: 20, max: 29 },
  { key: "30-39", label: "30–39", min: 30, max: 39 },
  { key: "40-49", label: "40–49", min: 40, max: 49 },
  { key: "50-59", label: "50–59", min: 50, max: 59 },
  { key: "60", label: "60", min: 60, max: 60 },
];

export const ROLE_NAMES: Readonly<Record<Role, string>> = { tank: "Tank", heal: "Healer", dps: "Damage" };
export const ROLES: readonly Role[] = ["tank", "heal", "dps"];

/** The sorts the cards offer, default first. */
export const ROSTER_SORTS: readonly { value: RosterSort; label: string }[] = [
  { value: "lastPlayed", label: "Last played" },
  { value: "level", label: "Level" },
  { value: "name", label: "Name" },
  { value: "ilvl", label: "Item level" },
  { value: "profession", label: "Profession" },
];

const DEFAULT_SORT: RosterSort = "lastPlayed";
const CLASSES_ORDER = Object.keys(CLASSES) as ClassFile[];

export interface RosterQuery {
  search: string;
  classes: ClassFile[];
  roles: Role[];
  /** A LEVEL_RANGES key. */
  level?: string;
  /** Skill line ID. */
  profession?: string;
  sort: RosterSort;
}

export type SearchParams = Record<string, string | string[] | undefined>;

export interface ProfessionOption {
  skillLine: string;
  name: string;
}

/** "First Aid" → "first-aid": the profession in the URL. A skill line the table does not know stays its ID. */
export function professionSlug(skillLine: string): string {
  const info = PROFESSIONS[Number(skillLine)];
  return info === undefined ? skillLine : info.name.toLowerCase().replace(/\s+/g, "-");
}

function skillLineOf(slug: string): string | undefined {
  for (const info of Object.values(PROFESSIONS)) {
    if (professionSlug(String(info.skillLineID)) === slug) return String(info.skillLineID);
  }
  return /^\d{1,6}$/.test(slug) ? slug : undefined;
}

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined): string[] =>
  (first(v) ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== "");

export function parseRosterQuery(params: SearchParams): RosterQuery {
  const classes = list(params.class)
    .map((c) => c.toUpperCase())
    .filter((c): c is ClassFile => Object.hasOwn(CLASSES, c));
  const roles = list(params.role).filter((r): r is Role => (ROLES as readonly string[]).includes(r));
  const level = first(params.level);
  const prof = first(params.prof);
  const sort = first(params.sort);
  const query: RosterQuery = {
    search: (first(params.q) ?? "").slice(0, 64),
    classes: CLASSES_ORDER.filter((c) => classes.includes(c)),
    roles: ROLES.filter((r) => roles.includes(r)),
    sort: ROSTER_SORTS.some((s) => s.value === sort) ? (sort as RosterSort) : DEFAULT_SORT,
  };
  if (LEVEL_RANGES.some((r) => r.key === level)) query.level = level;
  const skillLine = prof === undefined ? undefined : skillLineOf(prof.toLowerCase());
  if (skillLine !== undefined) query.profession = skillLine;
  return query;
}

/** The query string of a roster view ("" for the default view), with the parameters in a fixed order. */
export function rosterSearch(q: RosterQuery): string {
  const params = new URLSearchParams();
  if (q.search.trim() !== "") params.set("q", q.search.trim());
  if (q.classes.length > 0) params.set("class", q.classes.map((c) => c.toLowerCase()).join(","));
  if (q.roles.length > 0) params.set("role", q.roles.join(","));
  if (q.level !== undefined) params.set("level", q.level);
  if (q.profession !== undefined) params.set("prof", professionSlug(q.profession));
  if (q.sort !== DEFAULT_SORT) params.set("sort", q.sort);
  const s = params.toString().replaceAll("%2C", ",");
  return s === "" ? "" : `?${s}`;
}

/** The view model's filter for a query. */
export function rosterFilter(q: RosterQuery): RosterFilter {
  const filter: RosterFilter = {};
  if (q.search.trim() !== "") filter.search = q.search;
  if (q.classes.length > 0) filter.classFiles = q.classes;
  if (q.roles.length > 0) filter.roles = q.roles;
  const range = LEVEL_RANGES.find((r) => r.key === q.level);
  if (range !== undefined) {
    filter.minLevel = range.min;
    filter.maxLevel = range.max;
  }
  if (q.profession !== undefined) filter.profession = q.profession;
  return filter;
}

/** Search or a filter is set (the sort alone does not narrow anything). */
export function isFiltered(q: RosterQuery): boolean {
  return q.search.trim() !== "" || q.classes.length > 0 || q.roles.length > 0 || q.level !== undefined || q.profession !== undefined;
}

/** The professions anyone in the data has, by name: the Profession filter's choices. */
export function professionOptions(characters: readonly CharacterView[]): ProfessionOption[] {
  const seen = new Map<string, string>();
  for (const c of characters) for (const p of c.professions) if (!seen.has(p.skillLine)) seen.set(p.skillLine, p.name);
  return [...seen]
    .map(([skillLine, name]) => ({ skillLine, name }))
    .sort((a, b) => compareText(a.name, b.name) || compareText(a.skillLine, b.skillLine));
}
