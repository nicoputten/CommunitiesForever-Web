import { describe, expect, it } from "vitest";
import { featCardScore, featCardSize } from "@/core/doomsday/feats";
import { boardNews, type BoardData } from "@/core/doomsday/posts";
import { clockAt, doomsdayDay, GOALS, gridCount, partOfDay, resetsText, shortLabel } from "@/core/doomsday/rules";

// WEB-66 (Nico's live test of 2026-10-29): the day named by its reset, clock times within the day, the grid's count.

// Wed 2026-11-18 19:00 in Paris (18:00 UTC) to Thu 19:00.
const START = Date.UTC(2026, 10, 18, 18, 0) / 1000;
const END = START + 86400;
const PARIS = "Europe/Paris";

describe("the day by its reset", () => {
  it("names the part of the day by the reset hour", () => {
    expect([5, 11, 12, 16, 17, 22, 23, 0, 4].map(partOfDay)).toEqual([
      "morning",
      "morning",
      "afternoon",
      "afternoon",
      "evening",
      "evening",
      "night",
      "night",
      "night",
    ]);
  });

  it("names the day by its start, with its span, in the zone given", () => {
    expect(doomsdayDay(START, END, PARIS)).toEqual({ name: "Wed evening", span: "Wed 19:00 → Thu 19:00" });
    // The same day in London starts at 18:00: still the evening.
    expect(doomsdayDay(START, END, "Europe/London")).toEqual({ name: "Wed evening", span: "Wed 18:00 → Thu 18:00" });
    // In Bangkok it starts at 01:00 on Thursday.
    expect(doomsdayDay(START, END, "Asia/Bangkok").name).toBe("Thu night");
  });

  it("gives times after midnight their weekday", () => {
    expect(clockAt(START + 4 * 3600 + 13 * 60, START, PARIS)).toBe("23:13");
    expect(clockAt(START + 5 * 3600 + 4 * 60, START, PARIS)).toBe("Thu 00:04");
  });

  it("says when the day resets", () => {
    expect(resetsText(END, END - (6 * 3600 + 51 * 60), PARIS)).toBe("resets Thu 19:00 · in 6 h 51 m");
  });
});

describe("N of M done", () => {
  it("counts the grid: the dailies, the Hunt, the Skirmish and the Duel slot", () => {
    const goals = [{ doneAt: 1 }, {}, { doneAt: 2 }, {}, {}];
    expect(gridCount(goals, 0)).toEqual({ done: 2, total: 6 });
    // The Duel slot is done after its first duel.
    expect(gridCount(goals, 2)).toEqual({ done: 3, total: 6 });
    // Both Hunts of a friend with characters on both factions: 7.
    expect(gridCount([...goals, {}], 1).total).toBe(7);
  });
});

describe("short labels (WEB-66)", () => {
  it('has one of at most 10 characters for every goal, the Hunt\'s "Hunt"', () => {
    for (const g of GOALS) expect(shortLabel(g.id).length, g.id).toBeLessThanOrEqual(10);
    expect(GOALS.filter((g) => shortLabel(g.id) === "New goal").map((g) => g.id)).toEqual([]);
    expect(shortLabel("hunt:NightElf:DRUID")).toBe("Hunt");
  });
});

describe("which card a feat gets (WEB-66)", () => {
  it("is big for the special feats and anything first in the group, a strip for the rest, none for a new character", () => {
    expect(featCardSize({ kind: "pvpRank", fields: { rank: 6 } })).toBe("big");
    expect(featCardSize({ kind: "pvpRank", fields: { rank: 5 } })).toBe("strip");
    expect(featCardSize({ kind: "honorKills", fields: { kills: 1000 } })).toBe("big");
    expect(featCardSize({ kind: "honorKills", fields: { kills: 100 } })).toBe("strip");
    expect(featCardSize({ kind: "mount", fields: {} })).toBe("big");
    expect(featCardSize({ kind: "firstCatch", fields: {} })).toBe("strip");
    expect(featCardSize({ kind: "firstCatch", fields: {}, firstInGroup: true })).toBe("big");
    expect(featCardSize({ kind: "newCharacter", fields: {} })).toBeUndefined();
  });

  it("picks the most special for the post: big, then first in the group, then the rarer", () => {
    const strip = featCardScore({ kind: "level", fields: { level: 30 } });
    const firstStrip = featCardScore({ kind: "firstCatch", fields: {}, firstInGroup: true });
    const mount = featCardScore({ kind: "mount", fields: {} });
    const epic = featCardScore({ kind: "firstEpic", fields: {} });
    expect(firstStrip).toBeGreaterThan(mount);
    expect(epic).toBeGreaterThan(strip);
    expect(featCardScore({ kind: "newCharacter", fields: {} })).toBe(-1);
  });
});

describe("the board's news line (WEB-66)", () => {
  const board: BoardData = {
    day: 1,
    week: 1,
    label: "Wed evening",
    span: "Wed 19:00 → Thu 19:00",
    start: START,
    end: END,
    goals: [
      { slot: "pve1", id: "d.level", title: "Gain a level", track: "pve", points: 5, shortLabel: "Level" },
      {
        slot: "skirmish",
        id: "p.loneWolf",
        title: "Lone wolf: 3 solo kills",
        track: "pvp",
        points: 5,
        shortLabel: "Lone wolf",
      },
    ],
    friends: [
      {
        name: "Mira",
        goals: [],
        doneCount: 4,
        goalCount: 6,
        crossedOut: true,
        today: { pve: 15, pvp: 0 },
        week: { pve: 15, pvp: 0 },
        streak: 4,
        best: 4,
        pvpVirgin: false,
      },
      ...["Ada", "Tok"].map((name) => ({
        name,
        goals: [
          { slot: "pve1", id: "x", done: true },
          { slot: "pve2", id: "x", done: true },
        ],
        doneCount: 2,
        goalCount: 6,
        crossedOut: false,
        today: { pve: 10, pvp: 0 },
        week: { pve: 10, pvp: 0 },
        streak: 1,
        best: 1,
        pvpVirgin: false,
      })),
    ],
    withoutData: ["Sanne", "Jorrit"],
    crown: { name: "Mira", at: START + 4 * 3600 + 13 * 60 },
    yesterdayCrown: null,
  };

  it("names the goals at the reset", () => {
    expect(boardNews(board, "start", PARIS)).toBe(
      "New day, new doom. PvE Gain a level. PvP Lone wolf: 3 solo kills. 5 points each. 2 friends without addon data.",
    );
  });

  it("says who finished first and who is 1 away during the day", () => {
    expect(boardNews(board, "update", PARIS)).toBe(
      "Mira finished all dailies first (23:13). Ada and Tok are 1 away. 2 friends without addon data.",
    );
  });

  it("sums up the day at the end", () => {
    const summary = { goalsDone: 14, hunt: null, longestStreak: { name: "Tok", days: 7 } };
    expect(boardNews({ ...board, withoutData: [] }, "final", PARIS, summary)).toBe(
      "Day over: 14 goals done. Mira first at 23:13, longest streak Tok with 7. New board at 19:00.",
    );
  });
});
