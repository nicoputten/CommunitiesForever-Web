import { describe, expect, it } from "vitest";
import type { RunAnswer, RunRecord } from "@/core/runs";
import { peopleViews, recordCharacters } from "@/core/views/characters";
import { dungeonPage, dungeonPageId, mapDungeons, plannedSummary, RAN_SHOWN } from "@/core/views/dungeon";
import { entranceMap } from "@/core/views/map";
import type { RunsInput } from "@/core/views/runs";
import { NOW, sample } from "./sample";

// WEB-42: the dungeon page and the map's dungeon entrances on the design prompt's group (sample.ts: Nico plays Ves 39,
// Grom 24, Sela 12; Bob plays Bob Example 41 and Tok Ironhide 33; Femke plays Lia 37; Jorrit plays Ruk 27; Mira plays
// Mira 60, Kel 18), as on the board.

const HOUR = 3600;
const DAY = 24 * HOUR;
const data = sample();
const people = peopleViews(data, NOW);
const tag = (name: string) => {
  const p = people.find((x) => x.displayName === name)!;
  return p.battleTag ?? p.key;
};
const NICO = tag("Nico");
const BOB = tag("Bob");
const FEMKE = tag("Femke");

const answer = (battleTag: string, a: RunAnswer["answer"], guid: string, role: RunAnswer["role"]): RunAnswer => ({
  battleTag,
  answer: a,
  role,
  guid,
  source: "website",
  answeredAt: NOW,
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
    answers: [
      answer(NICO, "in", "Player-1-VES", "damage"),
      answer(FEMKE, "in", "Player-1-LIA", "healer"),
      answer(BOB, "maybe", "Player-1-TOK", "healer"),
    ],
  }),
  run(2, { dungeonId: "sm-library", organiser: BOB, startsAt: NOW + 26 * HOUR }),
  run(3, { dungeonId: "sm-cathedral", organiser: FEMKE, startsAt: NOW + 9 * DAY }),
  run(4, { dungeonId: "zf", organiser: BOB, startsAt: NOW + 30 * HOUR }),
  run(5, { startsAt: NOW + 5 * HOUR, cancelledAt: NOW, cancelledBy: NICO }),
  run(6, { startsAt: NOW - 2 * DAY, outcome: { kind: "done", at: NOW - 2 * DAY, came: 3, signedUp: 5 } }),
  run(7, { startsAt: NOW - 3 * DAY, outcome: { kind: "didntHappen", at: NOW - 3 * DAY } }),
  run(8, { dungeonId: "sm-library", startsAt: NOW - DAY, outcome: { kind: "done", at: NOW, came: 4, signedUp: 4 } }),
];

const input = (over: Partial<RunsInput> = {}): RunsInput => ({
  runs: RUNS,
  characters: recordCharacters(data, NOW),
  people,
  viewer: { battleTag: NICO, isAdmin: true, timeZone: "Europe/Amsterdam" },
  timeZoneOf: () => "Europe/Amsterdam",
  now: NOW,
  ...over,
});

describe("the dungeon page", () => {
  it("has the board's hero: wing, instance and zone, typical levels, the wings and Plan a run", () => {
    const page = dungeonPage(input(), "sm-armory")!;
    expect(page.title).toBe("Armory");
    expect(page.eyebrow).toBe("Scarlet Monastery · Tirisfal Glades");
    expect(page.levels).toBe("Levels 32–42 (typical)");
    expect(page.crumbs).toEqual([
      { label: "Map", href: "/?continent=eastern-kingdoms" },
      { label: "Tirisfal Glades" },
      { label: "Scarlet Monastery" },
      { label: "Armory" },
    ]);
    expect(page.wings).toEqual([
      { label: "Graveyard 26–36", href: "/dungeons/sm-graveyard", current: false, planned: 0 },
      { label: "Library 29–39", href: "/dungeons/sm-library", current: false, planned: 1 },
      { label: "Armory 32–42", href: "/dungeons/sm-armory", current: true, planned: 1 },
      { label: "Cathedral 35–45", href: "/dungeons/sm-cathedral", current: false, planned: 1 },
    ]);
    expect(page.planHref).toBe("/runs/new?dungeon=sm-armory");
    expect(page.entrance).toMatchObject({ zone: "tirisfal" });
  });

  it("names a dungeon without wings by its zone only", () => {
    const page = dungeonPage(input(), "rfc")!;
    expect(page.title).toBe("Ragefire Chasm");
    expect(page.eyebrow).toBe("Durotar");
    expect(page.levels).toBe("Levels 13–18 (typical)");
    expect(page.crumbs).toEqual([
      { label: "Map", href: "/?continent=kalimdor" },
      { label: "Durotar" },
      { label: "Ragefire Chasm" },
    ]);
    expect(page.wings).toBeUndefined();
    expect(page.otherWings).toEqual([]);
  });

  it("lists who fits per role, highest first, and the closest character below for an empty role", () => {
    const fits = dungeonPage(input(), "sm-armory")!.whoFits;
    expect(fits.map((r) => [r.title, r.characters.map((c) => `${c.name} ${c.level} · ${c.friend}`)])).toEqual([
      ["Tank", []],
      ["Healer", ["Lia Thornwhisper 37 · Femke", "Tok Ironhide 33 · Bob"]],
      ["Damage", ["Bob Example 41 · Bob", "Ves Doombringer 39 · Nico"]],
    ]);
    // Grom is a warrior: he can tank, and is the closest below.
    expect(fits[0]!.short).toMatchObject({ name: "Grom Ashfeller", level: 24, levels: 8, colorToken: "--warrior" });
    expect(fits[1]!.short).toBeUndefined();
  });

  it("shows characters over the range with their fit, and leaves carries out", () => {
    // Graveyard 26–36: Ves 39 is +3 over, Bob Example 41 +5; Mira 60 is a carry (+24).
    const damage = dungeonPage(input(), "sm-graveyard")!.whoFits.find((r) => r.role === "damage")!;
    expect(damage.characters.map((c) => [c.name, c.over])).toEqual([
      ["Bob Example", "+5 over"],
      ["Ves Doombringer", "+3 over"],
      ["Ruk Bloodhoof", undefined],
    ]);
    expect(damage.characters.some((c) => c.level === 60)).toBe(false);
  });

  it("says when there are no characters at all", () => {
    expect(dungeonPage(input({ characters: [], people: [] }), "rfc")!.noCharacters).toBe(true);
    expect(dungeonPage(input(), "rfc")!.noCharacters).toBe(false);
  });

  it("lists the upcoming runs here, not cancelled ones, with organiser, lead and open roles", () => {
    const page = dungeonPage(input(), "sm-armory")!;
    expect(page.planned).toEqual([
      {
        href: "/runs/1",
        day: "Today",
        time: expect.stringMatching(/^\d{2}:\d{2}$/),
        by: "Nico",
        lead: { name: "Ves Doombringer", colorToken: "--warlock-text" },
        summary: "2 in · 1 maybe · tank and 2 damage open",
        slots: [
          { role: "tank", filled: false },
          { role: "healer", filled: true },
          { role: "damage", filled: true },
          { role: "damage", filled: false },
          { role: "damage", filled: false },
        ],
      },
    ]);
    expect(dungeonPage(input(), "rfc")!.planned).toEqual([]);
  });

  it("lists the other wings' upcoming runs, soonest first", () => {
    const other = dungeonPage(input(), "sm-armory")!.otherWings;
    expect(other.map((o) => o.href)).toEqual(["/runs/2", "/runs/3"]);
    expect(other[0]!.text).toMatch(/^Library on Tomorrow \d{2}:\d{2} \(Bob\)$/);
    expect(other[1]!.text).toMatch(/^Cathedral on \w{3} \d{1,2} \w{3} \d{2}:\d{2} \(Femke\)$/);
  });

  it("lists the runs that ran here, newest first, not those that didn't happen", () => {
    const page = dungeonPage(input(), "sm-armory")!;
    expect(page.ran).toEqual([
      { href: "/runs/6", day: expect.any(String), by: "Nico", result: "Ran it · 3 of 5 signed-up came" },
    ]);
    const many = Array.from({ length: RAN_SHOWN + 2 }, (_, i) =>
      run(100 + i, { startsAt: NOW - (i + 1) * DAY, outcome: { kind: "done", at: NOW, came: 1, signedUp: 1 } }),
    );
    const ran = dungeonPage(input({ runs: many }), "sm-armory")!.ran;
    expect(ran.map((r) => r.href)).toEqual(many.slice(0, RAN_SHOWN).map((r) => `/runs/${r.id}`));
  });

  it("is undefined for an unknown dungeon or a raid", () => {
    expect(dungeonPage(input(), "nope")).toBeUndefined();
    expect(dungeonPage(input(), "ony")).toBeUndefined();
  });
});

describe("the dungeon page's id", () => {
  it("takes a runnable dungeon, sends Scarlet Monastery to its first wing, refuses raids and unknown ids", () => {
    expect(dungeonPageId("rfc")).toEqual({ id: "rfc", redirect: false });
    expect(dungeonPageId("sm-cathedral")).toEqual({ id: "sm-cathedral", redirect: false });
    expect(dungeonPageId("sm")).toEqual({ id: "sm-graveyard", redirect: true });
    expect(dungeonPageId("brs")).toEqual({ id: "brs", redirect: false });
    expect(dungeonPageId("ony")).toBeUndefined();
    expect(dungeonPageId("nope")).toBeUndefined();
  });
});

describe("the planned summary", () => {
  it("names the open roles, or full", () => {
    const full = run(9, {
      answers: [
        answer(NICO, "in", "Player-1-VES", "damage"),
        answer(BOB, "in", "Player-1-BOB", "damage"),
        answer(FEMKE, "in", "Player-1-LIA", "healer"),
        answer("Ruk#1", "in", "Player-1-RUK", "damage"),
        answer("Grom#1", "in", "Player-1-GROM", "tank"),
      ],
    });
    expect(plannedSummary(full)).toBe("5 in · full");
    expect(plannedSummary(run(10, {}))).toBe("0 in · tank, healer and 3 damage open");
  });
});

describe("the map's dungeon entrances", () => {
  const dungeons = mapDungeons(RUNS, NOW);
  const byName = (name: string) => dungeons.find((d) => d.name === name)!;

  it("counts the upcoming runs of all wings, with a page per wing and Plan a run left to pick", () => {
    const sm = byName("Scarlet Monastery");
    expect(sm.kind).toBe("dungeon");
    expect(sm.levels).toBe("26–45");
    expect(sm.planned).toBe(3);
    expect(sm.pages.map((p) => [p.label, p.href, p.planned])).toEqual([
      ["Graveyard 26–36", "/dungeons/sm-graveyard", 0],
      ["Library 29–39", "/dungeons/sm-library", 1],
      ["Armory 32–42", "/dungeons/sm-armory", 1],
      ["Cathedral 35–45", "/dungeons/sm-cathedral", 1],
    ]);
    expect(sm.planHref).toBe("/runs/new");
  });

  it("has one page and Plan a run filled in for a dungeon without wings; raids are only drawn", () => {
    const zf = byName("Zul'Farrak");
    expect(zf.planned).toBe(1);
    expect(zf.pages).toEqual([{ label: "44–54", href: "/dungeons/zf", planned: 1 }]);
    expect(zf.planHref).toBe("/runs/new?dungeon=zf");
    expect(byName("Onyxia's Lair").kind).toBe("raid");
    expect(byName("Ragefire Chasm").planned).toBe(0);
  });

  it("has every entrance of the map", () => {
    expect(dungeons).toHaveLength(31);
  });
});

describe("the hero's map", () => {
  it("is centred on the entrance, with its zone and coast", () => {
    const { x, y } = dungeonPage(input(), "sm-armory")!.entrance!;
    const m = entranceMap(x, y);
    expect(m.box.x + m.box.width / 2).toBe(x);
    expect(m.box.y + m.box.height / 2).toBe(y);
    expect(m.zones).toContain("tirisfal");
    expect(m.coasts).toContain("E");
  });
});
