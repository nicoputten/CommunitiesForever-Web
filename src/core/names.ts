// English names the site writes in text: short weekday and month names and ordinals. Strings are hardcoded English
// (CLAUDE.md rule 8); one copy here instead of one per screen (WEB-63).

/** Sunday first, as `Date.getUTCDay()` counts. */
export const WEEKDAY_SHORT: readonly string[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const MONTH_SHORT: readonly string[] = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "1st", "2nd", "3rd", "4th", "11th", "21st", "112th". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}
