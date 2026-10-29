import { describe, expect, it } from "vitest";
import type { FeedDay } from "@/core/feed";
import { CARDS } from "@/core/recap/cards";
import { challengesFor, headlineFor } from "@/core/recap/recap";
import type { History, RecapChar, Week } from "@/core/recap/types";
import { END, START } from "./sample";

// WEB-57: each recap v2 card shows at its threshold (the boards' "Shows when", Nico 2026-10-29), not below it, and
// not without the addon's data; the PvP and danger headlines and the new challenges.

const DAY = 86400;
const H = 3600;
const NO_HISTORY: History = { weeks: [], cycles: {} };
const D = Math.floor(START / DAY) + 1;

const char = (guid: string, owner: string, name: string, extra: Partial<RecapChar> = {}): RecapChar => ({
  guid,
  owner,
  name,
  professions: [],
  quests: [],
  level: 30,
  ...extra,
});

const CHARS = {
  a: char("a", "ada", "Ada Example"),
  b: char("b", "bob", "Bob Example"),
  c: char("c", "cid", "Cid Example"),
  d: char("d", "dee", "Dee Example"),
  e: char("e", "eve", "Eve Example"),
};

function week(
  days: { guid: keyof typeof CHARS; n?: number; entry: Partial<FeedDay> }[],
  extra: Partial<Week> = {},
): Week {
  return {
    number: 5,
    start: START,
    end: END,
    siteName: "Doombringers",
    friends: ["ada", "bob", "cid", "dee", "eve"].map((key) => ({ key, name: key[0]!.toUpperCase() + key.slice(1) })),
    before: Object.fromEntries(Object.values(CHARS).map((c) => [c.guid, c])),
    after: Object.fromEntries(Object.values(CHARS).map((c) => [c.guid, c])),
    days: days.map(({ guid, n = 1, entry }) => ({
      day: D + n,
      guid,
      owner: CHARS[guid].owner,
      entry: { quests: {}, ranks: {}, learned: [], runs: [], at: START + n * DAY, ...entry },
    })),
    sightings: [],
    zonesBefore: [],
    totalZones: 39,
    lastSeen: {},
    monthAgo: [],
    lastActiveBefore: {},
    ...extra,
  };
}

const shows = (id: string, w: Week) => CARDS.find((c) => c.id === id)!.find(w, NO_HISTORY) !== undefined;
const deaths = (n: number, cause = "creature", zone = "Duskwood") =>
  Array.from({ length: n }, (_, i) => ({ t: START + DAY + i, zone, cause }) as NonNullable<FeedDay["deaths"]>[number]);
const duels = (n: number, won: boolean, vs: string) =>
  Array.from({ length: n }, (_, i) => ({ t: START + DAY + i, won, vs }));
const bg = (n: number, won = true, name = "Warsong Gulch") =>
  Array.from({ length: n }, () => ({ name, kind: "pvp", won, with: [] }));
const session = (fromHour: number, hours: number) => [
  { from: START + DAY + fromHour * H, to: START + DAY + (fromHour + hours) * H },
];

/** At the threshold, one below, and the same week without the field. */
const CASES: [string, Partial<FeedDay>, Partial<FeedDay>][] = [
  ["A11", { kills: { Ashenvale: 25 } }, { kills: { Ashenvale: 24 } }],
  ["A12", { runs: bg(3) }, { runs: bg(2) }],
  ["A13", { loot: { rare: 3, epic: [{ name: "Example Blade" }] } }, { loot: { rare: 3, epic: [] } }],
  ["A14", { duels: duels(5, true, "Someone Else") }, { duels: duels(4, true, "Someone Else") }],
  ["S13", { kills: { Ashenvale: 20 } }, { kills: { Ashenvale: 19 } }],
  ["S14", { runs: bg(3, false) }, { runs: bg(2, false) }],
  ["S15", { deaths: deaths(5) }, { deaths: deaths(4) }],
  ["F16", { deaths: deaths(6) }, { deaths: deaths(5) }],
  ["F17", { deaths: deaths(1, "fall") }, { deaths: deaths(1, "drown") }],
  ["F18", { deaths: deaths(1, "lava") }, { deaths: deaths(1, "fatigue") }],
  ["F20", { gold: { spent: 500000 } }, { gold: { spent: 499999 } }],
  ["F21", { loot: { rare: 0, epic: [{ name: "Example Blade" }] } }, { loot: { rare: 9, epic: [] } }],
  ["F22", { sessions: session(1, 5) }, { sessions: session(1, 4.9) }],
  ["F7", { sessions: session(-14, 3.5) }, { sessions: session(-14, 2.9) }],
  ["F8", { sessions: session(-6, 1) }, { sessions: session(-4, 1) }],
];

describe("recap v2 cards: threshold and data", () => {
  it.each(CASES)("%s shows at its threshold, not below it, and not without the data", (id, at, below) => {
    expect(shows(id, week([{ guid: "a", entry: at }])), "at").toBe(true);
    expect(shows(id, week([{ guid: "a", entry: below }])), "below").toBe(false);
    expect(shows(id, week([{ guid: "a", entry: {} }])), "no data").toBe(false);
  });

  it("A7 Social butterfly and S11 Biggest group night: grouped with friends", () => {
    const three = week([{ guid: "a", entry: { groups: ["b", "c", "d"] } }]);
    const two = week([{ guid: "a", entry: { groups: ["b", "c"] } }]);
    expect([shows("A7", three), shows("S11", three)]).toEqual([true, true]);
    expect([shows("A7", two), shows("S11", two)]).toEqual([false, false]);
    // Own alts don't count.
    expect(shows("A7", week([{ guid: "a", entry: { groups: ["a", "b", "c"] } }]))).toBe(false);
    expect(shows("A7", week([{ guid: "a", entry: {} }]))).toBe(false);
  });

  it("P14 Rank race: the same rank, this week's honor within 10%", () => {
    const ranked = (a: number, b: number, rankB = 6) =>
      week([], {
        after: {
          ...Object.fromEntries(Object.values(CHARS).map((c) => [c.guid, c])),
          a: { ...CHARS.a, pvpRank: 6, weekHonor: a },
          b: { ...CHARS.b, pvpRank: rankB, weekHonor: b },
        },
      });
    expect(shows("P14", ranked(1000, 900))).toBe(true);
    expect(shows("P14", ranked(1000, 899))).toBe(false);
    expect(shows("P14", ranked(1000, 1000, 7))).toBe(false);
    expect(shows("P14", week([]))).toBe(false);
  });

  it("F14 Revenge: 3 deaths to players, then 10 kills", () => {
    expect(shows("F14", week([{ guid: "a", entry: { deaths: deaths(3, "player"), kills: { Ashenvale: 10 } } }]))).toBe(
      true,
    );
    expect(shows("F14", week([{ guid: "a", entry: { deaths: deaths(3, "player"), kills: { Ashenvale: 9 } } }]))).toBe(
      false,
    );
    expect(
      shows("F14", week([{ guid: "a", entry: { deaths: deaths(3, "creature"), kills: { Ashenvale: 30 } } }])),
    ).toBe(false);
  });

  it("F15 Duel rivals: a pair of friends dueled 4 times (each side records them once)", () => {
    const pair = (n: number) =>
      week([
        { guid: "a", entry: { duels: duels(n, true, "Bob Example") } },
        { guid: "b", entry: { duels: duels(n, false, "Ada Example") } },
      ]);
    const f = CARDS.find((c) => c.id === "F15")!.find(pair(4), NO_HISTORY);
    expect(f?.facts).toMatchObject({ first: "Ada", second: "Bob", score: "4–0", duels: 4 });
    expect(shows("F15", pair(3))).toBe(false);
    // Duels against strangers or own alts aren't rivals.
    expect(shows("F15", week([{ guid: "a", entry: { duels: duels(9, true, "Some Stranger") } }]))).toBe(false);
  });

  it("F19 Untouchable: 5 levels without dying, only when deaths are known", () => {
    const levelled = (deathsField: Partial<FeedDay>, gained = 5) =>
      week([{ guid: "a", entry: deathsField }], {
        after: {
          ...Object.fromEntries(Object.values(CHARS).map((c) => [c.guid, c])),
          a: { ...CHARS.a, level: 30 + gained },
        },
      });
    expect(shows("F19", levelled({ deaths: [] }))).toBe(true);
    expect(shows("F19", levelled({ deaths: [] }, 4))).toBe(false);
    expect(shows("F19", levelled({ deaths: deaths(1) }))).toBe(false);
    expect(shows("F19", levelled({}))).toBe(false);
  });

  it("F20 Big spender never shows the amount", () => {
    const f = CARDS.find((c) => c.id === "F20")!.find(
      week([{ guid: "a", entry: { gold: { spent: 900000 } } }]),
      NO_HISTORY,
    )!;
    expect(Object.values(f.facts).join(" ")).not.toMatch(/\d/);
  });
});

describe("recap v2 headlines and challenges", () => {
  const kills = (zones: Record<string, number>) => week([{ guid: "a", entry: { kills: zones } }]);

  it("PvP: 200 kills with one zone at 40% or more", () => {
    expect(headlineFor(kills({ "Hillsbrad Foothills": 80, Ashenvale: 120 }), false).id).toBe("pvp");
    expect(headlineFor(kills({ "Hillsbrad Foothills": 79, Ashenvale: 60, Desolace: 60 }), false).id).not.toBe("pvp");
    expect(headlineFor(kills({ Ashenvale: 199 }), false).id).not.toBe("pvp");
  });

  it("danger: 25 deaths and at least 1.5 times the last 4 weeks' average", () => {
    const w = week([{ guid: "a", entry: { deaths: deaths(30) } }]);
    const past = (deaths: number) => ({
      weeks: [1, 2, 3, 4].map((number) => ({ number, cards: [], values: { deaths }, levelsByFriend: {} })),
      cycles: {},
    });
    expect(headlineFor(w, false, past(20)).id).toBe("danger");
    expect(headlineFor(w, false, past(21)).id).not.toBe("danger");
    expect(headlineFor(week([{ guid: "a", entry: { deaths: deaths(24) } }]), false).id).not.toBe("danger");
  });

  it("the challenges that follow a PvP week", () => {
    const ids = (w: Week, happened = {}) => challengesFor(w, happened).map((c) => c.id);
    expect(ids(week([{ guid: "a", entry: { runs: bg(3) } }]))).toContain("bgGroup");
    expect(ids(week([{ guid: "a", entry: { runs: bg(2) } }]))).not.toContain("bgGroup");
    expect(ids(kills({ "Hillsbrad Foothills": 5, Ashenvale: 9, Desolace: 7, Tanaris: 1 }))).toContain("tarrenMill");
    expect(ids(kills({ "Hillsbrad Foothills": 1, Ashenvale: 9, Desolace: 7, Tanaris: 3 }))).not.toContain("tarrenMill");
    expect(ids(week([]), { headline: "pvp" })).toContain("kills25");
    expect(ids(week([]), { headline: "danger" })).toContain("noDeaths");
    expect(ids(week([]), { cards: ["F15"] })).toContain("duelEveryone");
    expect(ids(week([]))).not.toContain("kills25");
  });
});
