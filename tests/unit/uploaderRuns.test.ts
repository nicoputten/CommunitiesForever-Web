import { describe, expect, it } from "vitest";
import { RUNNABLE_DUNGEONS } from "@/core/gamedata";
import type { RunRecord } from "@/core/runs";
import { uploaderRuns, type UploaderRunsInput } from "@/core/uploaderRuns";

// WEB-44: the uploader's runs list in the shape of the addon's CF_RUNS: which runs, the addon's dungeon ids, the
// mapping of states, sources and roles, and an updatedAt that only moves when the list changes.

const NOW = Date.UTC(2026, 10, 19, 20, 0) / 1000; // Thu 19 Nov 2026, 21:00 in Amsterdam
const HOUR = 3600;
const DAY = 24 * HOUR;

function run(id: number, over: Partial<RunRecord> = {}): RunRecord {
  return {
    id,
    dungeonId: "sm-armory",
    startsAt: NOW + 3 * HOUR,
    organiser: "Nico#2201",
    source: "website",
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY,
    answers: [
      { battleTag: "Nico#2201", guid: "VES", answer: "in", role: "damage", source: "website", answeredAt: NOW - DAY },
    ],
    ...over,
  };
}

const input = (runs: RunRecord[], now = NOW): UploaderRunsInput => ({
  runs,
  characterName: (guid) => ({ VES: "Ves Doombringer", LIA: "Lia Thornwhisper" })[guid],
  timeZoneOf: (tag) => (tag === "Bob#2002" ? "Europe/London" : "Europe/Amsterdam"),
  reminderMinutes: 30,
  siteUrl: "https://wow.example/",
  now,
});

describe("runs for the uploader", () => {
  it("is the addon's CF_RUNS, field for field", () => {
    const list = uploaderRuns(
      input([
        run(7, {
          note: "Bring water",
          answers: [
            {
              battleTag: "Nico#2201",
              guid: "VES",
              answer: "in",
              role: "damage",
              source: "website",
              answeredAt: NOW - DAY,
            },
            {
              battleTag: "Femke#3307",
              guid: "LIA",
              answer: "in",
              role: "healer",
              source: "discord",
              answeredAt: NOW - 1,
            },
            { battleTag: "Mira#1188", answer: "cant", role: "damage", source: "website", answeredAt: NOW - 2 },
          ],
        }),
      ]),
    );
    expect(list).toEqual({
      v: 1,
      updatedAt: NOW - DAY,
      reminderMinutes: 30,
      received: [],
      asks: [],
      runs: [
        {
          id: "r-7",
          dungeon: "smarm",
          dungeonName: "Scarlet Monastery: Armory",
          startsAt: NOW + 3 * HOUR,
          state: "open",
          source: "site",
          note: "Bring water",
          url: "https://wow.example/runs/7",
          organiser: { battleTag: "Nico#2201", guid: "VES", name: "Ves Doombringer", utcOffset: 3600 },
          answers: [
            {
              battleTag: "Nico#2201",
              guid: "VES",
              name: "Ves Doombringer",
              answer: "in",
              role: "dps",
              source: "site",
              at: NOW - DAY,
            },
            { battleTag: "Mira#1188", answer: "cant", role: "dps", source: "site", at: NOW - 2 },
            {
              battleTag: "Femke#3307",
              guid: "LIA",
              name: "Lia Thornwhisper",
              answer: "in",
              role: "heal",
              source: "discord",
              at: NOW - 1,
            },
          ],
        },
      ],
    });
  });

  it("lists the next 14 days, started runs until 2 hours after, cancelled ones until their start", () => {
    const runs = [
      run(1, { startsAt: NOW + 13 * DAY }),
      run(2, { startsAt: NOW + 15 * DAY }),
      run(3, { startsAt: NOW - HOUR }),
      run(4, { startsAt: NOW - 3 * HOUR }),
      run(5, { startsAt: NOW + HOUR, cancelledAt: NOW - 60, updatedAt: NOW - 60 }),
      run(6, { startsAt: NOW - 60, cancelledAt: NOW - HOUR }),
    ];
    const list = uploaderRuns(input(runs));
    expect(list.runs.map((r) => [r.id, r.state])).toEqual([
      ["r-3", "started"],
      ["r-5", "cancelled"],
      ["r-1", "open"],
    ]);
  });

  it("names every runnable dungeon, with the addon's id where it has one", () => {
    const ids = RUNNABLE_DUNGEONS.map((d) => [d.id, d.addonId]);
    expect(ids).toEqual(
      expect.arrayContaining([
        ["sm-graveyard", "smgy"],
        ["brs", "lbrs"],
        ["thanes", "lfg1984"],
        ["drowned", undefined],
      ]),
    );
    const drowned = uploaderRuns(input([run(1, { dungeonId: "drowned", answers: [] })])).runs[0]!;
    expect([drowned.dungeon, drowned.dungeonName]).toEqual(["drowned", "The Drowned City"]);
  });

  it("keeps updatedAt while nothing changes, and moves it when something does", () => {
    const runs = [run(1, { startsAt: NOW + 3 * HOUR })];
    const before = uploaderRuns(input(runs)).updatedAt;
    expect(uploaderRuns(input(runs, NOW + HOUR)).updatedAt).toBe(before);
    // It starts: the list changed (state started).
    expect(uploaderRuns(input(runs, NOW + 3 * HOUR)).updatedAt).toBe(NOW + 3 * HOUR);
    // A run 15 days out comes into the list a day later.
    const far = [run(2, { startsAt: NOW + 15 * DAY })];
    expect(uploaderRuns(input(far, NOW + DAY)).updatedAt).toBe(NOW + DAY);
    expect(uploaderRuns(input([run(3, { updatedAt: NOW - 5 })])).updatedAt).toBe(NOW - 5);
  });

  it("sends the organiser's own offset at the start, across daylight saving", () => {
    const bob = { organiser: "Bob#2002", answers: [] };
    expect(uploaderRuns(input([run(1, bob)])).runs[0]!.organiser).toEqual({ battleTag: "Bob#2002", utcOffset: 0 });
    // Summer in Amsterdam: +2.
    const summer = Date.UTC(2027, 6, 1, 18, 0) / 1000;
    const list = uploaderRuns(input([run(2, { startsAt: summer, answers: [] })], summer - DAY));
    expect(list.runs[0]!.organiser.utcOffset).toBe(7200);
  });
});
