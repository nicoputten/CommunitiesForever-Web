import { battleTagKey, sameBattleTag } from "./access";
import { levelFit } from "./levelFit";
import type { Dataset } from "./model";
import { offsetSeconds } from "./runTime";
import { PAST_AFTER_SECONDS, phase, runDungeon, type RunRecord, type RunSource, type SlotRole } from "./runs";

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
  /** A reserve is "maybe" with `reserve` (older addons read in | maybe | cant). */
  answer: "in" | "maybe" | "cant";
  role: GameRole;
  source: GameSource;
  at: number;
  /** WEB-47: said I'm in while the role was full. */
  reserve?: boolean;
  /** WEB-47: how the character's level fits ("fits", "+3 over", "4 below"). */
  fit?: string;
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

/** WEB-51: an open ask ("who's up right now"), for a friend whose game reloads within its 10 minutes. */
export interface GameAsk {
  /** "a-12". */
  id: string;
  dungeon: string;
  dungeonName: string;
  /** When it was made, and until when it takes answers. */
  at: number;
  expiresAt: number;
  source: GameSource;
  note?: string;
  url: string;
  /** The asker, on their character when they have one that may join. */
  from: GamePerson & { role?: GameRole };
  answers: GameAnswer[];
}

export interface UploaderRuns {
  v: number;
  /** When the list last changed (UTC): unchanged lists keep it, so the uploader writes nothing and sync stays calm. */
  updatedAt: number;
  reminderMinutes: number;
  /** WEB-43 (addon CF-47): ids of the token owner's game items the site has; the game then forgets them. */
  received: string[];
  runs: GameRun[];
  /** WEB-51 (optional): the open asks; addons from before it ignore them. */
  asks: GameAsk[];
  /** WEB-58 (optional): Doomsday's reset and the realm's clock. */
  doomsday?: UploaderDoomsday;
  /** WEB-66 (optional, addon CF-62): the site's base URL, for the addon's "Copy website link". */
  site?: string;
  /** WEB-66 (optional, addon CF-62): the group's friends the site knows, the token's owner left out. */
  friends?: GameFriend[];
}

/** A friend for the addon's Friends tab: display name and characters only, never a BattleTag or GUID. */
export interface GameFriend {
  name: string;
  /** `realm`: the realm's name as the game wrote it; `seenAt`: when the site last saw the character (Unix seconds). */
  chars: { name: string; realm?: string; classFile?: string; level?: number; seenAt?: number }[];
}

/** At most this many friends, characters per friend, and characters in a name (addon CF-62). */
export const UPLOADER_MAX_FRIENDS = 50;
export const UPLOADER_MAX_FRIEND_CHARS = 20;
const FRIEND_NAME_MAX = 24;
const CHAR_NAME_MAX = 40;

/**
 * Every person in the merged data but the token's owner, by name, with their characters highest level first (WEB-66,
 * addon CF-62: friends "known from the website" before they're online). `changedAt` is the newest record among them,
 * so the list's changes move `updatedAt`.
 */
export function gameFriends(data: Dataset | undefined, owner: string): { friends: GameFriend[]; changedAt: number } {
  if (data === undefined) return { friends: [], changedAt: 0 };
  const people = Object.values(data.people)
    .filter((p) => !sameBattleTag(p.battleTag, owner))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "en") || a.key.localeCompare(b.key))
    .slice(0, UPLOADER_MAX_FRIENDS);
  const friends = people.map((p) => ({
    name: p.displayName.slice(0, FRIEND_NAME_MAX),
    chars: Object.values(data.characters)
      .filter((c) => c.owner === p.key && c.name !== undefined)
      .sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || a.name!.localeCompare(b.name!, "en"))
      .slice(0, UPLOADER_MAX_FRIEND_CHARS)
      .map((c) => {
        // Last seen: the newest of its own record's last login and the group's sighting of it.
        const seenAt = Math.max(c.lastPlayed ?? 0, data.locations[c.guid]?.seenAt ?? 0);
        return {
          name: c.name!.slice(0, CHAR_NAME_MAX),
          ...(c.realm !== undefined && c.realm !== "" ? { realm: c.realm.slice(0, CHAR_NAME_MAX) } : {}),
          ...(c.classFile !== undefined && /^[A-Z]+$/.test(c.classFile) ? { classFile: c.classFile } : {}),
          ...(c.level !== undefined && c.level >= 1 && c.level <= 60 ? { level: c.level } : {}),
          ...(seenAt > 0 ? { seenAt } : {}),
        };
      }),
  }));
  return { friends, changedAt: Math.max(0, ...people.map((p) => p.version ?? 0)) };
}

/**
 * The Doomsday reset in force (seconds after realm midnight) and since when (0: never changed); the addon (CF-56)
 * syncs it to friends without the uploader, the newest `changedAt` winning. The realm zone's UTC offset now, and its
 * next change (daylight saving) with the offset after it, for an addon that can't read the game clock.
 */
export interface UploaderDoomsday {
  reset: number;
  changedAt: number;
  offset?: number;
  offsetUntil?: number;
  offsetAfter?: number;
}

const SOURCE: Record<RunSource, GameSource> = { website: "site", discord: "discord", game: "game" };
const ROLE: Record<SlotRole, GameRole> = { tank: "tank", healer: "heal", damage: "dps" };

export interface UploaderRunsInput {
  runs: readonly RunRecord[];
  /** WEB-51: the asks; those still open go to the game. */
  asks?: readonly RunRecord[];
  /** A character's name by GUID. */
  characterName: (guid: string) => string | undefined;
  /** A character's level by GUID, for its fit (WEB-47). */
  characterLevel?: (guid: string) => number | undefined;
  /** A friend's own time zone (theirs, else the admin's). */
  timeZoneOf: (battleTag: string) => string;
  reminderMinutes: number;
  /** The site's public origin, for each run's link. */
  siteUrl: string;
  /** The token owner's game items the site has, newest first (at most 200). */
  received?: readonly string[];
  /** WEB-58: the Doomsday reset in force now and when it took effect, and the realm's offset. */
  doomsday?: UploaderDoomsday;
  /** WEB-66: the group's friends (gameFriends) and when that list last changed. */
  friends?: { friends: GameFriend[]; changedAt: number };
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
function changedAt(runs: readonly RunRecord[], asks: readonly RunRecord[], now: number): number {
  let at = 0;
  for (const r of runs) {
    const moments = [r.updatedAt, r.startsAt - UPLOADER_RUNS_DAYS * DAY, r.startsAt, r.startsAt + PAST_AFTER_SECONDS];
    for (const m of moments) if (m <= now && m > at) at = m;
  }
  // An ask joins the list when made and leaves it when it expires.
  for (const a of asks) {
    for (const m of [a.updatedAt, a.expiresAt ?? a.startsAt]) if (m <= now && m > at) at = m;
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
        answers: answersOf(r),
      };
      if (r.note !== undefined) run.note = r.note;
      return run;
    });
  const asks = (input.asks ?? [])
    .filter((a) => a.cancelledAt === undefined && now < (a.expiresAt ?? a.startsAt))
    .sort((a, b) => a.startsAt - b.startsAt || a.id - b.id)
    .slice(0, UPLOADER_MAX_RUNS)
    .map((a): GameAsk => {
      const dungeon = runDungeon(a.dungeonId);
      const lead = a.answers.find((x) => sameBattleTag(x.battleTag, a.organiser) && x.answer === "in");
      const ask: GameAsk = {
        id: `a-${a.id}`,
        dungeon: dungeon?.addonId ?? a.dungeonId,
        dungeonName: dungeon?.name ?? a.dungeonId,
        at: a.startsAt,
        expiresAt: a.expiresAt ?? a.startsAt,
        source: SOURCE[a.source],
        url: `${base}/runs`,
        from: { ...person(a.organiser, lead?.guid), ...(lead === undefined ? {} : { role: ROLE[lead.role] }) },
        answers: answersOf(a),
      };
      if (a.note !== undefined) ask.note = a.note;
      return ask;
    });
  return {
    v: UPLOADER_RUNS_VERSION,
    updatedAt: Math.max(
      changedAt(input.runs, input.asks ?? [], now),
      input.doomsday?.changedAt ?? 0,
      input.friends?.changedAt ?? 0,
    ),
    reminderMinutes: input.reminderMinutes,
    received: [...(input.received ?? [])],
    runs,
    asks,
    ...(input.doomsday !== undefined ? { doomsday: { ...input.doomsday } } : {}),
    site: base,
    ...(input.friends !== undefined ? { friends: input.friends.friends } : {}),
  };

  function answersOf(r: RunRecord): GameAnswer[] {
    const dungeon = runDungeon(r.dungeonId);
    return [...r.answers]
      .sort((a, b) => a.answeredAt - b.answeredAt || battleTagKey(a.battleTag).localeCompare(battleTagKey(b.battleTag)))
      .slice(0, UPLOADER_MAX_ANSWERS)
      .map((a) => {
        const game: GameAnswer = {
          ...person(a.battleTag, a.guid),
          answer: a.answer === "reserve" ? "maybe" : a.answer,
          role: ROLE[a.role],
          source: SOURCE[a.source],
          at: a.answeredAt,
        };
        if (a.answer === "reserve") game.reserve = true;
        if (a.guid !== undefined && dungeon !== undefined && input.characterLevel !== undefined) {
          const { min, max } = dungeon.typicalLevels;
          game.fit = levelFit(input.characterLevel(a.guid), min, max).label;
        }
        return game;
      });
  }
}
