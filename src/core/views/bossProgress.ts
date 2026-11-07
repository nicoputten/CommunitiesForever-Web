import { sameBattleTag } from "../access";
import { classInfo } from "../gamedata";
import { runDungeon, type RunRecord } from "../runs";
import { runGroup, runProgress, type BossKill, type ProgressBoss, type RunProgress } from "../runProgress";
import { dayLabel, localTime } from "../runTime";
import type { CharacterView, PersonView } from "./characters";
import { UNKNOWN_CHARACTER } from "./text";

// Boss progress on the site (WEB-97, boards DL04 and DL05): a run page's Bosses box once the run has started, "3 of 6
// bosses" on the dungeon page's Planned here, and "Last cleared" under Ran here. Kills come from uploads only
// (SavedVariables are written on /reload or logout), so while a run goes on the box says as of which upload.

export interface ProgressBossInfo extends ProgressBoss {
  name: string;
  final: boolean;
  optional: boolean;
  wingId?: string;
}

export type BossRowState = "killed" | "open" | "optional" | "skipped";

export interface BossRow {
  id: number;
  name: string;
  state: BossRowState;
  /** The kill's time in the viewer's zone ("20:18"). */
  time?: string;
  /** "Killed 20:31 · from Grom's log". */
  tip?: string;
}

export interface RunBossesView {
  /** "3 of 6", or "Cleared · 21:24" once the final boss died. */
  count: string;
  cleared: boolean;
  done: number;
  total: number;
  /** "as of 20:45 · Grom's upload" while the run goes on; gone once cleared. */
  asOf?: string;
  rows: BossRow[];
  /** The hero's "started" or "cleared" next to the time. */
  status: "started" | "cleared";
}

/** The newest upload by someone in the run's group: what the site last heard. */
export interface LatestUpload {
  at: number;
  /** The uploader's BattleTag. */
  by: string;
}

export interface ProgressContext {
  characters: readonly CharacterView[];
  people: readonly PersonView[];
  viewer: string;
  timeZone: string;
  now: number;
}

function friendName(ctx: ProgressContext, battleTag: string): string {
  const p = ctx.people.find((x) => sameBattleTag(x.battleTag ?? x.key, battleTag));
  return p?.displayName ?? battleTag.split("#")[0]!;
}

/** The characters of a run's group (I'm in, Maybe, and the organiser's lead). */
export function groupOf(run: RunRecord): Set<string> {
  return runGroup(run.answers);
}

/**
 * A run's bosses for its progress: a whole Stratholme or Dire Maul from before the wings (`whole`, WEB-102) counts
 * the wings it has kills in (every wing before the first kill); it is cleared when any wing's final boss dies.
 */
export function progressOf(
  run: RunRecord,
  bosses: readonly ProgressBossInfo[],
  kills: readonly BossKill[],
  now: number,
  resetAt: number,
): { progress: RunProgress; bosses: readonly ProgressBossInfo[] } {
  const r = { startsAt: run.startsAt, cancelled: run.cancelledAt !== undefined, group: groupOf(run) };
  const all = runProgress(r, bosses, kills, now, resetAt);
  if (runDungeon(run.dungeonId)?.whole !== true || all.killed.size === 0) return { progress: all, bosses };
  const wings = new Set(bosses.filter((b) => all.killed.has(b.id)).map((b) => b.wingId));
  const touched = bosses.filter((b) => wings.has(b.wingId));
  return { progress: runProgress(r, touched, kills, now, resetAt), bosses: touched };
}

/** The run page's Bosses box; undefined before the start (and before the first kill), or without bosses. */
export function runBosses(
  run: RunRecord,
  bosses: readonly ProgressBossInfo[],
  kills: readonly BossKill[],
  resetAt: number,
  latest: LatestUpload | undefined,
  ctx: ProgressContext,
): RunBossesView | undefined {
  if (bosses.length === 0 || run.cancelledAt !== undefined) return undefined;
  const { progress: p, bosses: shown } = progressOf(run, bosses, kills, ctx.now, resetAt);
  if (p.state === "upcoming") return undefined;
  const byGuid = new Map(ctx.characters.map((c) => [c.guid, c]));
  const whose = (guid: string) => {
    const owner = byGuid.get(guid)?.owner;
    if (owner === undefined) return byGuid.get(guid)?.name ?? UNKNOWN_CHARACTER;
    return sameBattleTag(owner, ctx.viewer) ? "your" : `${friendName(ctx, owner)}’s`;
  };
  const rows = shown.map((b): BossRow => {
    const kill = p.killed.get(b.id);
    if (kill !== undefined) {
      const time = localTime(kill.at, ctx.timeZone);
      return { id: b.id, name: b.name, state: "killed", time, tip: `Killed ${time} · from ${whose(kill.guid)} log` };
    }
    return { id: b.id, name: b.name, state: b.optional ? (p.skipped.has(b.id) ? "skipped" : "optional") : "open" };
  });
  const finalKill = shown.filter((b) => b.final && p.killed.has(b.id)).map((b) => p.killed.get(b.id)!.at);
  const view: RunBossesView = {
    count: p.cleared ? `Cleared · ${localTime(Math.min(...finalKill), ctx.timeZone)}` : `${p.done} of ${p.total}`,
    cleared: p.cleared,
    done: p.done,
    total: p.total,
    rows,
    status: p.cleared ? "cleared" : "started",
  };
  if (!p.cleared && latest !== undefined)
    view.asOf = `as of ${localTime(latest.at, ctx.timeZone)} · ${friendName(ctx, latest.by)}’s upload`;
  return view;
}

/** "3 of 6 bosses" for Planned here once the run has a kill; undefined before. */
export function plannedBosses(
  run: RunRecord,
  bosses: readonly ProgressBossInfo[],
  kills: readonly BossKill[],
  now: number,
  resetAt: number,
): string | undefined {
  if (bosses.length === 0) return undefined;
  const { progress: p } = progressOf(run, bosses, kills, now, resetAt);
  if (p.state === "cleared") return "cleared";
  return p.state === "going" ? `${p.done} of ${p.total} bosses` : undefined;
}

export interface LastCleared {
  /** "Today", "Tue", "Sat 24 Oct". */
  day: string;
  /** The characters who killed the final boss together, in their class colours. */
  group: { guid: string; name: string; colorToken?: string }[];
}

/** Kills of the same boss this close together are one group's. */
export const SAME_KILL_SECONDS = 10 * 60;
const WEEK = 7 * 24 * 60 * 60;

/**
 * When a dungeon was last cleared: the newest kill of a final boss in anyone's kill log, with the characters who
 * killed it then (designer's rules, 2026-11-07). Undefined when no log shows one.
 */
export function lastCleared(
  bosses: readonly ProgressBossInfo[],
  kills: readonly BossKill[],
  ctx: ProgressContext,
): LastCleared | undefined {
  const finals = new Set(bosses.filter((b) => b.final).map((b) => b.id));
  let newest: BossKill | undefined;
  for (const k of kills) if (finals.has(k.encounterId) && (newest === undefined || k.at > newest.at)) newest = k;
  if (newest === undefined) return undefined;
  const byGuid = new Map(ctx.characters.map((c) => [c.guid, c]));
  const guids = [
    ...new Set(
      kills
        .filter((k) => k.encounterId === newest.encounterId && Math.abs(k.at - newest.at) <= SAME_KILL_SECONDS)
        .map((k) => k.guid),
    ),
  ];
  const label = dayLabel(newest.at, ctx.timeZone, ctx.now);
  return {
    day: label === "Today" || ctx.now - newest.at >= WEEK - 24 * 60 * 60 ? label : label.split(" ")[0]!,
    group: guids
      .map((guid) => {
        const c = byGuid.get(guid);
        const g: LastCleared["group"][number] = { guid, name: c?.name ?? UNKNOWN_CHARACTER };
        const token = classInfo(c?.classFile)?.textToken;
        if (token !== undefined) g.colorToken = token;
        return g;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "en")),
  };
}
