import { describe, expect, it } from "vitest";
import { doomsdaySnapshot, type DoomsdayInput } from "@/core/doomsday/engine";
import { boardData } from "@/core/doomsday/posts";
import {
  canDo,
  draw,
  drawWeek,
  combos,
  type Combo,
  EPOCH,
  FOREVER_COMBOS_SINCE,
  goal,
  gridCount,
  HUNT_SINCE,
  huntName,
  huntTitle,
  pointsFor,
  pool,
  POOL_VERSION,
  weekOf,
} from "@/core/doomsday/rules";

// WEB-58: feat records as the Feats tab (WEB-60) shows them: display-ready titles, the epic item and a rank's rank.

const input: DoomsdayInput = {
  now: 1794333600 + 60,
  timeZone: "Europe/Paris",
  reset: { reset: 68400 },
  data: {
    schemaVersion: 2,
    community: {},
    people: {
      "Ada#1001": { key: "Ada#1001", displayName: "Ada", isUploader: true, hasRecord: true, removed: {} },
    },
    characters: {
      G: {
        guid: "G",
        owner: "Ada#1001",
        hasRecord: true,
        name: "Ada Example",
        classFile: "MAGE",
        faction: "Horde",
        professions: {},
        talents: [],
        quests: {},
      },
    },
    locations: {},
    presence: {},
  },
  goals: { "Ada#1001": { days: {}, weeks: {} } },
  feed: [],
  feats: [
    {
      guid: "G",
      key: "pvpRank:6",
      kind: "pvpRank",
      owner: "Ada#1001",
      at: 10,
      alreadyHad: false,
      firstInGroup: true,
      fields: { rank: 6, rankName: "Stone Guard", title: "Mailbox Menace" },
    },
    {
      guid: "G",
      key: "firstEpic",
      kind: "firstEpic",
      owner: "Ada#1001",
      at: 20,
      alreadyHad: false,
      firstInGroup: false,
      fields: { item: { id: 1, name: "Robes of the Exalted", slot: "Chest", level: 60 } },
    },
  ],
};

describe("feat records", () => {
  it("are display-ready, newest first", () => {
    const feats = doomsdaySnapshot(input).feats;
    expect(feats.map((f) => [f.kind, f.title])).toEqual([
      ["firstEpic", "First epic: Robes of the Exalted"],
      ["pvpRank", "Stone Guard, a.k.a. Mailbox Menace"],
    ]);
    expect(feats[0]).toMatchObject({ epicItem: "Robes of the Exalted", detail: "Chest · looted at level 60" });
    expect(feats[1]).toMatchObject({ rank: 6, firstInGroup: true, alreadyHad: false });
    expect(feats[0]!.title).toContain(feats[0]!.epicItem);
  });
});

// WEB-66 follow-up: the PvE weeklies' progress from the friend's feed, for the Week tab's bars.
describe("PvE weekly progress", () => {
  const snap0 = doomsdaySnapshot(input);
  const start = snap0.schedule.dayStart;
  const week = snap0.schedule.week;
  const day = (n: number, at: number, entry: object) => ({
    guid: "G",
    owner: "Ada#1001",
    day: n,
    entry: { quests: {}, ranks: {}, learned: [], runs: [], at, ...entry },
  });
  const withBob: DoomsdayInput = {
    ...input,
    now: start + 3 * 3600,
    data: {
      ...input.data,
      people: {
        ...input.data.people,
        "Bob#2002": { key: "Bob#2002", displayName: "Bob", isUploader: false, hasRecord: true, removed: {} },
      },
      characters: {
        ...input.data.characters,
        B: {
          guid: "B",
          owner: "Bob#2002",
          hasRecord: true,
          name: "Bob Example",
          professions: {},
          talents: [],
          quests: {},
        },
      },
    },
    goals: {
      "Ada#1001": {
        days: {},
        weeks: {
          [week]: {
            set: ["w.days3", "w.quests50", "w.fullClear", "w.dungeonFriends2", "w.discover5"],
            swapped: {},
            done: {},
          },
        },
      },
    },
    feed: [
      day(1, start + 600, {
        quests: { Durotar: 7, Barrens: 5 },
        runs: [{ name: "The Deadmines", kind: "party", bosses: 4, with: ["B"] }],
      }),
      day(2, start + 2 * 3600, {
        quests: { Barrens: 3 },
        runs: [{ name: "Scarlet Monastery", kind: "party", bosses: 3, with: [] }],
      }),
    ],
  };

  it("counts days, quests, a dungeon's bosses with its name, and friends in a run", () => {
    const ada = doomsdaySnapshot(withBob).friends.find((f) => f.friendKey === "Ada#1001")!;
    const progress = Object.fromEntries(ada.week!.goals.map((g) => [g.goal.id, g.progress]));
    // Both feed days fall in the same Doomsday day: one day played.
    expect(progress["w.days3"]).toEqual({ value: 1, target: 3 });
    expect(progress["w.quests50"]).toEqual({ value: 15, target: 50 });
    // Only dungeons with a known boss count: "4 / 7 · The Deadmines"; Scarlet Monastery has wings.
    expect(progress["w.fullClear"]).toEqual({ value: 4, target: 7, detail: "The Deadmines" });
    expect(progress["w.dungeonFriends2"]).toEqual({ value: 1, target: 2 });
    // Not in the feed: no progress at all.
    expect(progress["w.discover5"]).toBeUndefined();
  });
});

// WEB-80 (addon CF-69): each stored day and week scores in the pool version recorded with it.
describe("points per pool version", () => {
  const today = doomsdaySnapshot(input).schedule.day;
  const record = (pool: number | undefined) => ({
    set: ["d.quests10", "d.quests20", "d.level"],
    swapped: {},
    done: { "d.quests10": 1, "d.level": 2 },
    ...(pool !== undefined ? { pool } : {}),
  });
  const ada = (days: DoomsdayInput["goals"][string]["days"]) =>
    doomsdaySnapshot({ ...input, goals: { "Ada#1001": { days, weeks: {} } } }).friends.find(
      (f) => f.friendKey === "Ada#1001",
    )!;

  it("keeps the flat points of pool version 1 next to a day of pool version 2", () => {
    const f = ada({ [today - 2]: record(undefined), [today - 1]: record(1), [today]: record(2) });
    // 5 + 5 for each day of version 1 (with or without pool), 3 + 3 for today's of version 2.
    expect(f.points!.allTime.pve).toBe(10 + 10 + 6);
    expect(f.points!.today.pve).toBe(6);
    expect(f.today!.goals.map((g) => g.points)).toEqual([3, 5, 3]);
  });

  it("scores today's drawn set in the site's pool version before the addon recorded it", () => {
    const goals = ada({}).today!.goals;
    expect(goals.map((g) => g.points)).toEqual(
      goals.map((g) => pointsFor(g.goal.slot === "hunt" ? "hunt" : g.goal.id, POOL_VERSION)),
    );
  });
});

// WEB-80 (addon CF-78): only a real fight ends PvP Virgin.
describe("PvP Virgin", () => {
  const today = doomsdaySnapshot(input).schedule.day;
  const feedDay = (entry: object) => ({
    guid: "G",
    owner: "Ada#1001",
    day: today,
    entry: { quests: {}, ranks: {}, learned: [], runs: [], ...entry },
  });
  const virgin = (extra: Partial<DoomsdayInput>) =>
    doomsdaySnapshot({
      ...input,
      goals: {
        "Ada#1001": {
          // A taunt goal done: PvP points without a fight.
          days: { [today]: { set: ["p.flex"], swapped: {}, done: { "p.flex": 1 } } },
          weeks: {},
        },
      },
      ...extra,
    }).friends.find((f) => f.friendKey === "Ada#1001")!.pvpVirgin;

  it("stays after PvP points from a goal without a fight", () => {
    expect(virgin({})).toBe(true);
  });

  it("ends with a finished battleground or a duel", () => {
    expect(virgin({ feed: [feedDay({ runs: [{ name: "Warsong Gulch", kind: "pvp", won: false, with: [] }] })] })).toBe(
      false,
    );
    expect(virgin({ feed: [feedDay({ runs: [{ name: "Warsong Gulch", kind: "pvp", with: [] }] })] })).toBe(true);
    expect(virgin({ feed: [feedDay({ duels: [{ t: 1, won: true, vs: "Stranger Name" }] })] })).toBe(false);
  });
});

// WEB-80 (addon CF-79): a retired goal and a `canFrom` check apply from their pool version on.
describe("pool versions", () => {
  it("keeps w.ilvl3 in pool version 1 only", () => {
    expect(pool("weekly", 1)).toContain("w.ilvl3");
    expect(pool("weekly", 2)).not.toContain("w.ilvl3");
  });

  it("checks b.zone25's level only from pool version 2", () => {
    expect(canDo("b.zone25", { highest: 12 }, 1)).toBe(true);
    expect(canDo("b.zone25", { highest: 12 }, 2)).toBe(false);
    expect(canDo("b.zone25", { highest: 25 }, 2)).toBe(true);
  });
});

// WEB-80 (addon CF-77): from pool version 2 the 3 weeklies take 3 different categories; weeks of version 1 don't.
describe("the weekly draw by category", () => {
  const weeks = Array.from({ length: 30 }, (_, i) => weekOf(EPOCH) + i);
  const categories = (w: number, version: number) => drawWeek(w, version).weeklies.map((id) => goal(id)!.category);

  it("takes 3 different categories from pool version 2", () => {
    for (const w of weeks) expect(new Set(categories(w, 2)).size, String(w)).toBe(3);
  });

  it("keeps pool version 1's draw without categories", () => {
    expect(weeks.some((w) => new Set(categories(w, 1)).size < 3)).toBe(true);
  });
});

// WEB-101 (addon CF-104): pool version 4 and the Hunt.
describe("pool version 4", () => {
  const today = doomsdaySnapshot(input).schedule.day;
  const hunt = draw(today).hunt!;
  const withGoals = (days: DoomsdayInput["goals"][string]["days"], factions: string[] = ["Horde"]): DoomsdayInput => ({
    ...input,
    data: {
      ...input.data,
      characters: Object.fromEntries(
        factions.map((faction, i) => [`G${i}`, { ...input.data.characters.G!, guid: `G${i}`, faction }]),
      ),
    },
    goals: { "Ada#1001": { days, weeks: {} } },
  });
  const adaOf = (i: DoomsdayInput) => doomsdaySnapshot(i).friends.find((f) => f.friendKey === "Ada#1001")!;

  it("pools: 108 dailies, 6 Skirmish, 49 weeklies, 6 Bounty; Defend home retired; the Hunt from 4", () => {
    expect(HUNT_SINCE).toBe(4);
    expect([
      pool("daily", 5).length,
      pool("skirmish", 5).length,
      pool("weekly", 5).length,
      pool("bounty", 5).length,
    ]).toEqual([108, 6, 49, 6]);
    expect(pool("skirmish", 5)).toEqual([
      "p.frontLine",
      "p.loneWolf",
      "p.untouchable",
      "p.revenge",
      "p.flagHour",
      "p.flagUp",
    ]);
    expect(pool("bounty", 5)).toContain("b.flagged3h");
    for (const id of ["d.reward", "d.fishFriend", "d.feedFriend", "d.summoned", "d.auctionPost"])
      expect(pool("daily", 5), id).toContain(id);
    expect(pool("skirmish", 3)).toContain("p.homeGuard");
    expect(pool("skirmish", 4)).not.toContain("p.homeGuard");
    for (const slot of ["daily", "skirmish", "weekly", "bounty"] as const) expect(pool(slot, 4)).toEqual(pool(slot, 5));
    expect(draw(today, 3).hunt).toBeUndefined();
    expect(hunt.Horde).toBeDefined();
  });

  it("names a Hunt as the board and the bot do", () => {
    expect(huntName({ race: "NightElf", class: "DRUID" })).toBe("Night Elf Druid");
    expect(huntName({ race: "Scourge", class: "PRIEST" })).toBe("Undead Priest");
    expect(huntTitle({ race: "NightElf", class: "DRUID" })).toBe("Hunt: Night Elf Druids");
  });

  it("the snapshot's Hunts: Horde characters hunt the Alliance combination; only the factions the group hunts", () => {
    const snap = doomsdaySnapshot(input);
    expect(snap.hunts.alliance).toEqual({
      id: `hunt:${hunt.Horde!.race}:${hunt.Horde!.class}`,
      track: "pvp",
      slot: "hunt",
      title: huntTitle(hunt.Horde!),
      known: true,
    });
    // WEB-112: a Horde-only group has no Horde Hunt; with an Alliance character it comes back.
    expect(snap.hunts.horde).toBeUndefined();
    expect(doomsdaySnapshot(withGoals({}, ["Horde", "Alliance"])).hunts.horde?.title).toBe(huntTitle(hunt.Alliance!));
  });

  it("an Alliance-only group: only the Horde Hunt, also for a friend without a known faction (WEB-112)", () => {
    const base = withGoals({}, ["Alliance"]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { faction, ...noFaction } = input.data.characters.G!;
    const i: DoomsdayInput = {
      ...base,
      data: {
        ...base.data,
        people: {
          ...base.data.people,
          "Bo#1002": { ...input.data.people["Ada#1001"]!, key: "Bo#1002", displayName: "Bo" },
        },
        characters: { ...base.data.characters, N: { ...noFaction, guid: "N", owner: "Bo#1002" } },
      },
      goals: { ...base.goals, "Bo#1002": { days: {}, weeks: {} } },
    };
    const snap = doomsdaySnapshot(i);
    expect(snap.hunts.alliance).toBeUndefined();
    expect(snap.hunts.horde?.title).toBe(huntTitle(hunt.Alliance!));
    const hunts = (key: string) =>
      snap.friends.find((f) => f.friendKey === key)!.today!.goals.filter((g) => g.goal.slot === "hunt");
    expect(hunts("Ada#1001").map((g) => g.columnId)).toEqual(["hunt:horde"]);
    expect(hunts("Bo#1002").map((g) => g.columnId)).toEqual(["hunt:horde"]);
  });

  it("no faction known at all: both Hunts as before WEB-112, a friend gets the Alliance one", () => {
    const snap = doomsdaySnapshot(withGoals({}, [""]));
    expect(snap.hunts.alliance?.title).toBe(huntTitle(hunt.Horde!));
    expect(snap.hunts.horde?.title).toBe(huntTitle(hunt.Alliance!));
    const ada = snap.friends.find((f) => f.friendKey === "Ada#1001")!;
    expect(ada.today!.goals.filter((g) => g.goal.slot === "hunt").map((g) => g.columnId)).toEqual(["hunt:alliance"]);
  });

  it("a pool-4 day's recorded hunt is the friend's Hunt before the Skirmish, done once and worth 5 PvP", () => {
    const record = {
      set: ["d.reward", "d.summoned", "d.auctionPost", "p.flagUp", "hunt"],
      swapped: {},
      done: { "d.reward": 1, hunt: 2, "p.flagUp": 3 },
      pool: 4,
    };
    const ada = adaOf(withGoals({ [today]: record }));
    expect(ada.today!.goals.map((g) => [g.goal.slot, g.columnId, g.points, g.doneAt])).toEqual([
      ["pveDaily", "d.reward", 3, 1],
      ["pveDaily", "d.summoned", 3, undefined],
      ["pveDaily", "d.auctionPost", 3, undefined],
      ["hunt", "hunt:alliance", 5, 2],
      ["skirmish", "p.flagUp", 1, 3],
    ]);
    // The day's own pool-4 Hunt (Vanilla's 20), not today's pool-5 draw (WEB-106).
    expect(ada.today!.goals[3]!.goal.title).toBe(huntTitle(draw(today, 4).hunt!.Horde!));
    expect(ada.points!.today).toEqual({ pve: 3, pvp: 5 + 1 });
  });

  it("a friend with both factions has both Hunts: one grid slot, done by either", () => {
    const record = {
      set: ["d.reward", "d.summoned", "d.auctionPost", "p.flagUp", "hunt"],
      swapped: {},
      done: { hunt: 2 },
      pool: 4,
    };
    const ada = adaOf(withGoals({ [today]: record }, ["Horde", "Alliance"]));
    const hunts = ada.today!.goals.filter((g) => g.goal.slot === "hunt");
    expect(hunts.map((g) => g.columnId)).toEqual(["hunt:alliance", "hunt:horde"]);
    expect(hunts.every((g) => g.doneAt === 2)).toBe(true);
    expect(gridCount(ada.today!.goals, 0)).toEqual({ done: 1, total: 6 });
    expect(ada.points!.today.pvp).toBe(5);
  });

  it("a pool-3 day keeps its catalogue and has no Hunt, next to a pool-4 day", () => {
    const pool3 = {
      set: ["d.quests10", "d.level", "d.potion", "p.homeGuard"],
      swapped: {},
      done: { "p.homeGuard": 1 },
      pool: 3,
    };
    const pool4 = {
      set: ["d.reward", "d.level", "d.potion", "p.revenge", "hunt"],
      swapped: {},
      done: { "p.revenge": 1, hunt: 2 },
      pool: 4,
    };
    const yesterday = adaOf(withGoals({ [today - 1]: pool4, [today]: pool3 }));
    expect(yesterday.today!.goals.map((g) => g.goal.id)).toEqual(["d.quests10", "d.level", "d.potion", "p.homeGuard"]);
    expect(yesterday.today!.goals.at(-1)!.goal.known).toBe(true);
    // Defend home (3, pool 3) today; Revenge (5) and the Hunt (5) yesterday.
    expect(yesterday.points!.today.pvp).toBe(3);
    expect(yesterday.points!.allTime.pvp).toBe(3 + 5 + 5);
  });

  it("the site's own draw today adds the Hunt, as the addon records it", () => {
    const ada = adaOf(withGoals({}));
    expect(ada.today!.goals.map((g) => g.goal.slot)).toEqual(["pveDaily", "pveDaily", "pveDaily", "hunt", "skirmish"]);
  });

  it("the bot's board: one Hunt column keyed by the hunted faction, a row's Hunt as `hunt`", () => {
    const record = {
      set: ["d.reward", "d.summoned", "d.auctionPost", "p.flagUp", "hunt"],
      swapped: {},
      done: { hunt: 2 },
      pool: 4,
    };
    const i = withGoals({ [today]: record }, ["Horde", "Alliance"]);
    const board = boardData(i, doomsdaySnapshot(i));
    const column = board.goals.find((g) => g.slot === "hunt")!;
    expect(column).toEqual({
      slot: "hunt",
      id: "hunt",
      title: `The Hunt: ${huntName(hunt.Horde!)} or ${huntName(hunt.Alliance!)}`,
      track: "pvp",
      points: 5,
      shortLabel: "Hunt",
      hunt: { Alliance: huntName(hunt.Horde!), Horde: huntName(hunt.Alliance!) },
    });
    expect(board.goals.map((g) => g.slot)).toEqual(["pve1", "pve2", "pve3", "hunt", "skirmish"]);
    const row = board.friends[0]!;
    expect(row.goals).toEqual([{ slot: "hunt", id: "hunt", done: true, at: 2 }]);
    expect([row.doneCount, row.goalCount]).toEqual([1, 6]);
  });
});

// WEB-106 (addon CF-116): pool version 5, the Hunt draws Forever's combinations.
describe("pool version 5", () => {
  const key = (c: Combo) => `${c.race}:${c.class}`;
  const days = Array.from({ length: 200 }, (_, i) => EPOCH + i);

  it("Forever's combinations from 5", () => {
    expect(POOL_VERSION).toBeGreaterThanOrEqual(5);
    expect(FOREVER_COMBOS_SINCE).toBe(5);
  });

  it("pools 1 to 4 hunt Vanilla's 20 per faction, pool 5 Forever's 23", () => {
    for (const faction of ["Horde", "Alliance"] as const) {
      for (const v of [1, 2, 3, 4]) expect(combos(faction, v), `${faction} ${v}`).toHaveLength(20);
      expect(combos(faction, 5)).toHaveLength(23);
      // Forever only adds: every Vanilla combination is still there.
      const forever = new Set(combos(faction, 5).map(key));
      for (const c of combos(faction, 4)) expect(forever.has(key(c)), key(c)).toBe(true);
    }
    const added = (faction: "Horde" | "Alliance") =>
      combos(faction, 5)
        .filter((c) => !combos(faction, 4).some((v) => key(v) === key(c)))
        .map(huntName);
    expect(added("Horde")).toEqual(["Human Hunter", "Dwarf Shaman", "Gnome Priest"]);
    expect(added("Alliance")).toEqual(["Orc Mage", "Undead Paladin", "Troll Warlock"]);
  });

  it("each pool version draws from its own list", () => {
    for (const n of days) {
      const v4 = new Set(combos("Horde", 4).map(key));
      expect(v4.has(key(draw(n, 4).hunt!.Horde!)), `${n}`).toBe(true);
    }
    const drawn = new Set(
      days.flatMap((n) => [huntName(draw(n, 5).hunt!.Horde!), huntName(draw(n, 5).hunt!.Alliance!)]),
    );
    for (const name of ["Human Hunter", "Dwarf Shaman", "Gnome Priest", "Orc Mage", "Undead Paladin", "Troll Warlock"])
      expect(drawn.has(name), name).toBe(true);
  });

  it("names the new combinations as the board and the bot do", () => {
    expect(huntTitle({ race: "Scourge", class: "PALADIN" })).toBe("Hunt: Undead Paladins");
    expect(huntTitle({ race: "Dwarf", class: "SHAMAN" })).toBe("Hunt: Dwarf Shamans");
    expect(huntName({ race: "Troll", class: "WARLOCK" })).toBe("Troll Warlock");
  });

  it("today's Hunt on a pool-6 day is the site's own draw, worth 5 PvP", () => {
    const today = doomsdaySnapshot(input).schedule.day;
    const i: DoomsdayInput = {
      ...input,
      goals: {
        "Ada#1001": {
          days: {
            [today]: {
              set: ["d.reward", "d.level", "d.potion", "p.revenge", "hunt"],
              swapped: {},
              done: { hunt: 1 },
              pool: 6,
            },
          },
          weeks: {},
        },
      },
    };
    const snap = doomsdaySnapshot(i);
    const ada = snap.friends.find((f) => f.friendKey === "Ada#1001")!;
    const h = ada.today!.goals.find((g) => g.goal.slot === "hunt")!;
    expect(h.goal).toEqual(snap.hunts.alliance);
    expect(h.goal.title).toBe(huntTitle(draw(today, 6).hunt!.Horde!));
    expect([h.points, h.doneAt]).toEqual([5, 1]);
  });
});
