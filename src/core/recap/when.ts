// Dates of the weekly recap as the admin reads them (WEB-41c), in the recap's time zone.

const day = (timeZone: string) => new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric" });
const dayMonth = (timeZone: string) => new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" });

/** "20–26 Oct", "28 Oct – 3 Nov": the week's first and last day (the end moment itself belongs to the next week). */
export function recapDates(timeZone: string, start: number, end: number): string {
  const first = new Date(start * 1000);
  const last = new Date((end - 1) * 1000);
  const sameMonth = dayMonth(timeZone).format(first).split(" ")[1] === dayMonth(timeZone).format(last).split(" ")[1];
  return sameMonth
    ? `${day(timeZone).format(first)}–${dayMonth(timeZone).format(last)}`
    : `${dayMonth(timeZone).format(first)} – ${dayMonth(timeZone).format(last)}`;
}

/** "Sunday 1 Nov, 13:00 (Europe/Amsterdam)". */
export function recapDue(timeZone: string, at: number): string {
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(at * 1000));
  return `${text.replace(" at ", ", ")} (${timeZone.replace(/_/g, " ")})`;
}
