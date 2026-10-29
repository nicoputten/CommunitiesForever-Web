import type { FeedDay } from "../feed";
import type { Character, Dataset } from "../model";
import { PROFESSIONS } from "../gamedata/professions";
import {
  DEATHS_FEAT,
  DUEL_WIN_STEPS,
  type FeatFields,
  type FeatKind,
  featText,
  HONOR_KILL_STEPS,
  MAX_PVP_RANK,
  PVP_RANKS,
} from "./feats";
import type { GoalRecord } from "./record";
import {
  crown as crownOf,
  dayLabel,
  dayOf,
  dayStart,
  draw,
  drawWeek,
  duels as duelsOf,
  type DuelRecord,
  type DuelResult,
  elo,
  finishedAt,
  goal,
  goalPoints,
  goalsForDay,
  goalsForWeek,
  type Kill,
  ladder,
  POINTS,
  type Schedule,
  type ScoredKill,
  scoreKills,
  type Situation,
  streak,
  weekOf,
  weekStart,
  zoneFor,
} from "./rules";
import type {
  DoomsdaySnapshot,
  FeatProgress,
  FeatRecord,
  FriendDoomsday,
  FriendGoal,
  GoalRef,
  GoalSlot,
  LadderRow,
  PvpDetails,
  TrackLadders,
} from "./snapshot";

// The Doomsday engine (WEB-58): everything the pages, the bot's events and look-up and the recap show, computed from
// what the site stores (each friend's goals, the activity feed, the merged data, the feats). Pure: the server gathers
// the input (src/server/doomsday.ts). Points are counted here, never taken from an addon total (DOOMSDAY.md "Who
// decides done"): goals from the stored `done`, kills and duels from the raw feed with the rules of rules.ts.

/** Defaults of the site settings (Nico, 2026-10-28). */
export const DEFAULT_TIME_ZONE = "Europe/Paris";
export const DEFAULT_RESET_SECONDS = 68400;
/** How many Doomsday days the heatmap shows (12 weeks). */
export const HEATMAP_DAYS = 84;

/** The reset setting: a change takes effect from the next reset under the old one, never in the middle of a day. */
export interface ResetSetting {
  reset: number;
  /** The reset before the last change, and when it was changed. */
  previous?: number;
  changedAt?: number;
}

/** A feat the site holds (the `feats` table). */
export interface StoredFeat {
  guid: string;
  key: string;
  kind: FeatKind;
  owner: string;
  at: number;
  alreadyHad: boolean;
  firstInGroup: boolean;
  fields: FeatFields;
}

export interface DoomsdayInput {
  now: number;
  timeZone: string;
  reset: ResetSetting;
  data: Dataset;
  /** Per person key: the goals the site stored (WEB-55). */
  goals: Readonly<
    Record<string, { days: Record<number, GoalRecord>; weeks: Record<number, GoalRecord>; best?: number }>
  >;
  /** Every stored feed day of every character. */
  feed: readonly { guid: string; owner: string; day: number; entry: FeedDay }[];
  feats: readonly StoredFeat[];
}

// --- time ------------------------------------------------------------------------------------------------------

/** A time zone's offset from UTC in seconds at a moment (IANA zone; UTC for an unknown one). */
export function zoneOffset(timeZone: string, at: number): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(at * 1000));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((local / 1000 - at) / 60) * 60;
  } catch {
    return 0;
  }
}

/**
 * The next change of a time zone's UTC offset after `now` (daylight saving), within `horizon` seconds: when, and the
 * offset after it. Undefined for a zone without one.
 */
export function nextZoneChange(
  timeZone: string,
  now: number,
  horizon = 400 * 86400,
): { at: number; offset: number } | undefined {
  const start = zoneOffset(timeZone, now);
  // Daily steps find the day, then a binary search finds the second.
  for (let t = now + 86400; t <= now + horizon; t += 86400) {
    if (zoneOffset(timeZone, t) === start) continue;
    let lo = t - 86400;
    let hi = t;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (zoneOffset(timeZone, mid) === start) lo = mid;
      else hi = mid;
    }
    return { at: hi, offset: zoneOffset(timeZone, hi) };
  }
  return undefined;
}

/** When a changed reset takes effect: the first reset (under the old time) after the change; 0 when never changed. */
export function effectiveFrom(setting: ResetSetting, timeZone: string): number {
  if (setting.previous === undefined || setting.changedAt === undefined) return 0;
  const old: Schedule = { offset: zoneOffset(timeZone, setting.changedAt), reset: setting.previous };
  return dayStart(dayOf(setting.changedAt, old) + 1, old);
}

/** The reset in force at `at`: a change applies from the first reset (under the old time) after it was made. */
export function effectiveReset(setting: ResetSetting, at: number, timeZone: string): number {
  if (setting.previous === undefined || setting.changedAt === undefined) return setting.reset;
  return at >= effectiveFrom(setting, timeZone) ? setting.reset : setting.previous;
}

/** The schedule in force at `now`. */
export function scheduleAt(timeZone: string, reset: ResetSetting, now: number): Required<Schedule> {
  return { offset: zoneOffset(timeZone, now), reset: effectiveReset(reset, now, timeZone) };
}

// --- goals -----------------------------------------------------------------------------------------------------

const SLOTS: Record<string, GoalSlot> = {
  daily: "pveDaily",
  weekly: "pveWeekly",
  skirmish: "skirmish",
  bounty: "bounty",
};

/** A goal for the screens: the catalogue's title; an unknown id is "a goal from a newer version" and still counts. */
export function goalRef(id: string, zone?: string): GoalRef {
  const g = goal(id);
  if (g === undefined) {
    const hunt = id.startsWith("hunt");
    return {
      id,
      track: hunt ? "pvp" : "pve",
      slot: hunt ? "hunt" : "pveDaily",
      title: "A goal from a newer version",
      known: false,
    };
  }
  const title =
    zone !== undefined ? g.text.replace("the zone of the day", zone).replace("the zone of the week", zone) : g.text;
  return {
    id,
    track: g.slot === "daily" || g.slot === "weekly" ? "pve" : "pvp",
    slot: SLOTS[g.slot]!,
    title,
    known: true,
  };
}

const MAX_LEVEL = 60;

/** A friend's situation from their characters (DOOMSDAY.md "Swaps"); what the site can't tell stays unknown. */
export function situationOf(chars: readonly Character[], highestToday?: number): Situation {
  const levels = chars.map((c) => c.level).filter((l): l is number => l !== undefined);
  const s: Situation = {};
  if (chars.length > 0) s.chars = chars.length;
  if (levels.length === chars.length && levels.length > 0) {
    const highest = Math.max(...levels);
    s.highest = highest;
    s.below60 = levels.filter((l) => l < MAX_LEVEL).length;
    const top = levels.indexOf(highest);
    s.altBelow60 = levels.filter((l, i) => i !== top && l < MAX_LEVEL).length;
  }
  if (highestToday !== undefined) s.highestToday = highestToday;
  const profs = chars.flatMap((c) => Object.entries(c.professions));
  if (chars.length > 0) {
    s.hasProfession = profs.length > 0;
    s.hasFishing = profs.some(([id]) => id === "356");
    s.hasCraftingProfession = profs.some(([id]) => {
      const p = PROFESSIONS[Number(id)];
      return p?.kind === "primary" && !["Herbalism", "Mining", "Skinning"].includes(p.name);
    });
    s.professionBelow300 = profs.some(([, p]) => (p.rank ?? 0) < 300);
  }
  return s;
}

// --- per friend ------------------------------------------------------------------------------------------------

interface Friend {
  key: string;
  name: string;
  hasRecord: boolean;
  chars: Character[];
  goals?: DoomsdayInput["goals"][string];
  kills: ScoredKill[];
  deaths: { t: number; char: string }[];
  killedEver: boolean;
}

/** Points of a friend's goals done in a set of day and week records. */
function goalPointsOf(records: readonly (GoalRecord | undefined)[]): { pve: number; pvp: number; goals: number } {
  const out = { pve: 0, pvp: 0, goals: 0 };
  for (const r of records) {
    for (const id of Object.keys(r?.done ?? {})) {
      const p = goalPoints(id);
      if (p === undefined) continue;
      out[p.track] += p.points;
      out.goals++;
    }
  }
  return out;
}

const sum = (list: readonly number[]) => list.reduce((a, b) => a + b, 0);

/** What every computation shares: each friend's scored kills and deaths, every duel, and their totals. */
export function prepare(input: DoomsdayInput) {
  const { now, data } = input;
  const s = scheduleAt(input.timeZone, input.reset, now);

  // Characters of the community by full name (never split): their deaths don't count as kills, and duels against
  // them are the Duel slot.
  const community = new Set<string>();
  const owner = new Map<string, string>();
  for (const c of Object.values(data.characters)) {
    if (c.name === undefined) continue;
    community.add(c.name);
    if (c.owner !== undefined) owner.set(c.name, c.owner);
  }

  const people = Object.values(data.people).sort((a, b) => a.displayName.localeCompare(b.displayName, "en"));
  const friends: Friend[] = people.map((p) => {
    const chars = Object.values(data.characters).filter((c) => c.owner === p.key && c.hasRecord);
    const kills: Kill[] = [];
    const deaths: { t: number; char: string }[] = [];
    for (const f of input.feed) {
      if (f.owner !== p.key) continue;
      for (const k of f.entry.pvpKills ?? []) kills.push({ ...k, char: f.guid });
      for (const d of f.entry.deaths ?? []) if (d.t !== undefined) deaths.push({ t: d.t, char: f.guid });
    }
    const scored = scoreKills(kills, s, community);
    const killedEver = kills.length > 0 || chars.some((c) => (c.pvp?.hk ?? 0) > 0);
    const goals = input.goals[p.key];
    return {
      key: p.key,
      name: p.displayName,
      hasRecord: p.hasRecord,
      chars,
      ...(goals !== undefined ? { goals } : {}),
      kills: scored,
      deaths,
      killedEver,
    };
  });
  const byKey = new Map(friends.map((f) => [f.key, f]));
  const active = friends.filter((f) => f.goals !== undefined);

  // Duels: every friend's records, the Duel slot per pair and day.
  const records: DuelRecord[] = [];
  for (const f of input.feed) {
    for (const d of f.entry.duels ?? []) {
      if (d.t !== undefined && d.won !== undefined && d.vs !== undefined) {
        records.push({ friend: f.owner, t: d.t, won: d.won, vs: d.vs });
      }
    }
  }
  const allDuels = duelsOf(records, owner, s).duels;
  const duelPoints = (key: string, test: (d: DuelResult) => boolean) =>
    sum(
      allDuels
        .filter((d) => test(d) && !d.disputed && (d.a === key || d.b === key))
        .map((d) => (d.winner === key ? POINTS.duelWin : POINTS.duelLoss)),
    );

  const killPoints = (f: Friend, test: (k: ScoredKill) => boolean) =>
    sum(f.kills.filter((k) => k.track === "pvp" && k.counted && test(k)).map((k) => k.points));
  const killApprox = (f: Friend, test: (k: ScoredKill) => boolean) =>
    f.kills.some(
      (k) =>
        k.track === "pvp" &&
        k.counted &&
        test(k) &&
        k.kill.lvl !== -1 &&
        (k.kill.lvl === undefined || k.kill.myLvl === undefined),
    );

  const totals = (f: Friend, days: (n: number) => boolean, weeks: (w: number) => boolean) => {
    const dayRecords = Object.entries(f.goals?.days ?? {})
      .filter(([n]) => days(Number(n)))
      .map(([, r]) => r);
    const weekRecords = Object.entries(f.goals?.weeks ?? {})
      .filter(([w]) => weeks(Number(w)))
      .map(([, r]) => r);
    const g = goalPointsOf([...dayRecords, ...weekRecords]);
    const kills = killPoints(f, (k) => days(k.day));
    const duel = duelPoints(f.key, (d) => days(d.day));
    return {
      pve: g.pve,
      pvp: g.pvp + kills + duel,
      goals: g.goals,
      kills: f.kills.filter((k) => k.track === "pvp" && k.counted && days(k.day)).length,
    };
  };
  return { s, friends, byKey, active, allDuels, records, owner, duelPoints, killPoints, killApprox, totals };
}

/** Per friend with Doomsday data: points per track, goals done and counted kills over some days and weeks. */
export function periodTotals(
  input: DoomsdayInput,
  days: (n: number) => boolean,
  weeks: (w: number) => boolean,
): { key: string; name: string; pve: number; pvp: number; goals: number; kills: number; killedEver: boolean }[] {
  const p = prepare(input);
  return p.active.map((f) => ({ key: f.key, name: f.name, killedEver: f.killedEver, ...p.totals(f, days, weeks) }));
}

/** The whole snapshot for `now`. */
export function doomsdaySnapshot(input: DoomsdayInput): DoomsdaySnapshot {
  const { now } = input;
  const { s, friends, byKey, active, allDuels, duelPoints, killApprox, totals } = prepare(input);
  const today = dayOf(now, s);
  const week = weekOf(today);
  const firstOfWeek = weekStart(week);
  const inWeek = (n: number) => n >= firstOfWeek && n < firstOfWeek + 7;

  // --- today and this week's goals ---
  const dayDraw = draw(today);
  const weekDraw = drawWeek(week);
  const todayGoals = [...dayDraw.dailies, ...(dayDraw.skirmish !== undefined ? [dayDraw.skirmish] : [])].map((id) =>
    goalRef(id),
  );
  const weekGoals = [...weekDraw.weeklies, ...(weekDraw.bounty !== undefined ? [weekDraw.bounty] : [])].map((id) =>
    goalRef(id),
  );

  const friendGoals = (
    set: readonly string[],
    swapped: Readonly<Record<string, string>>,
    done: Readonly<Record<string, number>>,
    zone: string | undefined,
    progress: (id: string) => FriendGoal["progress"],
  ): FriendGoal[] =>
    set.map((id) => {
      const original = swapped[id];
      const ref = goalRef(id, id === "p.frontLine" || id === "b.zone25" ? zone : undefined);
      const g: FriendGoal = { goal: ref, columnId: original ?? id, points: goalPoints(id)?.points ?? 0 };
      if (original !== undefined) g.swappedFrom = goalRef(original);
      if (done[id] !== undefined) g.doneAt = done[id];
      const p = progress(id);
      if (p !== undefined) g.progress = p;
      return g;
    });

  /** Progress of the kill goals, exact from the raw kills (PvE goals: the addon sends none). */
  const killProgress = (f: Friend, inPeriod: (n: number) => boolean, zone: string | undefined) => {
    const counted = f.kills.filter((k) => k.track === "pvp" && k.counted && inPeriod(k.day));
    return (id: string): FriendGoal["progress"] => {
      const of = (value: number, target: number) => ({ value: Math.min(value, target), target });
      switch (id) {
        case "p.loneWolf":
          return of(counted.filter((k) => k.kill.solo === true).length, 3);
        case "p.frontLine":
          return zone === undefined ? undefined : of(counted.filter((k) => k.kill.zone === zone).length, 5);
        case "b.zone25":
          return zone === undefined ? undefined : of(counted.filter((k) => k.kill.zone === zone).length, 25);
        case "b.kills50":
          return of(counted.length, 50);
        case "b.days5":
          return of(new Set(counted.map((k) => k.day)).size, 5);
        case "b.duels3": {
          const opponents = new Set(
            allDuels
              .filter((d) => inPeriod(d.day) && (d.a === f.key || d.b === f.key))
              .map((d) => (d.a === f.key ? d.b : d.a)),
          );
          return of(opponents.size, 3);
        }
        default:
          return undefined;
      }
    };
  };

  // --- friends ---
  const out: FriendDoomsday[] = friends.map((f) => {
    const status = !f.hasRecord ? "noAddon" : f.goals === undefined ? "noDoomsday" : "active";
    const base: FriendDoomsday = { friendKey: f.key, name: f.name, status, pvpVirgin: f.hasRecord && !f.killedEver };
    if (status !== "active" || f.goals === undefined) return base;

    const situation = situationOf(f.chars);
    const dayRecord = f.goals.days[today];
    const daySet =
      dayRecord !== undefined && dayRecord.set.length > 0 ? dayRecord : { ...goalsForDay(today, situation), done: {} };
    const dayZone = zoneFor(today, 4, situation.highestToday ?? situation.highest);
    const done = dayRecord?.done ?? {};
    const weekRecord = f.goals.weeks[week];
    const weekSet =
      weekRecord !== undefined && weekRecord.set.length > 0
        ? weekRecord
        : { ...goalsForWeek(week, situation), done: {} };
    const weekZone = zoneFor(week, 5, situation.highest);

    const first: NonNullable<FriendDoomsday["today"]>["duels"]["first"] = [];
    for (const d of allDuels.filter((d) => d.day === today && (d.a === f.key || d.b === f.key))) {
      const other = d.a === f.key ? d.b : d.a;
      first.push({
        friendKey: other,
        name: byKey.get(other)?.name ?? other,
        result: d.disputed ? "disputed" : d.winner === f.key ? "won" : "lost",
        at: d.t,
      });
    }
    const duelled = new Set(first.map((d) => d.friendKey));
    const finished = finishedAt(daySet.set, done);

    const dayDays = (n: number) => n === today;
    const weekDays = (n: number) => inWeek(n);
    const t = totals(f, dayDays, () => false);
    const w = totals(f, weekDays, (x) => x === week);
    const all = totals(
      f,
      () => true,
      () => true,
    );

    const doneByDay: Record<number, number> = {};
    for (const [n, r] of Object.entries(f.goals.days)) doneByDay[Number(n)] = Object.keys(r.done).length;
    const st = streak(doneByDay, today, f.goals.best ?? 0);

    const heatmap: (number | null)[] = [];
    for (let n = today - HEATMAP_DAYS + 1; n <= today; n++) {
      const r = f.goals.days[n];
      heatmap.push(r === undefined ? null : Object.keys(r.done).length);
    }

    const friend: FriendDoomsday = {
      ...base,
      today: {
        goals: friendGoals(daySet.set, daySet.swapped, done, dayZone, killProgress(f, dayDays, dayZone)),
        ...(finished !== undefined ? { finishedAt: finished } : {}),
        duels: {
          first,
          open: active
            .filter((o) => o.key !== f.key && !duelled.has(o.key))
            .map((o) => ({ friendKey: o.key, name: o.name })),
          points: duelPoints(f.key, (d) => dayDays(d.day)),
        },
      },
      week: {
        goals: friendGoals(
          weekSet.set,
          weekSet.swapped,
          weekRecord?.done ?? {},
          weekZone,
          killProgress(f, weekDays, weekZone),
        ),
      },
      points: {
        today: { pve: t.pve, pvp: t.pvp },
        week: { pve: w.pve, pvp: w.pvp },
        allTime: { pve: all.pve, pvp: all.pvp },
        ...(killApprox(f, () => true) ? { approx: { pvp: true } } : {}),
      },
      streak: { current: st.streak, best: st.best },
      heatmap,
      pvp: pvpDetails(f, weekDays, firstOfWeek, allDuels, byKey, input, s),
      featProgress: featProgress(f, input.feats),
    };
    return friend;
  });

  // --- crown, ladders ---
  const crown = crownOf(
    active.map((f) => {
      const r = f.goals!.days[today];
      return { friend: f.key, set: r?.set ?? [], done: r?.done ?? {} };
    }),
  );

  const ladderOf = (
    days: (n: number) => boolean,
    weeks: (w: number) => boolean,
    previous?: TrackLadders,
  ): TrackLadders => {
    const input = active.map((f) => {
      const t = totals(f, days, weeks);
      return {
        friend: f.key,
        name: f.name,
        pve: t.pve,
        pvp: t.pvp,
        goals: t.goals,
        kills: t.kills,
        killedEver: f.killedEver,
      };
    });
    const prev = previous && {
      pve: Object.fromEntries(previous.pve.map((r) => [r.friendKey, r.place])),
      pvp: Object.fromEntries(previous.pvp.map((r) => [r.friendKey, r.place])),
    };
    const ranked = ladder(input, prev);
    const rows = (track: "pve" | "pvp") =>
      ranked[track].map((r): LadderRow => {
        const f = byKey.get(r.friend)!;
        const row: LadderRow = {
          friendKey: r.friend,
          name: f.name,
          place: r.rank,
          points: r.points,
          characters:
            track === "pvp"
              ? f.chars
                  .map((c) => ({
                    guid: c.guid,
                    name: c.name ?? "A character",
                    ...(c.classFile !== undefined ? { classFile: c.classFile } : {}),
                    points: sum(
                      f.kills
                        .filter((k) => k.kill.char === c.guid && k.track === "pvp" && k.counted && days(k.day))
                        .map((k) => k.points),
                    ),
                  }))
                  .filter((c) => c.points > 0)
                  .sort((a, b) => b.points - a.points)
              : [],
        };
        if (track === "pvp" && killApprox(f, (k) => days(k.day))) row.approx = true;
        if (previous !== undefined) {
          row.movement =
            r.move === "new"
              ? { kind: "new" }
              : r.move === 0
                ? { kind: "same" }
                : r.move > 0
                  ? { kind: "up", by: r.move }
                  : { kind: "down", by: -r.move };
        }
        return row;
      });
    return { pve: rows("pve"), pvp: rows("pvp") };
  };
  const lastWeekDays = (n: number) => n >= firstOfWeek - 7 && n < firstOfWeek;
  const lastWeek = ladderOf(lastWeekDays, (x) => x === week - 1);

  return {
    now,
    schedule: {
      timeZone: input.timeZone,
      resetSeconds: s.reset,
      day: today,
      dayStart: dayStart(today, s),
      nextReset: dayStart(today + 1, s),
      week,
      weekReset: dayStart(weekStart(week + 1), s),
    },
    todayGoals,
    hunts: {},
    weekGoals,
    friends: out,
    ...(crown !== undefined ? { crown: { friendKey: crown.friend, at: crown.at } } : {}),
    ladders: {
      week: ladderOf(
        (n) => inWeek(n),
        (x) => x === week,
        lastWeek,
      ),
      allTime: ladderOf(
        () => true,
        () => true,
      ),
    },
    feats: featRecords(input),
  };
}

/** "Wed 4 Nov", the label of a Doomsday day. */
export { dayLabel };

// --- PvP details -----------------------------------------------------------------------------------------------

const BATTLEGROUNDS = ["Warsong Gulch", "Arathi Basin", "Alterac Valley"];

function pvpDetails(
  f: Friend,
  inWeek: (n: number) => boolean,
  firstOfWeek: number,
  allDuels: readonly DuelResult[],
  byKey: ReadonlyMap<string, Friend>,
  input: DoomsdayInput,
  s: Schedule,
): PvpDetails {
  const week = f.kills.filter((k) => k.track === "pvp" && k.counted && inWeek(k.day));
  const zones = new Map<string, number>();
  for (const k of week) if (k.kill.zone !== undefined) zones.set(k.kill.zone, (zones.get(k.kill.zone) ?? 0) + 1);
  const highest = (guid: string) =>
    Math.max(0, ...input.feats.filter((x) => x.guid === guid && x.kind === "pvpRank").map((x) => x.fields.rank ?? 0));
  const mine = allDuels.filter((d) => !d.disputed && (d.a === f.key || d.b === f.key));
  const vs = new Map<string, { won: number; lost: number }>();
  for (const d of mine) {
    const other = d.a === f.key ? d.b : d.a;
    const v = vs.get(other) ?? { won: 0, lost: 0 };
    if (d.winner === f.key) v.won++;
    else v.lost++;
    vs.set(other, v);
  }
  const ratings = elo(allDuels);
  // The change this week: against the rating before the week began.
  const before = elo(allDuels.filter((d) => d.day < firstOfWeek));
  const ranked = Object.entries(ratings).sort((a, b) => b[1] - a[1]);
  const place = ranked.findIndex(([k]) => k === f.key) + 1;

  // The battleground block: runs from the feed, kills on the battleground track.
  const games = new Map<string, { won: number; lost: number; kills: number; points: number }>();
  const block = (name: string) => {
    let g = games.get(name);
    if (g === undefined) {
      g = { won: 0, lost: 0, kills: 0, points: 0 };
      games.set(name, g);
    }
    return g;
  };
  for (const fd of input.feed) {
    if (fd.owner !== f.key) continue;
    for (const run of fd.entry.runs) {
      if (run.kind !== "pvp" || run.name === undefined || run.won === undefined) continue;
      const at = fd.entry.at;
      if (at === undefined || !inWeek(dayOf(at, s))) continue;
      const g = block(run.name);
      if (run.won) g.won++;
      else g.lost++;
    }
  }
  for (const k of f.kills) {
    if (k.track !== "bg" || !k.counted || !inWeek(k.day)) continue;
    const g = block(k.kill.zone ?? "Battleground");
    g.kills++;
    g.points += k.points;
  }

  const details: PvpDetails = {
    week: {
      kills: week.length,
      solo: week.filter((k) => k.kill.solo === true).length,
      skulls: week.filter((k) => k.kill.lvl === -1).length,
      ...(week.some((k) => k.kill.lvl === undefined || k.kill.myLvl === undefined) ? { approx: true } : {}),
    },
    byZone: [...zones.entries()]
      .map(([zone, kills]) => ({ zone, kills }))
      .sort((a, b) => b.kills - a.kills || a.zone.localeCompare(b.zone)),
    characters: f.chars.map((c) => {
      const out: PvpDetails["characters"][number] = { guid: c.guid, name: c.name ?? "A character" };
      if (c.classFile !== undefined) out.classFile = c.classFile;
      if (c.faction === "Horde" || c.faction === "Alliance") out.faction = c.faction;
      if (c.pvp?.rank !== undefined) out.rank = c.pvp.rank;
      const h = Math.max(highest(c.guid), c.pvp?.rank ?? 0);
      if (c.pvp?.rank !== undefined || h > 0) out.highestRank = h;
      return out;
    }),
    duels: {
      won: mine.filter((d) => d.winner === f.key).length,
      lost: mine.filter((d) => d.winner !== f.key).length,
      vs: [...vs.entries()].map(([k, v]) => ({ friendKey: k, name: byKey.get(k)?.name ?? k, ...v })),
      ...(ratings[f.key] !== undefined
        ? {
            elo: {
              rating: Math.round(ratings[f.key]!),
              change: Math.round(ratings[f.key]! - (before[f.key] ?? 1000)),
              place,
            },
          }
        : {}),
    },
    battlegrounds: [...games.entries()]
      .filter(([name]) => BATTLEGROUNDS.includes(name))
      .map(([name, g]) => ({ name, ...g })),
    firstWins: input.feats
      .filter((x) => x.owner === f.key && x.kind === "bgFirstWin" && x.fields.battleground !== undefined)
      .map((x) => x.fields.battleground!),
  };
  return details;
}

// --- feats -----------------------------------------------------------------------------------------------------

function featRecords(input: DoomsdayInput): FeatRecord[] {
  return [...input.feats]
    .sort((a, b) => b.at - a.at || a.guid.localeCompare(b.guid) || a.key.localeCompare(b.key))
    .map((f) => {
      const c = input.data.characters[f.guid];
      const name = c?.name ?? "A character";
      const profession = f.kind === "professionCap" ? PROFESSIONS[Number(f.key.split(":")[1])]?.name : undefined;
      const t = featText({ kind: f.kind, fields: f.fields, ...(profession !== undefined ? { profession } : {}) }, name);
      const record: FeatRecord = {
        id: `${f.guid}:${f.key}`,
        kind: f.kind,
        friendKey: f.owner,
        character: { guid: f.guid, name, ...(c?.classFile !== undefined ? { classFile: c.classFile } : {}) },
        at: f.at,
        // Display-ready (WEB-60): "Stone Guard, a.k.a. Mailbox Menace", "First epic: <item>".
        title:
          f.kind === "pvpRank"
            ? `${t.title}, ${t.line}`
            : f.kind === "firstEpic" && f.fields.item?.name !== undefined
              ? `First epic: ${f.fields.item.name}`
              : t.title,
        firstInGroup: f.firstInGroup,
        alreadyHad: f.alreadyHad,
      };
      const detail = f.kind === "pvpRank" ? undefined : (t.flavour ?? t.line);
      if (detail !== undefined && detail !== record.title) record.detail = detail;
      if (f.kind === "firstEpic" && f.fields.item?.name !== undefined) record.epicItem = f.fields.item.name;
      if (f.kind === "pvpRank" && f.fields.rank !== undefined) record.rank = f.fields.rank;
      return record;
    });
}

function nextStep(steps: readonly number[], value: number): number | undefined {
  return steps.find((s) => s > value);
}

function featProgress(f: Friend, feats: readonly StoredFeat[]): FeatProgress[] {
  const out: FeatProgress[] = [];
  const best = (pick: (c: Character) => number | undefined) =>
    f.chars
      .map((c) => ({ c, v: pick(c) }))
      .filter((x): x is { c: Character; v: number } => x.v !== undefined)
      .sort((a, b) => b.v - a.v)[0];
  const who = (c: Character) => ({
    guid: c.guid,
    name: c.name ?? "A character",
    ...(c.classFile !== undefined ? { classFile: c.classFile } : {}),
  });

  const hk = best((c) => c.pvp?.hk);
  if (hk !== undefined) {
    const next = nextStep(HONOR_KILL_STEPS, hk.v);
    if (next !== undefined) {
      out.push({
        kind: "honorKills",
        title: `${next.toLocaleString("en-US")} honorable kills`,
        character: who(hk.c),
        progress: { value: hk.v, target: next },
      });
    }
  }
  const wins = best((c) => c.pvp?.duelsWon);
  if (wins !== undefined) {
    const next = nextStep(DUEL_WIN_STEPS, wins.v);
    if (next !== undefined)
      out.push({
        kind: "duelWins",
        title: `${next} duel wins`,
        character: who(wins.c),
        progress: { value: wins.v, target: next },
      });
  }
  const deaths = best((c) => c.pvp?.deaths);
  if (deaths !== undefined && !feats.some((x) => x.guid === deaths.c.guid && x.kind === "deaths100")) {
    out.push({
      kind: "deaths100",
      title: "A spirit healer's best friend",
      character: who(deaths.c),
      progress: { value: Math.min(deaths.v, DEATHS_FEAT), target: DEATHS_FEAT },
    });
  }
  const rank = best((c) => c.pvp?.rank);
  if (rank !== undefined && rank.v < MAX_PVP_RANK) {
    const next = rank.v + 1;
    out.push({
      kind: "pvpRank",
      title: `Rank ${next}, a.k.a. ${PVP_RANKS[next]!.title}`,
      character: who(rank.c),
      progress: { value: rank.v, target: next },
    });
  }
  return out;
}

/** The label of today's Doomsday day for a snapshot ("Wed 4 Nov"). */
export function snapshotLabel(snapshot: DoomsdaySnapshot): string {
  return dayLabel(snapshot.schedule.day);
}
