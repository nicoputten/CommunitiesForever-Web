import type { Faction } from "../gamedata";
import type { RollCallFilter } from "./rollCall";
import { LEVEL_RANGES, type SearchParams } from "./rosterQuery";

// The roll call's filters as they live in the map's URL (WEB-27, decided with Nico 2026-10-27), so Back undoes a
// filter and the map shows the same characters: /?friend=Bob%232002&new=1&faction=horde&level=30-39. They sit next
// to the map's own `continent` and `character`. Anything unknown in the URL is ignored, never an error.

export interface RollCallQuery {
  /** Person key. */
  friend?: string;
  /** The "New" chip. */
  liveOnly: boolean;
  faction?: Faction;
  /** A LEVEL_RANGES key (the roster's level menu). */
  level?: string;
}

export type RollCallParam = "friend" | "new" | "faction" | "level";

export const ROLL_CALL_PARAMS: readonly RollCallParam[] = ["friend", "new", "faction", "level"];

const FACTIONS: Readonly<Record<string, Faction>> = { horde: "Horde", alliance: "Alliance" };

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export function parseRollCallQuery(params: SearchParams): RollCallQuery {
  const friend = first(params.friend);
  const faction = FACTIONS[first(params.faction)?.toLowerCase() ?? ""];
  const level = first(params.level);
  const query: RollCallQuery = { liveOnly: first(params.new) === "1" };
  if (friend !== undefined && friend !== "" && friend.length <= 64) query.friend = friend;
  if (faction !== undefined) query.faction = faction;
  if (LEVEL_RANGES.some((r) => r.key === level)) query.level = level;
  return query;
}

/** The view model's filter for a query. */
export function rollCallFilter(q: RollCallQuery): RollCallFilter {
  const filter: RollCallFilter = {};
  if (q.friend !== undefined) filter.person = q.friend;
  if (q.liveOnly) filter.liveOnly = true;
  if (q.faction !== undefined) filter.faction = q.faction;
  const range = LEVEL_RANGES.find((r) => r.key === q.level);
  if (range !== undefined) {
    filter.minLevel = range.min;
    filter.maxLevel = range.max;
  }
  return filter;
}

/** Any filter set: the map shows only the matching characters. */
export function isRollCallFiltered(q: RollCallQuery): boolean {
  return q.friend !== undefined || q.liveOnly || q.faction !== undefined || q.level !== undefined;
}

/** The URL parameters of a query; undefined removes one. */
export function rollCallParams(q: RollCallQuery): Record<RollCallParam, string | undefined> {
  return {
    friend: q.friend,
    new: q.liveOnly ? "1" : undefined,
    faction: q.faction?.toLowerCase(),
    level: q.level,
  };
}
