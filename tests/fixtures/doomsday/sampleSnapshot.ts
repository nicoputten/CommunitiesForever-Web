import type {
  DoomsdaySnapshot,
  FeatRecord,
  FriendDoomsday,
  FriendGoal,
  GoalRef,
  LadderRow,
  Points,
} from "@/core/doomsday/snapshot";
import { offsetSeconds } from "@/core/runTime";
import type { PersonView } from "@/core/views/characters";

// A made-up Doomsday snapshot for the screens' unit tests (WEB-59..61): the friends of the design sample with the
// board's numbers (`doomsday-today`), so the views are tested on every case at once (a swap, the crown, a PvP Virgin,
// a friend without the addon). The pages and the design checks use the engine's own snapshot from uploads (WEB-63).

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

/** Made-up GUIDs for the sample's characters (keys only). */
const guidOf = (name: string) => `Sample-${name.replace(/ /g, "-")}`;

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
  /** The design sample's characters: name, class, share of the friend's points, PvP rank. */
  chars: [string, string, number, number][];
  move: { pve: Move; pvp: Move };
  pvp: {
    kills: [number, number, number];
    zones: [string, number][];
    duels: [number, number];
    vs: Record<string, [number, number]>;
    elo?: [number, number];
    bgs: [string, number, number, number][];
  };
}

type Move = LadderRow["movement"];

const up = (by: number): Move => ({ kind: "up", by });
const down = (by: number): Move => ({ kind: "down", by });

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
    chars: [
      ["Ves Doombringer", "WARLOCK", 0.7, 6],
      ["Grom Ashfeller", "WARRIOR", 0.3, 2],
    ],
    move: { pve: down(2), pvp: down(1) },
    pvp: {
      kills: [45, 12, 3],
      zones: [
        ["Hillsbrad Foothills", 21],
        ["Stranglethorn Vale", 14],
        ["Arathi Highlands", 6],
        ["Ashenvale", 4],
      ],
      duels: [7, 5],
      vs: { Bob: [4, 2], Mira: [1, 3], Jorrit: [2, 0] },
      elo: [1084, 22],
      bgs: [
        ["Warsong Gulch", 6, 4, 38],
        ["Arathi Basin", 3, 5, 51],
        ["Alterac Valley", 1, 0, 64],
      ],
    },
  },
  Mira: {
    marks: { q: 9, d: 30, s: 21, h: undefined, l: 44 },
    swap: true,
    today: pts(15, 11),
    week: pts(120, 96),
    allTime: pts(520, 380),
    streak: [12, 12],
    seed: 2,
    chars: [
      ["Mira Sunstrider", "MAGE", 0.8, 4],
      ["Kel Dawnhammer", "PALADIN", 0.2, 0],
    ],
    move: { pve: up(1), pvp: { kind: "same" } },
    pvp: {
      kills: [18, 4, 0],
      zones: [
        ["Tanaris", 12],
        ["Felwood", 6],
      ],
      duels: [6, 6],
      vs: { Nico: [3, 1], Bob: [2, 2], Jorrit: [1, 0] },
      elo: [1012, -6],
      bgs: [["Warsong Gulch", 2, 3, 20]],
    },
  },
  Bob: {
    marks: { q: [6, 10], d: 55, s: undefined, h: 18, l: 64 },
    today: pts(5, 18),
    week: pts(60, 310),
    allTime: pts(300, 1540),
    streak: [3, 9],
    duels: [{ with: "Nico", result: "lost" }],
    seed: 3,
    chars: [
      ["Bob Example", "ROGUE", 0.75, 7],
      ["Tok Ironhide", "SHAMAN", 0.25, 1],
    ],
    move: { pve: { kind: "same" }, pvp: up(1) },
    pvp: {
      kills: [62, 20, 5],
      zones: [
        ["Hillsbrad Foothills", 30],
        ["Alterac Mountains", 18],
        ["Arathi Highlands", 14],
      ],
      duels: [7, 6],
      vs: { Nico: [2, 4], Mira: [2, 2], Jorrit: [3, 0] },
      elo: [1112, 18],
      bgs: [["Arathi Basin", 4, 2, 47]],
    },
  },
  Femke: {
    marks: { q: 20, d: 55, s: 100, h: undefined, l: undefined },
    today: pts(15, 0),
    week: pts(95, 0),
    allTime: pts(450, 0),
    streak: [8, 8],
    virgin: true,
    seed: 4,
    chars: [
      ["Lia Thornwhisper", "PRIEST", 0.9, 0],
      ["Zul Kazrek", "WARLOCK", 0.1, 0],
    ],
    move: { pve: up(2), pvp: { kind: "same" } },
    pvp: { kills: [0, 0, 0], zones: [], duels: [0, 0], vs: {}, bgs: [] },
  },
  Jorrit: {
    marks: { q: undefined, d: undefined, s: undefined, h: undefined, l: undefined },
    today: pts(0, 0),
    week: pts(15, 4),
    allTime: pts(40, 12),
    streak: [0, 2],
    seed: 5,
    chars: [["Ruk Bloodhoof", "HUNTER", 1, 1]],
    move: { pve: { kind: "new" }, pvp: { kind: "new" } },
    pvp: {
      kills: [3, 1, 0],
      zones: [["Stonetalon Mountains", 3]],
      duels: [0, 6],
      vs: { Nico: [0, 2], Bob: [0, 3], Mira: [0, 1] },
      elo: [942, -16],
      bgs: [],
    },
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
      pvp: {
        week: { kills: script.pvp.kills[0], solo: script.pvp.kills[1], skulls: script.pvp.kills[2] },
        byZone: script.pvp.zones.map(([zone, kills]) => ({ zone, kills })),
        characters: script.chars.map(([name, classFile, , rank]) => ({
          guid: guidOf(name),
          name,
          classFile,
          faction: "Horde" as const,
          rank,
          highestRank: rank,
        })),
        duels: {
          won: script.pvp.duels[0],
          lost: script.pvp.duels[1],
          vs: Object.entries(script.pvp.vs).map(([other, [won, lost]]) => ({
            friendKey: keyOf(other),
            name: nameOf(other),
            won,
            lost,
          })),
        },
        battlegrounds: script.pvp.bgs.map(([name, won, lost, kills]) => ({ name, won, lost, kills, points: kills })),
        firstWins: script.pvp.bgs.filter(([, won]) => won > 0).map(([name]) => name),
      },
      featProgress: [
        { kind: "honorKills", title: "1,000 honorable kills", progress: { value: 412, target: 1000 } },
        { kind: "duelWins", title: "Duel wins: 10", progress: { value: script.pvp.duels[0], target: 10 } },
        { kind: "firstEpic", title: "First epic item" },
      ],
    };
    if (script.pvp.elo !== undefined) {
      f.pvp!.duels.elo = { rating: script.pvp.elo[0], change: script.pvp.elo[1], place: 0 };
    }
    if (finishedAt !== undefined) f.today!.finishedAt = finishedAt;
    return f;
  });

  // Elo places, best rating first.
  const rated = friends.filter((f) => f.pvp?.duels.elo !== undefined);
  rated.sort((a, b) => b.pvp!.duels.elo!.rating - a.pvp!.duels.elo!.rating);
  rated.forEach((f, i) => (f.pvp!.duels.elo!.place = i + 1));

  const ladder = (track: "pve" | "pvp", scope: "week" | "allTime"): LadderRow[] => {
    const rows = people
      .map((p) => ({ p, script: SCRIPTS[p.isUploader ? "Nico" : p.displayName] }))
      .filter((x) => x.script !== undefined && x.p.hasAddon && !(track === "pvp" && x.script.virgin === true))
      .map(({ p, script }) => {
        const total = (scope === "week" ? script!.week : script!.allTime)[track];
        let left = total;
        const characters = script!.chars.map(([name, classFile, share], i) => {
          const points = i === script!.chars.length - 1 ? left : Math.round(total * share);
          left -= points;
          return { guid: guidOf(name), name, classFile, points };
        });
        const row: LadderRow = { friendKey: p.key, name: p.displayName, place: 0, points: total, characters };
        if (scope === "week") row.movement = script!.move[track];
        return row;
      })
      .sort((a, b) => b.points - a.points);
    rows.forEach((r, i) => (r.place = i + 1));
    return rows;
  };

  const featAt = (days: number, minute = 0) => dayStart - days * DAY + minute * 60;
  const feat = (
    id: string,
    kind: string,
    who: string,
    character: [string, string],
    when: number,
    title: string,
    extra: Partial<FeatRecord> = {},
  ): FeatRecord => ({
    id,
    kind,
    friendKey: keyOf(who),
    character: { guid: guidOf(character[0]), name: character[0], classFile: character[1] },
    at: when,
    title,
    firstInGroup: false,
    alreadyHad: false,
    ...extra,
  });
  const VES: [string, string] = ["Ves Doombringer", "WARLOCK"];
  const MIRA: [string, string] = ["Mira Sunstrider", "MAGE"];
  const feats: FeatRecord[] = [
    feat("f1", "pvpRank", "Nico", VES, at(74), "Stone Guard, a.k.a. Mailbox Menace", {
      detail: "rank 6",
      rank: 6,
      firstInGroup: true,
    }),
    feat("f2", "firstEpic", "Mira", MIRA, at(31), "First epic: Robes of the Exalted", {
      detail: "chest · item level 66",
      epicItem: "Robes of the Exalted",
      firstInGroup: true,
    }),
    feat("f3", "epicMount", "Mira", MIRA, featAt(1, 60), "Epic mount · riding 150", { firstInGroup: true }),
    feat("f4", "professionCap", "Bob", ["Tok Ironhide", "SHAMAN"], featAt(4), "Fish Whisperer · Fishing 300"),
    feat(
      "f5",
      "deaths100",
      "Bob",
      ["Bob Example", "ROGUE"],
      featAt(5),
      "100 deaths: a spirit healer\u2019s best friend",
    ),
    feat("f6", "professionCap", "Nico", VES, featAt(6), "Head Chef · Cooking 300"),
    feat("f7", "honorKills", "Nico", VES, featAt(31), "100 honorable kills"),
    feat("f8", "honorKills", "Nico", VES, featAt(48), "First blood", { alreadyHad: true }),
  ];

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
    ladders: {
      week: { pve: ladder("pve", "week"), pvp: ladder("pvp", "week") },
      allTime: { pve: ladder("pve", "allTime"), pvp: ladder("pvp", "allTime") },
    },
    feats,
  };
  const first = finishers[0];
  if (first !== undefined) snapshot.crown = { friendKey: first.friendKey, at: first.today!.finishedAt! };
  return snapshot;
}
