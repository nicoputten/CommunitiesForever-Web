import { doomsdaySnapshot, type DoomsdayInput, prepare, periodTotals, scheduleAt } from "./engine";
import { crown, dayOf, dayStart, doomsdayDay, elo, gridCount, weekOf, weekStart } from "./rules";
import type { DoomsdaySnapshot, FriendGoal, GoalRef } from "./snapshot";

// What the bot gets about Doomsday (WEB-58, docs/BOT-API.md "Doomsday"): the daily board, the weekly ladder, the
// `doomsday` look-up and the recap's section. Pure, from the engine's input and snapshot. Names only: friends by
// display name, never a BattleTag.

export interface BotGoal {
  slot: string;
  id: string;
  title: string;
  track: "pve" | "pvp";
  points: number;
  unknown?: true;
  hunt?: Record<string, string>;
}

export interface BotFriendGoal {
  slot: string;
  id: string;
  done: boolean;
  at?: number;
  swappedFrom?: { id: string; title: string };
  progress?: { have: number; need: number };
}

export interface BoardData {
  day: number;
  week: number;
  /** "Wed evening": the day by its reset, realm time (WEB-66). */
  label: string;
  /** "Wed 19:00 → Thu 19:00", realm time. */
  span: string;
  start: number;
  end: number;
  goals: BotGoal[];
  friends: {
    name: string;
    goals: BotFriendGoal[];
    /** The grid's goals done, the Duel slot included (WEB-66). */
    doneCount: number;
    /** The goals on the grid: the PvE dailies, the Hunt, the Skirmish and the Duel slot. */
    goalCount: number;
    crossedOut: boolean;
    today: { pve: number; pvp: number | null };
    week: { pve: number; pvp: number | null };
    streak: number;
    best: number;
    pvpVirgin: boolean;
  }[];
  withoutData: string[];
  crown: { name: string; at: number } | null;
  yesterdayCrown: { name: string } | null;
}

const DAY_SLOTS = ["pve1", "pve2", "pve3", "skirmish"];

/** The day's name and span in realm time: the bot posts one message for everyone (WEB-66). */
function dayOfBoard(snap: DoomsdaySnapshot): { label: string; span: string } {
  const d = doomsdayDay(snap.schedule.dayStart, snap.schedule.nextReset, snap.schedule.timeZone);
  return { label: d.name, span: d.span };
}
const WEEK_SLOTS = ["week1", "week2", "week3", "bounty"];

function botGoal(ref: GoalRef, slot: string, points: number): BotGoal {
  const g: BotGoal = { slot, id: ref.id, title: ref.title, track: ref.track, points };
  if (!ref.known) g.unknown = true;
  return g;
}

function slotsOf(goals: readonly FriendGoal[], slots: readonly string[]) {
  return goals.map((g, i) => ({ g, slot: slots[i] ?? `extra${i}` }));
}

function friendGoal(g: FriendGoal, slot: string): BotFriendGoal {
  const out: BotFriendGoal = { slot, id: g.goal.id, done: g.doneAt !== undefined };
  if (g.doneAt !== undefined) out.at = g.doneAt;
  if (g.swappedFrom !== undefined) out.swappedFrom = { id: g.swappedFrom.id, title: g.swappedFrom.title };
  if (g.progress !== undefined) out.progress = { have: g.progress.value, need: g.progress.target };
  return out;
}

/** The daily board for the snapshot's day (doomsdayBoard and doomsdayBoardUpdate). */
export function boardData(input: DoomsdayInput, snap: DoomsdaySnapshot): BoardData {
  const day = snap.schedule.day;
  const nameOf = (key: string) => snap.friends.find((f) => f.friendKey === key)?.name ?? "A friend";
  const active = snap.friends.filter((f) => f.status === "active" && f.today !== undefined);
  const friends = active.map((f) => {
    const goals = slotsOf(f.today!.goals, DAY_SLOTS)
      .filter(({ g }) => g.doneAt !== undefined || g.swappedFrom !== undefined || g.progress !== undefined)
      .map(({ g, slot }) => friendGoal(g, slot));
    return {
      name: f.name,
      goals,
      ...(({ done, total }) => ({ doneCount: done, goalCount: total }))(
        gridCount(f.today!.goals, f.today!.duels.first.length),
      ),
      crossedOut: f.today!.finishedAt !== undefined,
      today: { pve: f.points?.today.pve ?? 0, pvp: f.pvpVirgin ? null : (f.points?.today.pvp ?? 0) },
      week: { pve: f.points?.week.pve ?? 0, pvp: f.pvpVirgin ? null : (f.points?.week.pvp ?? 0) },
      streak: f.streak?.current ?? 0,
      best: f.streak?.best ?? 0,
      pvpVirgin: f.pvpVirgin,
    };
  });
  friends.sort((a, b) => b.doneCount - a.doneCount || a.name.localeCompare(b.name, "en"));
  // Yesterday's crown, from the stored goals of the day before.
  const yesterday = crown(
    Object.entries(input.goals).map(([friend, g]) => ({
      friend,
      set: g.days[day - 1]?.set ?? [],
      done: g.days[day - 1]?.done ?? {},
    })),
  );
  return {
    day,
    week: snap.schedule.week,
    ...dayOfBoard(snap),
    start: snap.schedule.dayStart,
    end: snap.schedule.nextReset,
    goals: snap.todayGoals.map((ref, i) => botGoal(ref, DAY_SLOTS[i] ?? `extra${i}`, 5)),
    friends,
    withoutData: snap.friends.filter((f) => f.status !== "active").map((f) => f.name),
    crown: snap.crown !== undefined ? { name: nameOf(snap.crown.friendKey), at: snap.crown.at } : null,
    yesterdayCrown: yesterday !== undefined ? { name: nameOf(yesterday.friend) } : null,
  };
}

/** The day's summary on the final board update: goals done by everyone, the Hunt race, the longest streak. */
export function boardSummary(snap: DoomsdaySnapshot): {
  goalsDone: number;
  hunt: { name: string; at: number } | null;
  longestStreak: { name: string; days: number } | null;
} {
  let goalsDone = 0;
  let hunt: { name: string; at: number } | null = null;
  let longest: { name: string; days: number } | null = null;
  for (const f of snap.friends) {
    for (const g of f.today?.goals ?? []) {
      if (g.doneAt === undefined) continue;
      goalsDone++;
      if (g.goal.slot === "hunt" && (hunt === null || g.doneAt < hunt.at)) hunt = { name: f.name, at: g.doneAt };
    }
    const days = f.streak?.current ?? 0;
    if (days > 0 && (longest === null || days > longest.days)) longest = { name: f.name, days };
  }
  return { goalsDone, hunt, longestStreak: longest };
}

/** "week 44": the ISO 8601 week of the Monday after the Doomsday week's start (docs/BOT-API.md). */
export function weekLabel(week: number): string {
  // The Monday after the week's Sunday start, then the ISO week of that date (its Thursday's year).
  const d = new Date((weekStart(week) + 1) * 86400 * 1000);
  d.setUTCDate(d.getUTCDate() + 3);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return `week ${Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7)}`;
}

type Move = { kind: "up" | "down"; by: number } | { kind: "same" } | { kind: "new" };

/** The weekly ladder for the week that ends at `end` (the Sunday reset): doomsdayLadder. */
export function ladderData(input: DoomsdayInput, end: number) {
  const snap = doomsdaySnapshot({ ...input, now: end - 1 });
  const week = snap.schedule.week;
  const first = weekStart(week);
  const inWeek = (n: number) => n >= first && n < first + 7;
  const totals = new Map(periodTotals({ ...input, now: end - 1 }, inWeek, (w) => w === week).map((t) => [t.key, t]));
  const move = (m: { kind: string; by?: number } | undefined): Move =>
    m === undefined || m.kind === "new"
      ? { kind: "new" }
      : m.kind === "same"
        ? { kind: "same" }
        : { kind: m.kind as "up" | "down", by: m.by ?? 0 };
  const top = (track: "pve" | "pvp") =>
    snap.ladders.week[track].slice(0, 5).map((r) => ({
      place: r.place,
      name: r.name,
      points: r.points,
      goals: totals.get(r.friendKey)?.goals ?? 0,
      ...(track === "pvp" ? { kills: totals.get(r.friendKey)?.kills ?? 0 } : {}),
      move: move(r.movement),
    }));

  // The duel champion: the best Elo among friends who duelled this week.
  const p = prepare({ ...input, now: end - 1 });
  const ratings = elo(p.allDuels.filter((d) => d.day < first + 7));
  const duelled = new Set(p.allDuels.filter((d) => inWeek(d.day)).flatMap((d) => [d.a, d.b]));
  let champion: { name: string; rating: number; wins: number; losses: number } | null = null;
  for (const key of duelled) {
    const rating = ratings[key];
    if (rating === undefined) continue;
    const mine = p.allDuels.filter((d) => inWeek(d.day) && !d.disputed && (d.a === key || d.b === key));
    const row = {
      name: p.byKey.get(key)?.name ?? "A friend",
      rating: Math.round(rating),
      wins: mine.filter((d) => d.winner === key).length,
      losses: mine.filter((d) => d.winner !== key).length,
    };
    if (champion === null || row.rating > champion.rating) champion = row;
  }

  let mostKills: { name: string; zone: string; kills: number } | null = null;
  const bgFriends: { name: string; points: number; wins: number; losses: number; kills: number }[] = [];
  const games = new Map<string, { wins: number; losses: number }>();
  for (const f of snap.friends) {
    const zone = f.pvp?.byZone[0];
    if (zone !== undefined && (mostKills === null || zone.kills > mostKills.kills)) {
      mostKills = { name: f.name, zone: zone.zone, kills: zone.kills };
    }
    const bgs = f.pvp?.battlegrounds ?? [];
    if (bgs.length > 0) {
      bgFriends.push({
        name: f.name,
        points: bgs.reduce((a, b) => a + b.points, 0),
        wins: bgs.reduce((a, b) => a + b.won, 0),
        losses: bgs.reduce((a, b) => a + b.lost, 0),
        kills: bgs.reduce((a, b) => a + b.kills, 0),
      });
      for (const b of bgs) {
        const g = games.get(b.name) ?? { wins: 0, losses: 0 };
        g.wins += b.won;
        g.losses += b.lost;
        games.set(b.name, g);
      }
    }
  }
  bgFriends.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "en"));

  return {
    week,
    label: weekLabel(week),
    start: dayStart(first, scheduleAt(input.timeZone, input.reset, end - 1)),
    end,
    pve: top("pve"),
    pvp: top("pvp"),
    duelChampion: champion,
    mostKillsInZone: mostKills,
    battlegrounds:
      bgFriends.length === 0
        ? null
        : {
            friends: bgFriends.slice(0, 5).map((f, i) => ({ place: i + 1, ...f })),
            games: [...games.entries()].map(([name, g]) => ({ name, ...g })),
          },
    pvpVirgins: snap.friends.filter((f) => f.status === "active" && f.pvpVirgin).map((f) => f.name),
    withoutData: snap.friends.filter((f) => f.status !== "active").map((f) => f.name),
  };
}

/** The `doomsday` look-up for one friend (by person key); undefined for an unknown one. */
export function lookupData(snap: DoomsdaySnapshot, friendKey: string) {
  const f = snap.friends.find((x) => x.friendKey === friendKey);
  if (f === undefined) return undefined;
  if (f.status !== "active" || f.today === undefined || f.week === undefined) return { friend: f.name, noData: true };
  const goals = [
    ...slotsOf(f.today.goals, DAY_SLOTS).map(({ g, slot }) => ({ g, slot, weekly: false })),
    ...slotsOf(f.week.goals, WEEK_SLOTS).map(({ g, slot }) => ({ g, slot, weekly: true })),
  ].map(({ g, slot }) => ({ ...botGoal(g.goal, slot, g.points), ...friendGoal(g, slot) }));
  const place = (track: "pve" | "pvp") => {
    const rows = snap.ladders.week[track];
    const row = rows.find((r) => r.friendKey === friendKey);
    return row === undefined ? null : { place: row.place, of: rows.length };
  };
  return {
    friend: f.name,
    day: snap.schedule.day,
    ...dayOfBoard(snap),
    resetAt: snap.schedule.nextReset,
    weekResetAt: snap.schedule.weekReset,
    goals,
    duels: f.today.duels.first.map((d) => ({
      name: d.name,
      won: d.result === "won",
      points: d.result === "won" ? 3 : d.result === "lost" ? 1 : 0,
      ...(d.result === "disputed" ? { disputed: true } : {}),
    })),
    today: f.points!.today,
    week: f.points!.week,
    allTime: f.points!.allTime,
    place: { pve: place("pve"), pvp: f.pvpVirgin ? null : place("pvp") },
    streak: f.streak?.current ?? 0,
    best: f.streak?.best ?? 0,
    pvpVirgin: f.pvpVirgin,
    crossedOut: f.today.finishedAt !== undefined,
  };
}

/** The recap's Doomsday section for `[start, end)`; undefined when nobody has Doomsday data. */
export function recapSection(input: DoomsdayInput, start: number, end: number) {
  if (Object.keys(input.goals).length === 0) return undefined;
  const s = scheduleAt(input.timeZone, input.reset, end - 1);
  const firstDay = dayOf(start, s) + (dayStart(dayOf(start, s), s) < start ? 1 : 0);
  const lastDay = dayOf(end - 1, s);
  const inPeriod = (n: number) => n >= firstDay && n <= lastDay;
  const weeks = new Set<number>();
  for (let n = firstDay; n <= lastDay; n++) weeks.add(weekOf(n));
  const totals = periodTotals({ ...input, now: end - 1 }, inPeriod, (w) => weeks.has(w));
  const names = new Map(totals.map((t) => [t.key, t.name]));

  let devoted: { name: string; days: number } | null = null;
  const perfect: string[] = [];
  const crowns = new Map<string, number>();
  for (const [key, g] of Object.entries(input.goals)) {
    const name = names.get(key);
    if (name === undefined) continue;
    const days = Object.entries(g.days).filter(([n]) => inPeriod(Number(n)));
    const goalDays = days.filter(([, r]) => Object.keys(r.done).length > 0).length;
    if (goalDays > 0 && (devoted === null || goalDays > devoted.days)) devoted = { name, days: goalDays };
    const played = days.filter(([, r]) => Object.keys(r.done).length > 0 || r.at !== undefined);
    const allDailies = played.every(([, r]) =>
      r.set.filter((id) => id.startsWith("d.")).every((id) => r.done[id] !== undefined),
    );
    if (played.length >= 4 && allDailies) perfect.push(name);
  }
  for (let n = firstDay; n <= lastDay; n++) {
    const c = crown(
      Object.entries(input.goals).map(([friend, g]) => ({
        friend,
        set: g.days[n]?.set ?? [],
        done: g.days[n]?.done ?? {},
      })),
    );
    if (c !== undefined) crowns.set(c.friend, (crowns.get(c.friend) ?? 0) + 1);
  }
  const top3 = (track: "pve" | "pvp") =>
    totals
      .filter((t) => (track === "pve" || t.killedEver) && t[track] > 0)
      .sort((a, b) => b[track] - a[track] || a.name.localeCompare(b.name, "en"))
      .slice(0, 3)
      .map((t) => ({ name: t.name, points: t[track] }));
  return {
    mostDevoted: devoted,
    perfectWeek: perfect.sort((a, b) => a.localeCompare(b, "en")),
    points: { pve: top3("pve"), pvp: top3("pvp") },
    crowns: [...crowns.entries()]
      .map(([key, count]) => ({ name: names.get(key) ?? "A friend", count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en")),
  };
}
