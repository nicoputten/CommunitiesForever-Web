import type { DoomsdaySnapshot, FriendDoomsday, FriendGoal, GoalRef, Points } from "@/core/doomsday/snapshot";
import { offsetSeconds } from "@/core/runTime";
import type { PersonView } from "@/core/views/characters";

// A made-up Doomsday for the design checks and Playwright (WEB-59..61) until the engine (WEB-58) computes it from
// uploads: the friends of the design sample (tests/design/sample.ts) with the board's numbers (`doomsday-today`).
// Only served with DOOMSDAY_SAMPLE=1, which only the test servers set; real users never see it. Goes when WEB-58's data
// lands and the design sample uploads `goals`.

const DAY = 86400;
const RESET = 19 * 3600;
const ZONE = "Europe/Paris";

const goal = (id: string, track: "pve" | "pvp", slot: GoalRef["slot"], title: string): GoalRef => ({
  id,
  track,
  slot,
  title,
  known: true,
});

const QUESTS10 = goal("d.quests10", "pve", "pveDaily", "Finish 10 quests");
const DUNGEON_FRIEND = goal("d.dungeonFriend", "pve", "pveDaily", "Run a dungeon with a friend");
const SECONDARY = goal("d.secondary", "pve", "pveDaily", "Raise Cooking, First Aid or Fishing");
const SKILL5 = goal("d.skill5", "pve", "pveDaily", "Earn 5 profession skill points");
const HUNT = goal("hunt:NightElf:DRUID", "pvp", "hunt", "Hunt: Night Elf Druids");
const LONE_WOLF = goal("p.loneWolf", "pvp", "skirmish", "Lone wolf: 3 solo kills");
const DUNGEONS_DIFF = goal("w.dungeonsDiff3", "pve", "pveWeekly", "Run 3 different dungeons");
const LEVELS3 = goal("w.levels3", "pve", "pveWeekly", "Gain 3 levels");
const FRIENDS3 = goal("w.friends3", "pve", "pveWeekly", "Group with 3 different friends");
const ALL_CLASSES = goal("b.allClasses", "pvp", "bounty", "Bounty: a kill of every enemy class");

type Mark = number | [number, number] | undefined;

/** A friend's day: per column the minute after the reset it was done (`at` makes it a time), [value, target] progress, or nothing. */
function day(
  at: (minute: number) => number,
  marks: { q: Mark; d: Mark; s: Mark; h: Mark; l: Mark },
  swapSecondary = false,
): FriendGoal[] {
  const one = (g: GoalRef, columnId: string, m: Mark, points = 5, swappedFrom?: GoalRef): FriendGoal => {
    const fg: FriendGoal = { goal: g, columnId, points };
    if (typeof m === "number") fg.doneAt = at(m);
    else if (m !== undefined) fg.progress = { value: m[0], target: m[1] };
    if (swappedFrom !== undefined) fg.swappedFrom = swappedFrom;
    return fg;
  };
  return [
    one(QUESTS10, QUESTS10.id, marks.q),
    one(DUNGEON_FRIEND, DUNGEON_FRIEND.id, marks.d),
    swapSecondary ? one(SKILL5, SECONDARY.id, marks.s, 5, SECONDARY) : one(SECONDARY, SECONDARY.id, marks.s),
    one(HUNT, "hunt:alliance", marks.h),
    one(LONE_WOLF, LONE_WOLF.id, marks.l),
  ];
}

const pts = (pve: number, pvp: number): Points => ({ pve, pvp });

/** 84 days ending today: a fixed pattern per friend, so screenshots stay the same. */
function heat(seed: number, today: number): (number | null)[] {
  return Array.from({ length: 84 }, (_, i) => {
    if (i === 83) return today;
    if (i < 84 - 7 * (2 + (seed % 3))) return null;
    return (i * 7 + seed * 3) % 6;
  });
}

interface Script {
  marks: { q: Mark; d: Mark; s: Mark; h: Mark; l: Mark };
  swap?: boolean;
  today: Points;
  week: Points;
  allTime: Points;
  streak: [number, number];
  virgin?: boolean;
  duels?: { with: string; result: "won" | "lost" }[];
  seed: number;
}

// The board's friends mapped onto the design sample's people (by display name).
const SCRIPTS: Record<string, Script> = {
  Nico: {
    marks: { q: 12, d: 55, s: [3, 5], h: 38, l: [2, 3] },
    today: pts(10, 9),
    week: pts(85, 240),
    allTime: pts(410, 1210),
    streak: [6, 11],
    duels: [{ with: "Bob", result: "won" }],
    seed: 1,
  },
  Mira: {
    marks: { q: 9, d: 30, s: 21, h: undefined, l: 44 },
    swap: true,
    today: pts(15, 11),
    week: pts(120, 96),
    allTime: pts(520, 380),
    streak: [12, 12],
    seed: 2,
  },
  Bob: {
    marks: { q: [6, 10], d: 55, s: undefined, h: 18, l: 64 },
    today: pts(5, 18),
    week: pts(60, 310),
    allTime: pts(300, 1540),
    streak: [3, 9],
    duels: [{ with: "Nico", result: "lost" }],
    seed: 3,
  },
  Femke: {
    marks: { q: 20, d: 55, s: 100, h: undefined, l: undefined },
    today: pts(15, 0),
    week: pts(95, 0),
    allTime: pts(450, 0),
    streak: [8, 8],
    virgin: true,
    seed: 4,
  },
  Jorrit: {
    marks: { q: undefined, d: undefined, s: undefined, h: undefined, l: undefined },
    today: pts(0, 0),
    week: pts(15, 4),
    allTime: pts(40, 12),
    streak: [0, 2],
    seed: 5,
  },
};

export function doomsdaySample(people: readonly PersonView[], now: number): DoomsdaySnapshot {
  const offset = offsetSeconds(ZONE, now);
  const n = Math.floor((now + offset - RESET) / DAY);
  const dayStart = n * DAY + RESET - offset;
  const week = Math.floor((n + 4) / 7);
  const weekStartDay = week * 7 - 4;
  // The script's minutes are for the design checks' "now", 2 hours after the reset; squeezed into the time since the
  // reset otherwise, so nothing is done in the future.
  const at = (minute: number) => dayStart + Math.round((minute / 120) * Math.min(now - dayStart, 7200));
  // "Nico" is the uploader (the e2e admin has another name).
  const person = (name: string) => people.find((p) => (name === "Nico" ? p.isUploader : p.displayName === name));
  const keyOf = (name: string) => person(name)?.key ?? name;
  const nameOf = (name: string) => person(name)?.displayName ?? name;

  const friends = people.map((p): FriendDoomsday => {
    const script = SCRIPTS[p.isUploader ? "Nico" : p.displayName];
    if (script === undefined || !p.hasAddon) {
      return { friendKey: p.key, name: p.displayName, status: p.hasAddon ? "noDoomsday" : "noAddon", pvpVirgin: false };
    }
    const goals = day(at, script.marks, script.swap);
    const pveDone = goals.slice(0, 3).map((g) => g.doneAt);
    const finishedAt = pveDone.every((t) => t !== undefined) ? Math.max(...pveDone) : undefined;
    const duels = script.duels ?? [];
    const f: FriendDoomsday = {
      friendKey: p.key,
      name: p.displayName,
      status: "active",
      today: {
        goals,
        duels: {
          first: duels.map((d, i) => ({
            friendKey: keyOf(d.with),
            name: nameOf(d.with),
            result: d.result,
            at: at(40 + i),
          })),
          open:
            script.virgin === true || duels.length === 0
              ? []
              : ["Mira", "Jorrit"].map((name) => ({ friendKey: keyOf(name), name })),
          points: duels.reduce((sum, d) => sum + (d.result === "won" ? 3 : 1), 0),
        },
      },
      week: {
        goals: [
          { goal: DUNGEONS_DIFF, columnId: DUNGEONS_DIFF.id, points: 15, progress: { value: 2, target: 3 } },
          { goal: LEVELS3, columnId: LEVELS3.id, points: 15, progress: { value: 1, target: 3 } },
          {
            goal: FRIENDS3,
            columnId: FRIENDS3.id,
            points: 15,
            doneAt: (weekStartDay + 1) * DAY + RESET - offset + 3 * 3600 + 600,
          },
          { goal: ALL_CLASSES, columnId: ALL_CLASSES.id, points: 15, progress: { value: 5, target: 8 } },
        ],
      },
      points: { today: script.today, week: script.week, allTime: script.allTime },
      streak: { current: script.streak[0], best: script.streak[1] },
      pvpVirgin: script.virgin === true,
      heatmap: heat(script.seed, goals.filter((g) => g.doneAt !== undefined).length),
    };
    if (finishedAt !== undefined) f.today!.finishedAt = finishedAt;
    return f;
  });

  const finishers = friends
    .filter((f) => f.today?.finishedAt !== undefined)
    .sort((a, b) => a.today!.finishedAt! - b.today!.finishedAt!);
  const snapshot: DoomsdaySnapshot = {
    now,
    schedule: {
      timeZone: ZONE,
      resetSeconds: RESET,
      day: n,
      dayStart,
      nextReset: dayStart + DAY,
      week,
      weekReset: (weekStartDay + 7) * DAY + RESET - offset,
    },
    todayGoals: [QUESTS10, DUNGEON_FRIEND, SECONDARY, LONE_WOLF],
    hunts: { alliance: HUNT },
    weekGoals: [DUNGEONS_DIFF, LEVELS3, FRIENDS3, ALL_CLASSES],
    friends,
    ladders: { week: { pve: [], pvp: [] }, allTime: { pve: [], pvp: [] } },
    feats: [],
  };
  const first = finishers[0];
  if (first !== undefined) snapshot.crown = { friendKey: first.friendKey, at: first.today!.finishedAt! };
  return snapshot;
}
