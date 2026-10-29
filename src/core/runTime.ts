import { MONTH_SHORT, WEEKDAY_SHORT } from "./names";
// Run times (WEB-40): stored in UTC (Unix seconds), shown and typed in each viewer's own IANA time zone. Daylight
// saving moves nothing that is stored. Pure: the zone and "now" come in as arguments; Intl does the zone rules.

const DAY = 24 * 60 * 60;

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function parts(at: number, timeZone: string): Parts {
  let f = formatters.get(timeZone);
  if (f === undefined) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hourCycle: "h23",
    });
    formatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(at * 1000)).map((x) => [x.type, x.value]));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: weekdays.indexOf(p.weekday ?? ""),
  };
}

/** The zone's offset from UTC at that moment, in seconds (Amsterdam in summer: 7200). */
export function offsetSeconds(timeZone: string, at: number): number {
  const p = parts(at, timeZone);
  const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) / 1000;
  return local - (at - (at % 60));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-27" in the zone. */
export function localDate(at: number, timeZone: string): string {
  const p = parts(at, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "20:30" in the zone, 24-hour. */
export function localTime(at: number, timeZone: string): string {
  const p = parts(at, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * The UTC moment of a day and time typed in a zone ("2026-10-27", "20:30"); undefined for a malformed one or a time
 * that doesn't exist there (the hour skipped when clocks go forward).
 */
export function zonedToUtc(date: string, time: string, timeZone: string): number | undefined {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (d === null || t === null) return undefined;
  const naive = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])) / 1000;
  if (Number.isNaN(naive)) return undefined;
  // The offset just before and just after; one of them gives back the typed time.
  for (const guess of [
    naive - offsetSeconds(timeZone, naive - DAY / 2),
    naive - offsetSeconds(timeZone, naive + DAY / 2),
  ]) {
    if (localDate(guess, timeZone) === date && localTime(guess, timeZone) === time) return guess;
  }
  return undefined;
}

/** "Today", "Tomorrow" or "Thu 29 Oct", by the zone's calendar. */
export function dayLabel(at: number, timeZone: string, now: number): string {
  const day = localDate(at, timeZone);
  if (day === localDate(now, timeZone)) return "Today";
  if (day === localDate(now + DAY, timeZone) && Math.abs(at - now) < 2 * DAY) return "Tomorrow";
  const p = parts(at, timeZone);
  return `${WEEKDAY_SHORT[p.weekday]} ${p.day} ${MONTH_SHORT[p.month - 1]}`;
}

/** "Today 20:30", "Thu 29 Oct 21:00". */
export function runWhen(at: number, timeZone: string, now: number): string {
  return `${dayLabel(at, timeZone, now)} ${localTime(at, timeZone)}`;
}

/** "in 25 min", "in 3 hours", "in 8 days", "started 20 min ago". */
export function untilStart(at: number, now: number): string {
  const s = at - now;
  const abs = Math.abs(s);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const amount =
    abs < 60 * 60
      ? `${Math.max(1, Math.round(abs / 60))} min`
      : abs < DAY
        ? plural(Math.round(abs / 3600), "hour")
        : plural(Math.round(abs / DAY), "day");
  return s >= 0 ? `in ${amount}` : `started ${amount} ago`;
}

/** The start of the next Monday in the zone: runs before it are "This week". */
export function weekEnd(now: number, timeZone: string): number {
  const p = parts(now, timeZone);
  const daysLeft = (8 - p.weekday) % 7 || 7;
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day + daysLeft));
  const date = `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
  return zonedToUtc(date, "00:00", timeZone) ?? now + daysLeft * DAY;
}

export interface DayOption {
  /** "2026-10-27" */
  date: string;
  /** "Today", "Wed 28" */
  label: string;
}

/** The next seven days in the zone, for Plan a run's day chips. */
export function nextDays(now: number, timeZone: string, count = 7): DayOption[] {
  const p = parts(now, timeZone);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day + i));
    const label = `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()}`;
    return {
      date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      label: i === 0 ? "Today" : label,
    };
  });
}
