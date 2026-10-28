import { mayAdmin } from "@/core/access";
import { peopleViews, recordCharacters } from "@/core/views/characters";
import type { RunsInput } from "@/core/views/runs";
import { adminBattleTag, loadAccessList } from "./access";
import type { Db } from "./db";
import { effectiveTimeZone, getBotSettings } from "./discord";
import { listRuns, markDidntHappen } from "./runs";
import { loadState } from "./uploads";

// The Runs pages' input (WEB-40): the runs, the group's characters and people, and the viewer with their time zone.

export function runsInput(db: Db, battleTag: string, now: number, admin = adminBattleTag()): RunsInput {
  // Runs no upload showed within 4 hours are "didn't happen" (WEB-43), also when the bot isn't polling.
  markDidntHappen(db, now);
  const data = loadState(db)?.data;
  const zones = new Map<string, string>();
  const timeZoneOf = (tag: string) => {
    let zone = zones.get(tag);
    if (zone === undefined) {
      zone = effectiveTimeZone(db, tag, admin);
      zones.set(tag, zone);
    }
    return zone;
  };
  return {
    runs: listRuns(db),
    characters: data === undefined ? [] : recordCharacters(data, now),
    people: data === undefined ? [] : peopleViews(data, now),
    viewer: { battleTag, isAdmin: mayAdmin(battleTag, loadAccessList(db, admin)), timeZone: timeZoneOf(battleTag) },
    timeZoneOf,
    now,
  };
}

/** Where Plan a run's post goes: "Posts in the runs channel · reminder 30 min before" (the admin's settings, WEB-39). */
export function postsTo(db: Db, admin: boolean): string {
  const s = getBotSettings(db);
  if (!s.runs) return "Run posts are off: the admin turned them off on the Discord page.";
  // The channel hint is for the admin only (WEB-49, finding 12).
  if (s.runsChannel === null)
    return admin ? "Posts once you pick a channel for runs on the Discord page" : "Not posted in Discord yet";
  const where = "Posts in the runs channel";
  return s.reminders ? `${where} · reminder ${s.reminderMinutes} min before` : where;
}
