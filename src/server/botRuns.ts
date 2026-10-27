import { mayAdmin, roleOf } from "@/core/access";
import { RUNNABLE_DUNGEONS, rolesFor } from "@/core/gamedata";
import { isUpcoming, runDungeon, type MoveTo, type SlotRole } from "@/core/runs";
import { levelFit } from "@/core/levelFit";
import { zonedToUtc } from "@/core/runTime";
import { adminBattleTag, loadAccessList } from "./access";
import type { Db } from "./db";
import { effectiveTimeZone, linkForDiscordUser } from "./discord";
import { charactersOf, listRuns, runPayload, type StoredRun } from "./runs";
import { apiError } from "./session";
import { loadState } from "./uploads";

// The bot's run actions (WEB-40, docs/BOT-API.md "Run actions"): done for a Discord user, only when that account is
// linked (WEB-39) to someone who may sign in. The site checks every right itself; the bot only passes the user on.

export interface BotFriend {
  battleTag: string;
  isAdmin: boolean;
  timeZone: string;
}

/** The friend behind a Discord user id, or the error to answer: 403 `not_linked` for an unlinked or blocked account. */
export function botFriend(db: Db, discordUserId: unknown): BotFriend | Response {
  if (typeof discordUserId !== "string" || !/^\d{1,32}$/.test(discordUserId)) {
    return apiError(400, "invalid_request", "Send the Discord user id as discordUserId.");
  }
  const link = linkForDiscordUser(db, discordUserId);
  const list = loadAccessList(db, adminBattleTag());
  if (link === undefined || roleOf(link.battleTag, list) === undefined) {
    return apiError(403, "not_linked", "This Discord account is not linked to anyone on the list.");
  }
  return {
    battleTag: link.battleTag,
    isAdmin: mayAdmin(link.battleTag, list),
    timeZone: effectiveTimeZone(db, link.battleTag),
  };
}

const ROLES = ["tank", "healer", "damage"] as const;

/** A role as sent (WEB-47): tank, healer or damage; undefined when missing; null when not a role. */
export function roleParam(value: unknown): SlotRole | undefined | null {
  if (value === undefined || value === null) return undefined;
  return ROLES.find((r) => r === value) ?? null;
}

/** The character of an answer: `characterId` (WEB-47) or `guid` (WEB-40). */
export function characterParam(body: Record<string, unknown>): string | undefined {
  const id = body.characterId ?? body.guid;
  return typeof id === "string" ? id : undefined;
}

/** A move target (WEB-47): a role, `reserve` or `remove`. */
export function moveParam(value: unknown): MoveTo | undefined {
  return value === "reserve" || value === "remove" ? value : (ROLES.find((r) => r === value) ?? undefined);
}

/** The run's id from the path; undefined for anything but digits. */
export function runIdParam(id: string): number | undefined {
  return /^\d{1,15}$/.test(id) ? Number(id) : undefined;
}

/**
 * A start time as the bot sends it: `startsAt` (Unix seconds), or `date` and `time` typed in the friend's own time
 * zone (Discord doesn't tell the bot the user's zone, WEB-39). Undefined for neither or a time that doesn't exist.
 */
export function startTime(body: Record<string, unknown>, timeZone: string): number | undefined {
  if (typeof body.startsAt === "number" && Number.isInteger(body.startsAt)) return body.startsAt;
  if (typeof body.date === "string" && typeof body.time === "string") return zonedToUtc(body.date, body.time, timeZone);
  return undefined;
}

/** Upcoming runs as the bot shows them (`/runs`), by start. */
export function upcomingRuns(db: Db, now: number) {
  const data = loadState(db)?.data;
  return listRuns(db)
    .filter((r) => isUpcoming(r, now))
    .map((r) => runPayload(db, r, now, data));
}

/** "Pick my character": the friend's characters in the run's range, highest first. */
export function pickableCharacters(db: Db, run: StoredRun, battleTag: string) {
  const range = runDungeon(run.dungeonId)?.typicalLevels;
  return (
    charactersOf(loadState(db)?.data, battleTag)
      // Every character that may say I'm in (WEB-47 levelFit), with how it fits.
      .filter((c) => range !== undefined && levelFit(c.level, range.min, range.max).canPick)
      .map((c) => ({
        guid: c.guid,
        name: c.name ?? c.guid,
        level: c.level ?? null,
        classFile: c.classFile ?? null,
        role: c.role ?? null,
        roles: rolesFor(c.classFile),
        fit: range === undefined ? null : levelFit(c.level, range.min, range.max).label,
      }))
  );
}

export function dungeonList() {
  return RUNNABLE_DUNGEONS.map((d) => ({
    id: d.id,
    name: d.name,
    shortName: d.shortName,
    typicalLevels: d.typicalLevels,
  }));
}

const REFUSALS: Record<string, [number, string]> = {
  unknown_run: [404, "No such run."],
  unknown_dungeon: [400, "No such dungeon."],
  time_passed: [400, "That time has passed."],
  note_too_long: [400, "The note is longer than 200 characters."],
  lead_not_yours: [400, "That character is not yours."],
  lead_out_of_range: [400, "That character is not in the level range."],
  not_your_character: [400, "That character is not yours."],
  no_character: [400, "I'm in needs a character."],
  out_of_range: [400, "That character is not in the level range."],
  closed: [409, "The run has started or was cancelled."],
  role_not_for_class: [400, "That character's class can't play that role."],
  role_full: [409, "That role has no open slot."],
  unknown_sign_up: [404, "No sign-up with that character."],
  same: [409, "The sign-up already is there."],
  not_organiser: [403, "Only the organiser can edit a run."],
  not_allowed: [403, "Only the organiser or the admin can delete a run."],
  already_cancelled: [409, "The run was already cancelled."],
};

/** A run action's refusal: its status and a sentence for people (the Runs pages show it). */
export function refusalText(code: string): [number, string] {
  return REFUSALS[code] ?? [400, "Not possible."];
}

/** A run action's refusal as a bot API error. */
export function refusal(code: string): Response {
  const [status, text] = refusalText(code);
  return apiError(status, code, text);
}
