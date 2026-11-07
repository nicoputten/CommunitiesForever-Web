import type { LuaChunk, LuaValue } from "./lua";
import { entries, field, findGlobal, table, type Table } from "./normalize";
import type { BossKill } from "./runProgress";
import { stripEscapes } from "./sanitize";

// Boss kills in an upload (WEB-97, addon CF-103; docs/SOURCE-DATA.md): who killed which boss when, for a planned run's
// progress and the dungeon page's "Last cleared". Three places hold them:
// - each record's feed: `runs.*.bossKills = { [encounterID] = at }` on a finished run (the uploader's own and every
//   friend's record). Optional: older addons send a count only (`bosses`), which gives no kills (rule 4);
// - the uploader's runs in progress: `global.runs[guid].bosses = { [encounterID] = at }` (schema 3; schema 2 wrote
//   `true`, no time, so left out);
// - friends' kills shared live: `global.liveKills = { [guid] = { [encounterID] = at } }`.
// Untrusted like the rest of the file: encounter IDs must be whole and positive, times whole and positive; anything
// else is left out. The same kill from several places is kept once.

/** Kills read from one file at most (the addon keeps 40 per run and 2 days of live kills). */
export const MAX_KILLS = 5000;
/** Kills per run or per character at most. */
const MAX_PER_TABLE = 40;
/** The largest encounter ID taken (DungeonEncounter IDs are four digits; room to grow). */
const MAX_ENCOUNTER = 1_000_000;

const whole = (v: number) => Number.isInteger(v) && v > 0;

/** `{ [encounterID] = at }` as kills of `guid`. */
function killTable(guid: string, value: LuaValue | undefined, out: BossKill[]): void {
  for (const [key, at] of entries(table(value)).slice(0, MAX_PER_TABLE)) {
    const encounterId = Number(key);
    if (!whole(encounterId) || encounterId > MAX_ENCOUNTER || typeof at !== "number" || !whole(at)) continue;
    out.push({ guid, encounterId, at });
  }
}

function feedKills(feed: Table | undefined, out: BossKill[]): void {
  for (const [, chars] of entries(feed)) {
    for (const [guid, day] of entries(table(chars))) {
      for (const [, run] of entries(table(field(table(day), "runs"))))
        killTable(stripEscapes(guid), field(table(run), "bossKills"), out);
    }
  }
}

/** Every boss kill in a SavedVariables file, each (character, boss, time) once, at most MAX_KILLS. */
export function readBossKills(chunk: LuaChunk): BossKill[] {
  const global = findGlobal(chunk);
  if (global === undefined) return [];
  const out: BossKill[] = [];
  feedKills(table(field(table(field(global, "self")), "feed")), out);
  for (const [, person] of entries(table(field(global, "people")))) feedKills(table(field(table(person), "feed")), out);
  for (const [guid, run] of entries(table(field(global, "runs"))))
    killTable(stripEscapes(guid), field(table(run), "bosses"), out);
  for (const [guid, kills] of entries(table(field(global, "liveKills")))) killTable(stripEscapes(guid), kills, out);
  const seen = new Set<string>();
  return out
    .filter((k) => {
      const key = `${k.guid}|${k.encounterId}|${k.at}`;
      if (k.guid === "" || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_KILLS);
}
