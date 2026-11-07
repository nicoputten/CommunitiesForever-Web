import { describe, expect, it } from "vitest";
import type { BossKill } from "@/core/runProgress";
import type { RunAnswer, RunRecord } from "@/core/runs";
import { lastCleared, plannedBosses, runBosses, type ProgressBossInfo } from "@/core/views/bossProgress";
import { peopleViews, recordCharacters } from "@/core/views/characters";
import { dungeonPage } from "@/core/views/dungeon";
import type { RunsInput } from "@/core/views/runs";
import { NOW, sample } from "./sample";

// WEB-97 (board DL05) and WEB-102 (board DL04): boss progress on the run page, Planned here and Ran here, on the design
// prompt's group (sample.ts). The rule itself is the addon's golden cases (dungeonGolden.test.ts).

const HOUR = 3600;
const MIN = 60;
const TZ = "UTC";
const data = sample();
const people = peopleViews(data, NOW);
const characters = recordCharacters(data, NOW);
const tag = (name: string) => {
  const p = people.find((x) => x.displayName === name)!;
  return p.battleTag ?? p.key;
};
const NICO = tag("Nico");
const BOB = tag("Bob");
const FEMKE = tag("Femke");

// The Deadmines as the board has it: six bosses, VanCleef final, Cookie optional.
const DM: ProgressBossInfo[] = [
  { id: 1, name: "Rhahk'Zor", final: false, optional: false },
  { id: 2, name: "Sneed", final: false, optional: false },
  { id: 3, name: "Gilnid", final: false, optional: false },
  { id: 4, name: "Mr. Smite", final: false, optional: false },
  { id: 5, name: "Captain Greenskin", final: false, optional: false },
  { id: 6, name: "Edwin VanCleef", final: true, optional: false },
  { id: 7, name: "Cookie", final: false, optional: true },
];

const answer = (battleTag: string, a: RunAnswer["answer"], guid: string): RunAnswer => ({
  battleTag,
  answer: a,
  role: "damage",
  guid,
  source: "website",
  answeredAt: NOW - 5 * HOUR,
});

const START = NOW - HOUR;
const RESET = NOW + 10 * HOUR;
const RUN: RunRecord = {
  id: 1,
  dungeonId: "dm",
  startsAt: START,
  organiser: NICO,
  source: "website",
  createdAt: NOW - 5 * HOUR,
  updatedAt: NOW - 5 * HOUR,
  answers: [
    answer(NICO, "in", "Player-1-VES"),
    answer(BOB, "in", "Player-1-BOB"),
    answer(FEMKE, "maybe", "Player-1-LIA"),
  ],
};

const kill = (guid: string, encounterId: number, at: number): BossKill => ({ guid, encounterId, at });
const ctx = { characters, people, viewer: NICO, timeZone: TZ, now: NOW };
const clock = (at: number) => new Date(at * 1000).toISOString().slice(11, 16);

describe("the run page's Bosses box", () => {
  it("isn't there before the start", () => {
    expect(runBosses({ ...RUN, startsAt: NOW + HOUR }, DM, [], RESET, undefined, ctx)).toBeUndefined();
  });

  it("is there once the run started, before the first kill", () => {
    const box = runBosses(RUN, DM, [], RESET, undefined, ctx)!;
    expect(box.count).toBe("0 of 6");
    expect(box.rows.map((r) => r.state)).toEqual(["open", "open", "open", "open", "open", "open", "optional"]);
  });

  it("shows the kills of the group with their time and whose log, 3 of 6, as of the last upload", () => {
    const kills = [
      kill("Player-1-BOB", 1, START + 18 * MIN),
      kill("Player-1-LIA", 2, START + 31 * MIN),
      kill("Player-1-VES", 3, START + 44 * MIN),
      // Not in the group: Grom didn't answer.
      kill("Player-1-GROM", 4, START + 50 * MIN),
    ];
    const box = runBosses(RUN, DM, kills, RESET, { at: START + 45 * MIN, by: BOB }, ctx)!;
    expect(box.count).toBe("3 of 6");
    expect([box.done, box.total, box.cleared, box.status]).toEqual([3, 6, false, "started"]);
    expect(box.asOf).toBe(`as of ${clock(START + 45 * MIN)} · Bob’s upload`);
    expect(box.rows.slice(0, 4)).toEqual([
      {
        id: 1,
        name: "Rhahk'Zor",
        state: "killed",
        time: clock(START + 18 * MIN),
        tip: `Killed ${clock(START + 18 * MIN)} · from Bob’s log`,
      },
      {
        id: 2,
        name: "Sneed",
        state: "killed",
        time: clock(START + 31 * MIN),
        tip: `Killed ${clock(START + 31 * MIN)} · from Femke’s log`,
      },
      {
        id: 3,
        name: "Gilnid",
        state: "killed",
        time: clock(START + 44 * MIN),
        tip: `Killed ${clock(START + 44 * MIN)} · from your log`,
      },
      { id: 4, name: "Mr. Smite", state: "open" },
    ]);
  });

  it("says Cleared with the final boss's time, the optional boss skipped, and no upload line", () => {
    const kills = [kill("Player-1-BOB", 1, START + 18 * MIN), kill("Player-1-VES", 6, START + 84 * MIN)];
    const box = runBosses(RUN, DM, kills, RESET, { at: NOW, by: BOB }, ctx)!;
    expect(box.count).toBe(`Cleared · ${clock(START + 84 * MIN)}`);
    expect([box.cleared, box.status, box.asOf]).toEqual([true, "cleared", undefined]);
    expect(box.rows.at(-1)).toEqual({ id: 7, name: "Cookie", state: "skipped" });
  });

  it("isn't there for a cancelled run or a dungeon without bosses", () => {
    expect(runBosses({ ...RUN, cancelledAt: START }, DM, [], RESET, undefined, ctx)).toBeUndefined();
    expect(runBosses(RUN, [], [], RESET, undefined, ctx)).toBeUndefined();
  });

  it("lists every wing of a whole Stratholme from before the wings under its name, cleared by any wing's final", () => {
    const strat: ProgressBossInfo[] = [
      { id: 11, name: "Timmy the Cruel", final: false, optional: false, wingId: "live" },
      { id: 12, name: "Balnazzar", final: true, optional: false, wingId: "live" },
      { id: 21, name: "Baroness Anastari", final: false, optional: false, wingId: "undead" },
      { id: 22, name: "Baron Rivendare", final: true, optional: false, wingId: "undead" },
    ];
    const old = { ...RUN, dungeonId: "strat" };
    const box = runBosses(old, strat, [], RESET, undefined, ctx)!;
    expect(box.count).toBe("0 of 4");
    expect(box.rows.map((r) => r.wing)).toEqual(["Main Gate", undefined, "Service Gate", undefined]);
    const going = runBosses(old, strat, [kill("Player-1-VES", 21, START + MIN)], RESET, undefined, ctx)!;
    expect(going.count).toBe("1 of 4");
    // A wing's own run has no wing names.
    expect(
      runBosses({ ...old, dungeonId: "strat-undead" }, strat.slice(2), [], RESET, undefined, ctx)!.rows[0]!.wing,
    ).toBeUndefined();
    const done = runBosses(old, strat, [kill("Player-1-VES", 22, START + 9 * MIN)], RESET, undefined, ctx)!;
    expect(done.cleared).toBe(true);
  });
});

describe("Planned here and Ran here", () => {
  it("says the bosses once the run has a kill", () => {
    expect(plannedBosses(RUN, DM, [], NOW, RESET)).toBeUndefined();
    expect(plannedBosses(RUN, DM, [kill("Player-1-VES", 1, START + MIN)], NOW, RESET)).toBe("1 of 6 bosses");
    expect(plannedBosses(RUN, DM, [kill("Player-1-VES", 6, START + MIN)], NOW, RESET)).toBe("cleared");
  });

  it("shows the boss progress in the planned run's line on the dungeon page", () => {
    const input: RunsInput = {
      runs: [RUN],
      characters,
      people,
      viewer: { battleTag: NICO, isAdmin: true, timeZone: TZ },
      timeZoneOf: () => TZ,
      now: NOW,
    };
    const kills = [1, 2, 3].map((id) => kill("Player-1-VES", id, START + id * MIN));
    const page = dungeonPage(input, "dm", { bosses: DM, kills, resetAfter: () => RESET })!;
    expect(page.planned[0]!.summary).toBe("2 in · 3 of 6 bosses");
    expect(dungeonPage(input, "dm")!.planned[0]!.summary).toBe("2 in · 1 maybe · tank, healer and damage open");
  });

  it("Last cleared: the newest kill of the final boss, with who killed it then", () => {
    const at = NOW - 26 * HOUR;
    const kills = [
      kill("Player-1-GROM", 6, at),
      kill("Player-1-MIRA", 6, at + 1),
      kill("Player-1-LIA", 6, at + 2),
      kill("Player-1-VES", 6, NOW - 9 * 24 * HOUR),
      // Not the final boss.
      kill("Player-1-BOB", 5, NOW - HOUR),
    ];
    const last = lastCleared(DM, kills, ctx)!;
    expect(last.group.map((c) => c.name)).toEqual(["Grom Ashfeller", "Lia Thornwhisper", "Mira Sunstrider"]);
    expect(last.group[0]!.colorToken).toBe("--warrior");
    expect(last.day).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
    expect(lastCleared(DM, [kill("Player-1-BOB", 5, NOW)], ctx)).toBeUndefined();
    expect(lastCleared(DM, [kill("Player-1-BOB", 6, NOW - 20 * 24 * HOUR)], ctx)!.day).toMatch(/^\w{3} \d+ \w{3}$/);
  });
});
