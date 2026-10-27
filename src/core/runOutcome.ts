import type { FeedDay } from "./feed";
import { resolveZone } from "./gamedata";
import { runDungeon, type RunRecord } from "./runs";

// Did a planned run happen (WEB-43)? The addon's run log (CF-23, in the activity feed) records per realm day which
// dungeon a character ran and which community members were in the group, without a start time; inside Scarlet
// Monastery the zone is "Scarlet Monastery" for every wing. Decided with Nico (2026-10-27): it ran when the log shows
// that instance on the run's day with at least two of the characters who said I'm in.

/** No upload showed it within this long after the start: "didn't happen" (story WEB-43). */
export const OUTCOME_SECONDS = 4 * 60 * 60;
/** Ran it with at least this many of the signed-up characters. */
export const MIN_CAME = 2;

const DAY = 24 * 60 * 60;

export interface RanIt {
  /** Signed-up characters seen in the run. */
  came: number;
  /** Characters who said I'm in. */
  signedUp: number;
}

/**
 * The realm days a run can fall on: the realm day isn't known here (realm time), so the UTC days a few hours either
 * side of the start.
 */
export function runDays(startsAt: number): number[] {
  const days = new Set<number>();
  for (const at of [startsAt - 6 * 60 * 60, startsAt, startsAt + 6 * 60 * 60]) days.add(Math.floor(at / DAY));
  return [...days];
}

/**
 * Whether the stored feed days show the run happened: `day(d)` gives that realm day's entries by GUID. Undefined
 * when the log doesn't show it (yet).
 */
export function ranIt(run: RunRecord, day: (realmDay: number) => Record<string, FeedDay>): RanIt | undefined {
  const instance = runDungeon(run.dungeonId)?.instanceId;
  if (instance === undefined) return undefined;
  const signed = new Set(run.answers.filter((a) => a.answer === "in" && a.guid !== undefined).map((a) => a.guid!));
  if (signed.size < MIN_CAME) return undefined;
  const present = new Set<string>();
  for (const d of runDays(run.startsAt)) {
    for (const [guid, entry] of Object.entries(day(d))) {
      for (const r of entry.runs) {
        if (r.name === undefined || resolveZone(r.name).dungeon?.id !== instance) continue;
        present.add(guid);
        for (const g of r.with) present.add(g);
      }
    }
  }
  const came = [...signed].filter((g) => present.has(g)).length;
  return came >= MIN_CAME ? { came, signedUp: signed.size } : undefined;
}
