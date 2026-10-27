import { describe, expect, it } from "vitest";
import type { RunAnswer, RunRecord } from "@/core/runs";
import { peopleViews, recordCharacters } from "@/core/views/characters";
import { joinableUnanswered, planPage, runDetail, runsPage, type RunsInput } from "@/core/views/runs";
import { NOW, sample } from "./sample";

// WEB-40: the Runs pages' view model on the design prompt's group (sample.ts: Nico plays Ves 39, Grom 24, Sela 12;
// Bob plays Bob Example 41 and Tok Ironhide 33; Femke plays Lia 37; Jorrit plays Ruk 27; Mira plays Mira 60, Kel 18).

const HOUR = 3600;
const data = sample();
const people = peopleViews(data, NOW);
const tag = (name: string) =>
  people.find((p) => p.displayName === name)!.battleTag ?? people.find((p) => p.displayName === name)!.key;
const NICO = tag("Nico");
const BOB = tag("Bob");
const FEMKE = tag("Femke");
const JORRIT = tag("Jorrit");

const answer = (
  battleTag: string,
  a: RunAnswer["answer"],
  guid: string | undefined,
  role: RunAnswer["role"],
  at = NOW,
): RunAnswer => ({
  battleTag,
  answer: a,
  role,
  source: "website",
  answeredAt: at,
  ...(guid === undefined ? {} : { guid }),
});

function run(id: number, over: Partial<RunRecord>): RunRecord {
  return {
    id,
    dungeonId: "sm-armory",
    startsAt: NOW + 3 * HOUR,
    organiser: NICO,
    source: "website",
    createdAt: NOW,
    updatedAt: NOW,
    answers: [],
    ...over,
  };
}

const RUNS: RunRecord[] = [
  run(1, {
    note: "Bring water",
    answers: [
      answer(NICO, "in", "Player-1-VES", "damage", NOW - 3),
      answer(FEMKE, "in", "Player-1-LIA", "healer", NOW - 2),
      answer(BOB, "maybe", "Player-1-TOK", "healer", NOW - 1),
    ],
  }),
  run(2, {
    dungeonId: "sm-library",
    organiser: BOB,
    startsAt: NOW + 26 * HOUR,
    answers: [answer(BOB, "in", "Player-1-TOK", "healer")],
  }),
  run(3, { dungeonId: "zf", organiser: BOB, startsAt: NOW + 30 * HOUR }),
  run(4, { dungeonId: "sm-cathedral", organiser: FEMKE, startsAt: NOW + 9 * 24 * HOUR }),
  run(5, { dungeonId: "sfk", organiser: FEMKE, startsAt: NOW - 5 * HOUR }),
  run(6, { dungeonId: "wc", organiser: BOB, startsAt: NOW + 5 * HOUR, cancelledAt: NOW, cancelledBy: BOB }),
];

const input = (viewer: string, over: Partial<RunsInput> = {}): RunsInput => ({
  runs: RUNS,
  characters: recordCharacters(data, NOW),
  people,
  viewer: { battleTag: viewer, isAdmin: viewer === NICO, timeZone: "Europe/Amsterdam" },
  timeZoneOf: (t) => (t === BOB ? "Europe/London" : "Europe/Amsterdam"),
  now: NOW,
  ...over,
});

describe("the runs list", () => {
  it("shows the runs you can join by this week and later, the others hidden, the past last", () => {
    const page = runsPage(input(NICO), "join");
    expect(page.thisWeek.map((r) => r.dungeon)).toEqual(["Scarlet Monastery: Armory", "Scarlet Monastery: Library"]);
    expect(page.later.map((r) => r.dungeon)).toEqual(["Scarlet Monastery: Cathedral"]);
    expect(page.hidden).toMatch(/^1 run hidden by “Runs I can join”: Zul'Farrak on .+ \(44–54\)\.$/);
    expect(page.past.map((p) => [p.dungeon, p.result.label])).toEqual([
      ["Wailing Caverns", "Cancelled"],
      ["Shadowfang Keep", "0 in"],
    ]);
    expect(runsPage(input(NICO), "all").hidden).toBeUndefined();
    expect(runsPage(input(NICO), "mine").thisWeek.map((r) => r.id)).toEqual([1]);
  });

  it("describes a card: yours, the line, what's open, the organiser's own clock", () => {
    const [armory, library] = runsPage(input(NICO), "join").thisWeek;
    expect(armory).toMatchObject({
      yours: true,
      pill: { label: "Open", tone: "open" },
      line: "32–42 · You lead as Ves Doombringer · Lia Thornwhisper in · Tok Ironhide maybe",
      tally: "2 in · 1 maybe",
      hint: { text: "Tank and damage still open: nobody in range", tone: "warn" },
    });
    expect(armory!.slots.map((s) => s.filled)).toEqual([false, true, true, false, false]);
    expect(armory!.answer).toBeUndefined();
    expect(library!.organiserTime).toMatch(/^\d{2}:\d{2} for Bob$/);
    expect(library!.line).toBe("29–39 · Bob on Tok Ironhide (healer)");
    // Nico hasn't answered Bob's run and Ves fits: answer buttons on the card.
    expect(library!.answer?.characters[0]).toMatchObject({ name: "Ves Doombringer", fits: true });
    expect(library!.hint).toEqual({ text: "Your Ves Doombringer fits", tone: "good" });
  });

  it("counts the runs you can join and haven't answered: the top bar's badge", () => {
    expect(joinableUnanswered(input(NICO))).toBe(2);
    expect(joinableUnanswered(input(FEMKE))).toBe(1);
  });
});

describe("a run's page", () => {
  it("lists the five slots, the answers (organiser first) and who could join", () => {
    const d = runDetail(input(BOB), 1)!;
    expect(d.plannedBy).toBe("Planned by Nico on the website");
    expect(d.levels).toBe("Levels 32–42 · organiser Ves Doombringer (39 Warlock)");
    expect(d.slots.map((s) => [s.role, s.who?.character ?? s.open])).toEqual([
      ["tank", "Nobody in range yet"],
      ["healer", "Lia Thornwhisper"],
      ["damage", "Ves Doombringer"],
      ["damage", "Nobody in range yet"],
      ["damage", "Nobody in range yet"],
    ]);
    expect(d.answers.map((a) => [a.character, a.answer])).toEqual([
      ["Ves Doombringer", "Organiser"],
      ["Lia Thornwhisper", "I'm in"],
      ["Tok Ironhide", "Maybe"],
    ]);
    expect(d.group).toBe("2 in · 1 maybe · 3 open");
    expect([d.mayEdit, d.mayDelete]).toEqual([false, false]);
    expect(runDetail(input(NICO), 6)).toMatchObject({ mayDelete: false, cancelled: "Cancelled by Bob" });
    expect(runDetail(input(NICO), 2)).toMatchObject({ mayEdit: false, mayDelete: true, adminDelete: true });
  });

  it("says why I'm in is off, and offers the wing that fits", () => {
    const d = runDetail(input(JORRIT), 1)!;
    expect(d.outOfRange).toBe(
      "Ruk Bloodhoof (27) is below the Armory (32–42), so I'm in is off. Maybe or Can't still go.",
    );
    expect(d.planOther).toEqual({
      label: "Plan the Graveyard for Ruk Bloodhoof",
      href: "/runs/new?dungeon=sm-graveyard",
    });
  });
});

describe("Plan a run", () => {
  it("lists every runnable dungeon with who fits, your characters to lead as, friends in other zones", () => {
    const p = planPage(input(NICO), "sm-armory");
    expect(p.dungeonId).toBe("sm-armory");
    expect(p.dungeons.find((d) => d.id === "sm-armory")).toMatchObject({
      label: "Scarlet Monastery: Armory · 32–42",
      fits: "Fits 3 friends' characters · no tank in range yet",
    });
    expect(p.dungeons.some((d) => d.id === "sm")).toBe(false);
    expect(p.leads["sm-armory"]!.map((l) => l.label)).toEqual([
      "Ves Doombringer 39 · damage",
      "Grom Ashfeller 24 · too low",
      "Sela Moonbrook 12 · too low",
    ]);
    expect(p.otherZones).toEqual([{ name: "Bob", timeZone: "Europe/London" }]);
    expect(planPage(input(NICO), "nope").dungeonId).toBe("sm-armory");
  });
});
