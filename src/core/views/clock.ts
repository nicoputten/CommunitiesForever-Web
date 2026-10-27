// Clock times ("today 21:14", "yesterday 22:05", "Thu 23 Oct, 23:40") for the upload history and "nothing new"
// (boards `upload`, `upload-states`). They are the viewer's local time: the browser formats them (Nico, WEB-19), so
// the time zone is an argument (undefined: the runtime's own zone). 24-hour clock, English day and month names.

type Fields = Partial<Record<Intl.DateTimeFormatPartTypes, string>>;

function fields(at: number, options: Intl.DateTimeFormatOptions, timeZone: string | undefined): Fields {
  const out: Fields = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).formatToParts(new Date(at * 1000))) {
    out[p.type] = p.value;
  }
  return out;
}

/** The calendar day of `at` in the zone, as days since 1970, so "yesterday" works across month and year ends. */
function calendarDay(at: number, timeZone: string | undefined): number {
  const f = fields(at, { year: "numeric", month: "numeric", day: "numeric" }, timeZone);
  return Date.UTC(Number(f.year), Number(f.month) - 1, Number(f.day)) / 86_400_000;
}

/**
 * When `at` was, in lower case where it starts with a word ("today 21:14"; capitalize() at the start of a line):
 * today, yesterday, else weekday, day and month ("Thu 23 Oct, 23:40"), with the year when it isn't this year.
 */
export function clockTime(at: number, now: number, timeZone?: string): string {
  const f = fields(
    at,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
    timeZone,
  );
  const time = `${f.hour}:${f.minute}`;
  const days = calendarDay(now, timeZone) - calendarDay(at, timeZone);
  if (days === 0) return `today ${time}`;
  if (days === 1) return `yesterday ${time}`;
  const thisYear = fields(now, { year: "numeric" }, timeZone).year;
  return `${f.weekday} ${f.day} ${f.month}${f.year === thisYear ? "" : ` ${f.year}`}, ${time}`;
}

/**
 * The same time as a phrase after "uploaded" (session report, WEB-20): "today at 21:14", "yesterday at 22:05",
 * "on Thu 23 Oct at 23:40".
 */
export function clockTimeAt(at: number, now: number, timeZone?: string): string {
  const text = clockTime(at, now, timeZone);
  const split = text.lastIndexOf(" ");
  const day = text.slice(0, split).replace(/,$/, "");
  const time = text.slice(split + 1);
  return `${day === "today" || day === "yesterday" ? day : `on ${day}`} at ${time}`;
}

/**
 * The day of `at` (uploader page, WEB-34): "today", "yesterday", else day and month ("27 Oct"), with the year when it
 * isn't this year. `withTime` adds the time to today and yesterday ("today 21:14"), as "last upload" does.
 */
export function clockDay(at: number, now: number, withTime = false, timeZone?: string): string {
  const text = clockTime(at, now, timeZone);
  if (text.startsWith("today ") || text.startsWith("yesterday ")) return withTime ? text : text.split(" ")[0]!;
  return text.slice(text.indexOf(" ") + 1, text.lastIndexOf(","));
}

/** A history row's time and date (uploader page, WEB-34): "21:14" over "Mon 27 Oct" (with the year when not this year). */
export function clockParts(at: number, now: number, timeZone?: string): { time: string; date: string } {
  const text = clockTime(at, now, timeZone);
  const time = text.slice(text.lastIndexOf(" ") + 1);
  const f = fields(at, { year: "numeric", month: "short", day: "numeric", weekday: "short" }, timeZone);
  const thisYear = fields(now, { year: "numeric" }, timeZone).year;
  return { time, date: `${f.weekday} ${f.day} ${f.month}${f.year === thisYear ? "" : ` ${f.year}`}` };
}

export type DayGroup = "today" | "week" | "earlier";

export const DAY_GROUPS: Record<DayGroup, string> = { today: "Today", week: "This week", earlier: "Earlier" };

/** Today, the six days before it, or earlier: the uploader page's history headings. */
export function dayGroup(at: number, now: number, timeZone?: string): DayGroup {
  const days = calendarDay(now, timeZone) - calendarDay(at, timeZone);
  return days <= 0 ? "today" : days < 7 ? "week" : "earlier";
}
