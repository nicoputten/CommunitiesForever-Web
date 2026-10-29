import type { PersonGoals } from "./doomsday/record";
import type { PersonFeed } from "./feed";
import type { Dataset } from "./model";
import { dict, finalize } from "./normalize";

// The launch cut-off (WEB-62, decided with Nico 2026-10-28): the site forgets the beta without deleting anything. The
// rebuild reads only uploads from after the cut-off, and even those lose what dates from before it, so a beta
// character carried in a launch-era file never comes back. Pure: the server applies it to each upload it reads.

const DAY = 86400;

/** What the admin types to confirm the cut-off (Nico, 2026-10-29). */
export const CUTOFF_CONFIRM = "delete all";

/**
 * The upload without what dates from before the cut-off: characters whose `lastPlayed` and `updatedAt` are both
 * before it (a character without either is kept: nothing says it's old), sightings and presence links seen before it,
 * and the stubs only those named.
 */
export function datasetSince(d: Dataset, cutoff: number): Dataset {
  const before = (t: number | undefined) => t !== undefined && t < cutoff;
  const locations = dict<Dataset["locations"][string]>();
  for (const [guid, s] of Object.entries(d.locations)) if (!before(s.seenAt)) locations[guid] = s;
  const presence = dict<Dataset["presence"][string]>();
  for (const [guid, p] of Object.entries(d.presence)) if (!before(p.lastSeen)) presence[guid] = p;
  const characters = dict<Dataset["characters"][string]>();
  for (const [guid, c] of Object.entries(d.characters)) {
    // Stubs come back from the kept sightings and presence links (finalize).
    if (!c.hasRecord) continue;
    const dates = [c.lastPlayed, c.updatedAt].filter((t): t is number => t !== undefined);
    if (dates.length === 0 || !dates.every(before)) characters[guid] = c;
  }
  return finalize({ ...d, characters, locations, presence });
}

/** The activity feed without days from before the cut-off (by the day's last activity, else the whole day). */
export function feedsSince(feeds: readonly PersonFeed[], cutoff: number): PersonFeed[] {
  return feeds.map((f) => {
    const days: PersonFeed["days"] = {};
    for (const [key, chars] of Object.entries(f.days)) {
      const day = Number(key);
      const kept = Object.fromEntries(
        Object.entries(chars).filter(([, e]) => (e.at !== undefined ? e.at >= cutoff : (day + 1) * DAY > cutoff)),
      );
      if (Object.keys(kept).length > 0) days[day] = kept;
    }
    return { ...f, days };
  });
}

/** Doomsday goals without days and weeks from before the cut-off (by `at`, else the whole day or week). */
export function goalsSince(all: readonly PersonGoals[], cutoff: number): PersonGoals[] {
  const keep = <T extends { at?: number }>(records: Record<number, T>, end: (n: number) => number) =>
    Object.fromEntries(
      Object.entries(records).filter(([n, r]) => (r.at !== undefined ? r.at >= cutoff : end(Number(n)) > cutoff)),
    ) as Record<number, T>;
  return all.map((g) => ({
    ...g,
    days: keep(g.days, (n) => (n + 1) * DAY),
    weeks: keep(g.weeks, (w) => (w * 7 + 3) * DAY),
  }));
}
