// A planned run's boss progress (WEB-97, board DL05; designer's rules 2026-11-07). One rule with the addon (CF-106,
// src/core/RunProgress.lua there), checked against its golden cases
// (tests/fixtures/addon-golden/run-progress-cases.json).
//
// A kill counts when its character is in the run's group (answered I'm in or Maybe, or organises), its encounter is
// one of the dungeon's bosses, and it is from BEFORE_START before the start until the first daily reset after the
// start. Optional bosses don't count towards "N of M"; cleared = the final boss died; on a cleared run an optional
// boss not killed is skipped.

/** Kills count from this long before the start. */
export const BEFORE_START = 60 * 60;
/** The addon drops a run without a kill from its list this long after the start (the site keeps every run). */
export const NO_BOSS_FOR = 3 * 60 * 60;

/** One boss kill of one character: from a record's `runs.*.bossKills`, a run in progress or a live kill (CF-103). */
export interface BossKill {
  guid: string;
  /** DungeonEncounter.ID, as ENCOUNTER_END gives it. */
  encounterId: number;
  /** Server time, Unix seconds. */
  at: number;
}

export interface ProgressBoss {
  id: number;
  final?: boolean;
  optional?: boolean;
}

export interface ProgressRun {
  startsAt: number;
  cancelled?: boolean;
  /** The characters of the run's group (runGroup). */
  group: ReadonlySet<string>;
}

export type ProgressState = "upcoming" | "noBoss" | "going" | "cleared";

export interface RunProgress {
  state: ProgressState;
  /** Per killed boss: the earliest counted kill (its time and whose log it came from). */
  killed: Map<number, { at: number; guid: string }>;
  /** Required bosses killed. */
  done: number;
  /** Required bosses (optional ones left out). */
  total: number;
  cleared: boolean;
  /** Optional bosses not killed on a cleared run. */
  skipped: Set<number>;
  firstKill?: number;
  /** In the addon's list (the site shows every run; kept for the shared cases). */
  visible: boolean;
  /** "3/6 bosses", "no boss yet"; undefined before the start. */
  label?: string;
}

/** The characters of a run's group: those who answered I'm in or Maybe, and the organiser's. */
export function runGroup(answers: readonly { guid?: string; answer: string }[], organiserGuid?: string): Set<string> {
  const set = new Set<string>();
  for (const a of answers) if (a.guid !== undefined && (a.answer === "in" || a.answer === "maybe")) set.add(a.guid);
  if (organiserGuid !== undefined) set.add(organiserGuid);
  return set;
}

export function runProgress(
  run: ProgressRun,
  bosses: readonly ProgressBoss[],
  kills: readonly BossKill[],
  now: number,
  resetAt: number,
): RunProgress {
  const byId = new Map(bosses.map((b) => [b.id, b]));
  const p: RunProgress = {
    state: "upcoming",
    killed: new Map(),
    done: 0,
    total: bosses.filter((b) => b.optional !== true).length,
    cleared: false,
    skipped: new Set(),
    visible: true,
  };
  for (const k of kills) {
    if (!byId.has(k.encounterId) || !run.group.has(k.guid)) continue;
    if (k.at < run.startsAt - BEFORE_START || k.at >= resetAt) continue;
    const seen = p.killed.get(k.encounterId);
    if (seen === undefined || k.at < seen.at) p.killed.set(k.encounterId, { at: k.at, guid: k.guid });
    if (p.firstKill === undefined || k.at < p.firstKill) p.firstKill = k.at;
  }
  for (const id of p.killed.keys()) {
    const b = byId.get(id)!;
    if (b.optional !== true) p.done += 1;
    if (b.final === true) p.cleared = true;
  }
  if (p.cleared) for (const b of bosses) if (b.optional === true && !p.killed.has(b.id)) p.skipped.add(b.id);
  if (p.killed.size > 0) {
    p.state = p.cleared ? "cleared" : "going";
    p.label = `${p.done}/${p.total} bosses`;
  } else if (now >= run.startsAt) {
    p.state = "noBoss";
    p.label = "no boss yet";
  }
  if (run.cancelled === true) p.visible = false;
  else if (p.state === "noBoss") p.visible = now < run.startsAt + NO_BOSS_FOR;
  else if (p.state !== "upcoming") p.visible = now < resetAt;
  return p;
}
