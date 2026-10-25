// The data age scale, one everywhere (docs/DESIGN.md §4): live < 6 h, today 6–24 h, days 1–6 d, week+ ≥ 7 d,
// unknown when there is no time (no location). Times are Unix seconds; "now" is always an argument.

export const HOUR = 3600;
export const DAY = 24 * HOUR;

export type DataAge = "live" | "today" | "days" | "week" | "unknown";

/** A friend's data turns amber, and the site banner shows, at this age (decided: docs/DESIGN.md §11). */
export const OLD_AFTER = 7 * DAY;

/** Seconds since `at`; a time in the future (clock skew) counts as now. */
export function ageSeconds(at: number, now: number): number {
  return Math.max(0, now - at);
}

export function dataAge(at: number | undefined, now: number): DataAge {
  if (at === undefined) return "unknown";
  const age = ageSeconds(at, now);
  if (age < 6 * HOUR) return "live";
  if (age < DAY) return "today";
  if (age < OLD_AFTER) return "days";
  return "week";
}

/** Whole days since `at`. */
export function daysOld(at: number, now: number): number {
  return Math.floor(ageSeconds(at, now) / DAY);
}

/** Data 7 days old or more: amber badge, "X's data is N days old". */
export function isOld(at: number | undefined, now: number): boolean {
  return at !== undefined && ageSeconds(at, now) >= OLD_AFTER;
}

/**
 * How long ago `at` was, as the screens say it (lower case; "Data uploaded just now", "Yesterday" capitalised by the
 * caller): just now (< 1 min), N min ago, N h ago, yesterday (24–48 h), N days ago (< 14 d), N weeks ago (< 60 d),
 * N months ago (30-day months).
 */
export function timeAgo(at: number, now: number): string {
  const age = ageSeconds(at, now);
  if (age < 60) return "just now";
  if (age < HOUR) return `${Math.floor(age / 60)} min ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)} h ago`;
  const days = Math.floor(age / DAY);
  if (days < 2) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
