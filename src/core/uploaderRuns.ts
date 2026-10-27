import { battleTagKey, sameBattleTag } from "./access";
import { offsetSeconds } from "./runTime";
import {
  PAST_AFTER_SECONDS,
  phase,
  runDungeon,
  type Answer,
  type RunRecord,
  type RunSource,
  type SlotRole,
} from "./runs";

// The upcoming runs for the uploader (WEB-44, docs/UPLOADER-API.md "Runs"): the shape of the addon's planned runs
// file (`CF_RUNS`, CommunitiesForever docs/ARCHITECTURE.md "Planned runs file"), which the uploader (UP-12) writes
// into the game as Lua data. Field for field, so the uploader only escapes and caps.

/** Runs this far ahead go to the game (story WEB-44). */
export const UPLOADER_RUNS_DAYS = 14;
/** The addon's caps (PlannedRuns.MAX_RUNS, MAX_ANSWERS): more would be dropped there. */
export const UPLOADER_MAX_RUNS = 50;
export const UPLOADER_MAX_ANSWERS = 40;
/** The file format the addon reads (PlannedRuns.VERSION). */
export const UPLOADER_RUNS_VERSION = 1;

const DAY = 24 * 60 * 60;

export type GameState = "open" | "full" | "started" | "cancelled";
export type GameSource = "site" | "discord" | "game";
export type GameRole = "tank" | "heal" | "dps";

export interface GamePerson {
  battleTag: string;
  guid?: string;
  /** The character's name. */
  name?: string;
}

export interface GameAnswer extends GamePerson {
  answer: Answer;
  role: GameRole;
  source: GameSource;
  at: number;
}

export interface GameRun {
  /** "r-102". */
  id: string;
  /** The addon's dungeon id ("smarm"), else the site's ("drowned"). */
  dungeon: string;
  /** "Scarlet Monastery: Armory": for dungeons the addon doesn't know (decided with Nico, 2026-10-27). */
  dungeonName: string;
  startsAt: number;
  state: GameState;
  source: GameSource;
  note?: string;
  url: string;
  organiser: GamePerson & { utcOffset: number };
  answers: GameAnswer[];
}

export interface UploaderRuns {
  v: number;
  /** When the list last changed (UTC): unchanged lists keep it, so the uploader writes nothing and sync stays calm. */
  updatedAt: number;
  reminderMinutes: number;
  runs: GameRun[];
}

const SOURCE: Record<RunSource, GameSource> = { website: "site", discord: "discord", game: "game" };
const ROLE: Record<SlotRole, GameRole> = { tank: "tank", healer: "heal", damage: "dps" };

export interface UploaderRunsInput {
  runs: readonly RunRecord[];
  /** A character's name by GUID. */
  characterName: (guid: string) => string | undefined;
  /** A friend's own time zone (theirs, else the admin's). */
  timeZoneOf: (battleTag: string) => string;
  reminderMinutes: number;
  /** The site's public origin, for each run's link. */
  siteUrl: string;
  now: number;
}

/**
 * In the list: starts within 14 days and isn't past (2 hours after its start); a cancelled run until its start
 * (decided with Nico, 2026-10-27: the game says it was cancelled rather than dropping it).
 */
function shown(run: RunRecord, now: number): boolean {
  if (run.startsAt > now + UPLOADER_RUNS_DAYS * DAY) return false;
  if (run.cancelledAt !== undefined) return now < run.startsAt;
  return now < run.startsAt + PAST_AFTER_SECONDS;
}

/**
 * The newest moment the list changed: a run's own change, a run coming into the 14 days, starting, or leaving the
 * list. The same runs give the same `updatedAt`, whenever they are asked for.
 */
function changedAt(runs: readonly RunRecord[], now: number): number {
  let at = 0;
  for (const r of runs) {
    const moments = [r.updatedAt, r.startsAt - UPLOADER_RUNS_DAYS * DAY, r.startsAt, r.startsAt + PAST_AFTER_SECONDS];
    for (const m of moments) if (m <= now && m > at) at = m;
  }
  return at;
}

export function uploaderRuns(input: UploaderRunsInput): UploaderRuns {
  const { now } = input;
  const base = input.siteUrl.replace(/\/+$/, "");
  const person = (battleTag: string, guid: string | undefined): GamePerson => {
    const p: GamePerson = { battleTag };
    if (guid !== undefined) {
      p.guid = guid;
      const name = input.characterName(guid);
      if (name !== undefined) p.name = name;
    }
    return p;
  };
  const runs = input.runs
    .filter((r) => shown(r, now))
    .sort((a, b) => a.startsAt - b.startsAt || a.id - b.id)
    .slice(0, UPLOADER_MAX_RUNS)
    .map((r): GameRun => {
      const dungeon = runDungeon(r.dungeonId);
      const lead = r.answers.find((a) => sameBattleTag(a.battleTag, r.organiser) && a.answer === "in");
      const p = phase(r, r.answers, now);
      const run: GameRun = {
        id: `r-${r.id}`,
        dungeon: dungeon?.addonId ?? r.dungeonId,
        dungeonName: dungeon?.name ?? r.dungeonId,
        startsAt: r.startsAt,
        state: p === "past" ? "started" : p,
        source: SOURCE[r.source],
        url: `${base}/runs/${r.id}`,
        organiser: {
          ...person(r.organiser, lead?.guid),
          utcOffset: offsetSeconds(input.timeZoneOf(r.organiser), r.startsAt),
        },
        answers: [...r.answers]
          .sort(
            (a, b) => a.answeredAt - b.answeredAt || battleTagKey(a.battleTag).localeCompare(battleTagKey(b.battleTag)),
          )
          .slice(0, UPLOADER_MAX_ANSWERS)
          .map((a) => ({
            ...person(a.battleTag, a.guid),
            answer: a.answer,
            role: ROLE[a.role],
            source: SOURCE[a.source],
            at: a.answeredAt,
          })),
      };
      if (r.note !== undefined) run.note = r.note;
      return run;
    });
  return {
    v: UPLOADER_RUNS_VERSION,
    updatedAt: changedAt(input.runs, now),
    reminderMinutes: input.reminderMinutes,
    runs,
  };
}
