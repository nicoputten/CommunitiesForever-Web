import type { RecapChar, Week } from "./types";

// Measures of a week that several cards share (WEB-41). Snapshot measures compare the characters at the start and
// end of the week and cover every friend; feed measures only friends who share their activity.

export const MAX_LEVEL = 60;
const DAY = 86400;

export function levelOf(c: RecapChar | undefined): number {
  return c?.level ?? 0;
}

/**
 * Levels each character gained (snapshot). A character new this week gained nothing: its levels came before the site
 * knew it (a friend who joins with a level 60 doesn't win The Grinder); Fresh face is about it instead.
 */
export function levelGains(week: Week): Map<string, number> {
  const gains = new Map<string, number>();
  for (const [guid, after] of Object.entries(week.after)) {
    const before = week.before[guid];
    if (before === undefined) continue;
    const gained = levelOf(after) - levelOf(before);
    if (gained > 0) gains.set(guid, gained);
  }
  return gains;
}

/** Sum per friend of a per-character measure. */
export function byFriend(week: Week, perChar: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [guid, n] of perChar) {
    const owner = week.after[guid]?.owner ?? week.before[guid]?.owner;
    if (owner !== undefined) out.set(owner, (out.get(owner) ?? 0) + n);
  }
  return out;
}

/** The entry with the highest value; ties to the smaller key, so the result never depends on order. */
export function best<K extends string>(m: Map<K, number>): [K, number] | undefined {
  let top: [K, number] | undefined;
  for (const [k, v] of m) {
    if (top === undefined || v > top[1] || (v === top[1] && k < top[0])) top = [k, v];
  }
  return top;
}

/** Second highest, for runner-ups. */
export function second<K extends string>(m: Map<K, number>, winner: K): [K, number] | undefined {
  const rest = new Map([...m].filter(([k]) => k !== winner));
  return best(rest);
}

export function friendName(week: Week, key: string): string {
  return week.friends.find((f) => f.key === key)?.name ?? "Someone";
}

export function charName(week: Week, guid: string): string {
  return week.after[guid]?.name ?? week.before[guid]?.name ?? "A character";
}

/** Characters new this week (not at the start; in week 1 nothing is new). */
export function newCharacters(week: Week): string[] {
  if (week.number === 1) return [];
  return Object.keys(week.after)
    .filter((g) => week.before[g] === undefined)
    .sort();
}

/** Zones each friend was in (sightings and quest zones of the feed). */
export function zonesByFriend(week: Week): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (owner: string | undefined, zone: string) => {
    if (owner === undefined) return;
    if (!out.has(owner)) out.set(owner, new Set());
    out.get(owner)!.add(zone);
  };
  for (const s of week.sightings) add(week.after[s.guid]?.owner, s.zone);
  for (const d of week.days) for (const zone of Object.keys(d.entry.quests)) add(d.owner, zone);
  return out;
}

/** Friends seen per zone. */
export function friendsByZone(week: Week): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [friend, zones] of zonesByFriend(week)) {
    for (const zone of zones) {
      if (!out.has(zone)) out.set(zone, new Set());
      out.get(zone)!.add(friend);
    }
  }
  return out;
}

/** Feed days (character × day) per character, per friend and in total. */
export function activeDays(week: Week): { perChar: Map<string, number>; perFriendDays: Map<string, Set<number>> } {
  const perChar = new Map<string, number>();
  const perFriendDays = new Map<string, Set<number>>();
  for (const d of week.days) {
    perChar.set(d.guid, (perChar.get(d.guid) ?? 0) + 1);
    if (!perFriendDays.has(d.owner)) perFriendDays.set(d.owner, new Set());
    perFriendDays.get(d.owner)!.add(d.day);
  }
  return { perChar, perFriendDays };
}

/** Friends who played this week: a feed day, a level or a sighting in the week. */
export function friendsPlayed(week: Week): Set<string> {
  const out = new Set<string>();
  for (const d of week.days) out.add(d.owner);
  for (const guid of levelGains(week).keys()) {
    const owner = week.after[guid]?.owner;
    if (owner !== undefined) out.add(owner);
  }
  for (const s of week.sightings) {
    const owner = week.after[s.guid]?.owner;
    if (owner !== undefined) out.add(owner);
  }
  return out;
}

/** Dungeon, raid and battleground runs of the week (feed). */
export function runs(
  week: Week,
): { owner: string; guid: string; day: number; name?: string; kind?: string; with: string[] }[] {
  return week.days.flatMap((d) =>
    d.entry.runs.map((r) => ({ owner: d.owner, guid: d.guid, day: d.day, name: r.name, kind: r.kind, with: r.with })),
  );
}

/** Profession points each character gained (snapshot). */
export function professionGains(week: Week): Map<string, number> {
  const out = new Map<string, number>();
  for (const [guid, after] of Object.entries(week.after)) {
    const before = week.before[guid];
    if (before === undefined) continue;
    let gained = 0;
    for (const p of after.professions) {
      const old = before.professions.find((q) => q.name === p.name);
      if (old !== undefined && p.rank > old.rank) gained += p.rank - old.rank;
    }
    if (gained > 0) out.set(guid, gained);
  }
  return out;
}

/** Weekday (0 Sunday) of a realm day number. */
export function weekdayOfDay(day: number): number {
  return new Date(day * DAY * 1000).getUTCDay();
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "3rd", "11th". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** Score relative to earlier weeks: the value against the card's average so far (a rare high beats a usual one). */
export function relative(value: number, past: readonly number[], base = 1): number {
  if (past.length === 0) return value / base;
  const mean = past.reduce((a, b) => a + b, 0) / past.length;
  return value / Math.max(base, mean);
}
