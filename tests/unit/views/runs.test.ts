import { describe, expect, it } from "vitest";
import type { RunAnswer, RunRecord } from "@/core/runs";
import { peopleViews, recordCharacters } from "@/core/views/characters";
import {
  BAND_RUNS,
  joinableUnanswered,
  planPage,
  rosterRuns,
  runDetail,
  runsPage,
  type RunsInput,
} from "@/core/views/runs";
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
      // Finding 11: one summary instead of the warning hint.
      summary: "2 in · 1 maybe · 3 open · no tank or damage in range",
    });
    expect(armory!.hint).toBeUndefined();
    expect(armory!.slots.map((s) => s.filled)).toEqual([false, true, true, false, false]);
    expect(armory!.slots.map((s) => s.letter).join("")).toBe("THDDD");
    expect(armory!.slotRows).toEqual(["Tank · open", "Healer · Lia Thornwhisper", "Damage · Ves Doombringer · 2 open"]);
    expect(armory!.answer).toBeUndefined();
    // Your answers (WEB-49): with character and role.
    expect(runsPage(input(NICO), "join").yourAnswers.find((a) => a.href === "/runs/1")!.status).toBe(
      "organiser as Ves Doombringer · Damage",
    );
    expect(library!.organiserTime).toMatch(/^\d{2}:\d{2} for Bob$/);
    expect(library!.line).toBe("29–39 · Bob on Tok Ironhide (healer)");
    // Nico hasn't answered Bob's run and Ves fits: answer buttons on the card.
    expect(library!.answer?.characters[0]).toMatchObject({ name: "Ves Doombringer", fits: true });
    expect(library!.hint).toEqual({ text: "Your Ves Doombringer fits", tone: "good" });
  });

  it("words the hint with the fit label: over still counts as one you can join (WEB-47)", () => {
    const rfk = run(9, { dungeonId: "rfk", organiser: BOB, startsAt: NOW + 26 * HOUR }); // 29–38: Ves (39) is +1 over
    const page = runsPage(input(NICO, { runs: [rfk] }), "join");
    expect(page.thisWeek.map((r) => r.hint?.text)).toEqual(["Your Ves Doombringer can join · +1 over"]);
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
      // One fact per open slot (WEB-49, finding 1): nobody in range, and who is closest below.
      ["tank", "No tank in range · Kel Dawnhammer is 14 below"],
      ["healer", "Lia Thornwhisper"],
      ["damage", "Ves Doombringer"],
      ["damage", "No damage in range · Ruk Bloodhoof is 5 below"],
      ["damage", "No damage in range · Ruk Bloodhoof is 5 below"],
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
    // Ruk (27) is 8 below the Cathedral: Maybe only (WEB-47). 5 below the Armory he may still join.
    expect(runDetail(input(JORRIT), 1)!.outOfRange).toBeUndefined();
    const d = runDetail(input(JORRIT), 4)!;
    expect(d.outOfRange).toBe(
      "Ruk Bloodhoof (27) is below the Cathedral (35–45), so I'm in is off. Maybe or Can't still go.",
    );
    expect(d.planOther).toEqual({
      label: "Plan the Graveyard for Ruk Bloodhoof",
      href: "/runs/new?dungeon=sm-graveyard",
    });
  });
});

describe("a run's page v2 (WEB-49)", () => {
  it("gives the organiser their bar and a ⋯ menu on every filled slot, their own too", () => {
    const d = runDetail(input(NICO), 1)!;
    expect(d.isOrganiser).toBe(true);
    expect(d.leadBar).toMatchObject({ state: "playing", character: "Ves Doombringer", role: "Damage" });
    expect(d.summary).toBeUndefined();
    const own = d.slots.find((s) => s.who?.character === "Ves Doombringer")!;
    expect(own.who).toMatchObject({ yours: true, initials: "VD", fit: { kind: "fits", label: "fits" } });
    expect(own.menu!.map((o) => [o.label, o.detail ?? "", Boolean(o.disabled)])).toEqual([
      ["Tank", "not for warlocks", true],
      ["Healer", "not for warlocks", true],
      ["Damage", "current", true],
      ["Bench yourself", "", false],
      ["Leave the group", "", false],
    ]);
    const lia = d.slots.find((s) => s.who?.character === "Lia Thornwhisper")!;
    expect(lia.menu!.map((o) => o.label)).toEqual([
      "Tank",
      "Healer",
      "Move to Damage",
      "Move to reserve",
      "Remove from run",
    ]);
    expect(lia.menu!.at(-1)).toMatchObject({ to: "remove", danger: true });
    expect(d.maybes).toEqual(["Tok Ironhide 33 · healer"]);
    expect(d.reserves).toEqual([]);
    expect(d.mayMove).toBe(true);
  });

  it("gives a friend the picker and their answer collapsed, and no menus", () => {
    const d = runDetail(input(BOB), 1)!;
    expect(d.leadBar).toBeUndefined();
    expect(d.mayMove).toBe(false);
    expect(d.slots.every((s) => s.menu === undefined)).toBe(true);
    expect(d.picker.title).toBe("Join Scarlet Monastery: Armory");
    expect(d.picker.roles.healer).toEqual({ state: "full → reserve", full: true });
    expect(d.picker.roles.damage).toEqual({ state: "2 open", full: false });
    const tok = runDetail(input(BOB), 1)!.answers.find((a) => a.character === "Tok Ironhide")!;
    expect(tok.where).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d\d:\d\d · /);
    expect(tok.fit).toBe("fits");
  });

  it("lists every character in the picker with its fit, roles and note", () => {
    const d = runDetail(input(JORRIT), 4)!;
    const ruk = d.picker.characters.find((c) => c.name === "Ruk Bloodhoof")!;
    expect(ruk).toMatchObject({
      fit: { kind: "tooLow", label: "8 below" },
      onlyMaybe: true,
      roles: ["damage"],
      notFor: "not for hunters",
      note: "8 levels below: you can only answer Maybe.",
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
    expect(p.leadPicker["sm-armory"]!.map((c) => `${c.name} ${c.fit.label}`)).toEqual([
      "Ves Doombringer fits",
      "Grom Ashfeller 8 below",
      "Sela Moonbrook 20 below",
    ]);
    expect(p.otherZones).toEqual([{ name: "Bob", timeZone: "Europe/London" }]);
  });

  // WEB-49 (board runs-v2-plan): the dropdown's groups and best fit, and no guessed dungeon (finding 6).
  it("puts the dungeons that fit the viewer first, each with the viewer's best character", () => {
    const p = planPage(input(NICO), undefined);
    const firstOther = p.dungeons.findIndex((d) => !d.fitsYou);
    expect(firstOther).toBeGreaterThan(0);
    expect(p.dungeons.slice(firstOther).every((d) => !d.fitsYou)).toBe(true);
    const mins = (list: typeof p.dungeons) => list.map((d) => d.range.min);
    expect(mins(p.dungeons.slice(0, firstOther))).toEqual(
      [...mins(p.dungeons.slice(0, firstOther))].sort((a, b) => a - b),
    );
    expect(mins(p.dungeons.slice(firstOther))).toEqual([...mins(p.dungeons.slice(firstOther))].sort((a, b) => a - b));
    const d = (id: string) => p.dungeons.find((x) => x.id === id)!;
    expect(d("sm-armory")).toMatchObject({
      fitsYou: true,
      best: { text: "Ves 39 fits", tone: "good" },
      wingOf: "Scarlet Monastery",
    });
    expect(d("strat").best).toEqual({ text: "no fit" });
    expect(d("thanes").forever).toBe(true);
    expect(d("rfc").forever).toBe(false);
    // Ves 39 is the best for Zul'Farrak (44–54): 5 below, the most it may be and still join.
    expect(d("zf").best).toEqual({ text: "Ves 5 below", tone: "warn" });
    // Many dungeons fit Nico's characters: nothing is guessed; a dungeon page still fills it in.
    expect(p.dungeonId).toBeUndefined();
    expect(planPage(input(NICO), "nope").dungeonId).toBeUndefined();
    expect(planPage(input(NICO), "sm-armory").dungeonId).toBe("sm-armory");
  });
});

describe("runs on the roster (WEB-45)", () => {
  it("the next upcoming run, as the board's card says it, and each dungeon's runs for its band", () => {
    const r = rosterRuns(input(BOB));
    // Run 1 starts first (in 3 hours); the past and the cancelled run are left out.
    expect(r.next).toMatchObject({ href: "/runs/1", dungeon: "Scarlet Monastery: Armory" });
    expect(r.next!.line).toBe("Nico on Ves Doombringer · 2 in · 1 maybe · tank open · 2 damage open");
    expect(r.byDungeon["sm-armory"]!.runs).toEqual([{ href: "/runs/1", label: `${r.next!.when} · 2 in` }]);
    expect(Object.keys(r.byDungeon).sort()).toEqual(["sm-armory", "sm-cathedral", "sm-library", "zf"]);
    // The organiser reads "You lead as".
    expect(rosterRuns(input(NICO)).next!.line).toMatch(/^You lead as Ves Doombringer · /);
  });

  it("no card without an upcoming run; at most three runs per band, then a count", () => {
    expect(rosterRuns(input(BOB, { runs: [] })).next).toBeUndefined();
    const many = [1, 2, 3, 4, 5].map((i) => run(10 + i, { startsAt: NOW + i * HOUR }));
    const band = rosterRuns(input(BOB, { runs: many })).byDungeon["sm-armory"]!;
    expect(band.runs).toHaveLength(BAND_RUNS);
    expect(band.more).toBe(2);
  });
});
