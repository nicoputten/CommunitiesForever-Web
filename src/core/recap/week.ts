// The recap week (WEB-41): the recap comes every week at a weekday and time in the admin's time zone (default Sunday
// 13:00, the Discord page). Moments are Unix seconds (UTC); the local time is turned into UTC per week, so a daylight
// saving change moves nothing locally: the recap stays at 13:00 on the admin's clock. A week runs from the previous
// recap moment (included) to this one (excluded). Pure: only Intl, no clock.

const DAY = 86400;

interface LocalTime {
  year: number;
  month: number;
  day: number;
  /** 0 Sunday … 6 Saturday. */
  weekday: number;
  hour: number;
  minute: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall clock in a time zone at a moment. */
export function localTime(timeZone: string, at: number): LocalTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(at * 1000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/** Seconds the zone is ahead of UTC at a moment. */
function offsetAt(timeZone: string, at: number): number {
  const l = localTime(timeZone, at);
  return Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute) / 1000 - Math.floor(at / 60) * 60;
}

/**
 * The moment a wall-clock time happens in a time zone. A time skipped by daylight saving (02:30 on the spring
 * change) comes out an hour later; a time that happens twice (the autumn change) the first time.
 */
export function zonedToUtc(timeZone: string, y: number, m: number, d: number, h: number, min: number): number {
  const wall = Date.UTC(y, m - 1, d, h, min) / 1000;
  // The offsets half a day before and after cover any change in between.
  const before = wall - offsetAt(timeZone, wall - DAY / 2);
  const after = wall - offsetAt(timeZone, wall + DAY / 2);
  const valid = [before, after].filter((c) => c + offsetAt(timeZone, c) === wall);
  // Twice (autumn): the first. Never (spring): the old offset, which lands an hour later on the new clock.
  return valid.length > 0 ? Math.min(...valid) : before;
}

export interface RecapSchedule {
  timeZone: string;
  /** 0 Sunday … 6 Saturday. */
  weekday: number;
  /** "HH:MM". */
  time: string;
}

/** The latest recap moment at or before `at`. */
export function recapMomentAtOrBefore(s: RecapSchedule, at: number): number {
  const [hh, mm] = s.time.split(":").map(Number) as [number, number];
  const today = localTime(s.timeZone, at);
  const back = (today.weekday - s.weekday + 7) % 7;
  // Walk calendar days in UTC terms: the local date's noon minus `back` days stays on the right local date.
  const noon = Date.UTC(today.year, today.month - 1, today.day, 12) / 1000 - back * DAY;
  const date = new Date(noon * 1000);
  let moment = zonedToUtc(s.timeZone, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hh, mm);
  if (moment > at) {
    const earlier = new Date((noon - 7 * DAY) * 1000);
    moment = zonedToUtc(s.timeZone, earlier.getUTCFullYear(), earlier.getUTCMonth() + 1, earlier.getUTCDate(), hh, mm);
  }
  return moment;
}

/** The recap moment after `moment` (a week later on the local clock). */
export function nextRecapMoment(s: RecapSchedule, moment: number): number {
  return recapMomentAtOrBefore(s, moment + 7 * DAY + 3 * 3600);
}

/** The week that ends at the latest recap moment at or before `at`: `[start, end)`. */
export function recapWeek(s: RecapSchedule, at: number): { start: number; end: number } {
  const end = recapMomentAtOrBefore(s, at);
  return { start: recapMomentAtOrBefore(s, end - 1), end };
}
