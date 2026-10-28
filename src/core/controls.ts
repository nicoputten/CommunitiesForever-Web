// The rules behind the site's form controls (WEB-48): the dropdown's search, the time input and the date popover's
// month grid. Pure, so they're unit tested apart from the components in src/components/ui.

// --- dropdown search ----------------------------------------------------------------------------------------------

/** The dropdown shows a search field from this many options (board `runs-v2-plan`). */
export const SEARCH_FROM = 8;

export interface SearchableOption {
  label: string;
  meta?: string;
  group?: string;
  /** Options of one family (a dungeon's wings): while searching, the family's other options follow the first match. */
  family?: string;
}

/** Lower case, accents and underscores off, so "sao_paulo" finds "São Paulo". */
export function searchKey(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/_/g, " ").toLowerCase();
}

/**
 * The options whose label, meta or group contain every word of the query, in their order. A family's first match
 * keeps its place; the family's other options, matching or not, follow at the end under "Other <family> wings"
 * (WEB-49, board `runs-v2-plan`: searching "scar" shows the Graveyard that fits, then the other Scarlet Monastery wings).
 */
export function filterOptions<T extends SearchableOption>(options: readonly T[], query: string): T[] {
  const words = searchKey(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...options];
  const matched = options.filter((o) => {
    const text = searchKey(`${o.label} ${o.meta ?? ""} ${o.group ?? ""}`);
    return words.every((w) => text.includes(w));
  });
  const first = new Map<string, T>();
  for (const o of matched) if (o.family !== undefined && !first.has(o.family)) first.set(o.family, o);
  if (first.size === 0) return matched;
  const others = [...first].flatMap(([family, kept]) =>
    options.filter((o) => o.family === family && o !== kept).map((o) => ({ ...o, group: `Other ${family} wings` })),
  );
  return [...matched.filter((o) => o.family === undefined || first.get(o.family) === o), ...others];
}

// --- time input ---------------------------------------------------------------------------------------------------

/** "2030", "20:30", "20.30", "8:30", "830", "20" → "20:30", "08:30", "08:30", "20:00"; undefined when not a time. */
export function parseTime(text: string): string | undefined {
  const raw = text.trim();
  let hours: number;
  let minutes: number;
  const parts = /^(\d{1,2})[:.h ](\d{2})$/.exec(raw);
  if (parts) {
    hours = Number(parts[1]);
    minutes = Number(parts[2]);
  } else if (/^\d{1,4}$/.test(raw)) {
    if (raw.length <= 2) {
      hours = Number(raw);
      minutes = 0;
    } else {
      hours = Number(raw.slice(0, -2));
      minutes = Number(raw.slice(-2));
    }
  } else {
    return undefined;
  }
  if (hours > 23 || minutes > 59) return undefined;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** The time `step` minutes later (or earlier), on a 24-hour clock that wraps. */
export function stepTime(value: string | undefined, step: number): string {
  const [h, m] = (value ?? "00:00").split(":").map(Number) as [number, number];
  const total = (((h * 60 + m + step) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// --- date popover -------------------------------------------------------------------------------------------------

/** A calendar day as "YYYY-MM-DD" (the form value), read and written in UTC so no time zone shifts it. */
export type IsoDate = string;

function toDate(day: IsoDate): Date {
  return new Date(`${day}T00:00:00Z`);
}

function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(text: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && toIso(toDate(text)) === text;
}

export function addDays(day: IsoDate, days: number): IsoDate {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** The same day `months` later, or the month's last day when it has fewer (31 Jan + 1 month = 28 or 29 Feb). */
export function addMonths(day: IsoDate, months: number): IsoDate {
  const d = toDate(day);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return toIso(target);
}

/** 0 Monday … 6 Sunday: weeks start on Monday. */
export function weekdayOf(day: IsoDate): number {
  return (toDate(day).getUTCDay() + 6) % 7;
}

export interface GridDay {
  date: IsoDate;
  /** In the month shown; the others fill the first and last week. */
  inMonth: boolean;
}

/** The month of `day` as full weeks, Monday to Sunday. */
export function monthGrid(day: IsoDate): GridDay[][] {
  const first = `${day.slice(0, 7)}-01`;
  const month = first.slice(0, 7);
  let cursor = addDays(first, -weekdayOf(first));
  const weeks: GridDay[][] = [];
  do {
    const week: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, inMonth: cursor.startsWith(month) });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  } while (cursor.startsWith(month));
  return weeks;
}

const format = (day: IsoDate, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(toDate(day));

/** "Fri 30 Oct": the field's text. */
export function dayLabel(day: IsoDate): string {
  return format(day, { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
}

/** "Friday 30 October 2026": what a screen reader hears for a day. */
export function dayLabelLong(day: IsoDate): string {
  return format(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(",", "");
}

/** "October 2026": the popover's heading. */
export function monthLabel(day: IsoDate): string {
  return format(day, { month: "long", year: "numeric" });
}

/** Mo … Su, with the full name for screen readers. */
export const WEEKDAYS = [
  ["Mo", "Monday"],
  ["Tu", "Tuesday"],
  ["We", "Wednesday"],
  ["Th", "Thursday"],
  ["Fr", "Friday"],
  ["Sa", "Saturday"],
  ["Su", "Sunday"],
] as const;
