import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cropAround, pathBox, zoneByName } from "@/core/cards/mapCrop";
import {
  BOARD_ROW_HEIGHT,
  boardCard,
  boardCards,
  cardSize,
  milestoneCard,
  recapHeader,
  whereisCard,
  zoneCard,
} from "@/core/cards/models";
import type { BoardData } from "@/core/doomsday/posts";
import { CARD_TOKENS, classColours } from "@/core/cards/palette";

// WEB-41d: the card images' tokens, map crops and what each card shows.

describe("the palette", () => {
  it("has every value exactly as tokens.css", () => {
    const css = readFileSync(path.join(__dirname, "..", "..", "src", "styles", "tokens.css"), "utf8");
    for (const [name, value] of Object.entries(CARD_TOKENS)) {
      const m = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
      expect(m?.[1]?.trim().toLowerCase(), name).toBe(value);
    }
  });

  it("colours a disc by class, gold when unknown, white initials on Shaman", () => {
    expect(classColours("WARLOCK")).toEqual({ fill: "--warlock", text: "--warlock-text", on: "--on-gold" });
    expect(classColours("SHAMAN").on).toBe("--on-shaman");
    expect(classColours(undefined)).toEqual({ fill: "--gold", text: "--gold", on: "--on-gold" });
  });
});

describe("map crops", () => {
  it("boxes a path and crops around a zone with its neighbours", () => {
    expect(pathBox("M1,2 5,8 3,4Z")).toEqual({ x: 1, y: 2, w: 4, h: 6 });
    const stv = zoneByName("Stranglethorn Vale")!;
    const crop = cropAround(stv.id, 2)!;
    expect(crop.viewBox.w / crop.viewBox.h).toBeCloseTo(2);
    expect(crop.zones.filter((z) => z.highlight).map((z) => z.id)).toEqual([stv.id]);
    expect(crop.zones.length).toBeGreaterThan(1);
    expect(cropAround("nowhere", 2)).toBeUndefined();
  });
});

describe("cards", () => {
  const char = { guid: "G", name: "Mira Sunstrider", classFile: "MAGE", level: 60 };
  const facts = { name: "Mira Sunstrider", classFile: "MAGE", classLabel: "Mage", race: "Undead", spec: "Frost" };

  it("draws only the milestones worth an image", () => {
    expect(milestoneCard({ kind: "maxLevel", character: char, level: 60, from: 58 }, facts, "h")).toMatchObject({
      title: "Level 60",
      lines: ["From level 58", "Undead Mage · Frost"],
      disc: { initials: "MS", fill: "--mage" },
    });
    expect(milestoneCard({ kind: "level", character: char, level: 30, from: 28 }, facts, "h")).toBeUndefined();
    expect(milestoneCard({ kind: "newCharacter", character: { ...char, level: 12 } }, facts, "h")).toBeUndefined();
    expect(
      milestoneCard(
        { kind: "professionCap", character: char, skillLine: "197", profession: "Tailoring", rank: 225 },
        facts,
        "h",
      ),
    ).toBeUndefined();
  });

  it("heads the recap with the award, else the zone, else the headline", () => {
    const award = recapHeader(
      { dates: "20–26 Oct", headline: "x", award: { title: "Friends of the week", friend: "Ada", amount: "6 levels" } },
      "h",
    );
    expect(award).toMatchObject({
      kind: "award",
      overline: "Weekly recap · 20–26 Oct",
      name: "Ada",
      disc: { initials: "A" },
    });
    expect(recapHeader({ dates: "d", headline: "x", zone: { name: "Duskwood", friends: 3 } }, "h")).toMatchObject({
      kind: "zoneHeader",
      stat: "3 friends",
    });
    expect(recapHeader({ dates: "d", headline: "A quiet week" }, "h")).toMatchObject({
      kind: "headline",
      title: "A quiet week",
    });
    expect(cardSize(award)).toEqual({ width: 1200, height: 400 });
  });

  it("has no zone card for a place the map doesn't draw", () => {
    expect(zoneCard("Warsong Gulch", 2, "h")).toBeUndefined();
    expect(zoneCard("Duskwood", 1, "h")).toMatchObject({ stat: "1 friend" });
  });

  it("marks where a character was seen, newest first, old ones as old", () => {
    const now = 10 * 86400;
    const card = whereisCard(
      facts,
      [
        { zone: "Westfall", seenAt: now - 9 * 86400 },
        { zone: "Stranglethorn Vale", seenAt: now - 7200 },
        { zone: "Stranglethorn Vale", seenAt: now - 9000 },
      ],
      now,
      "h",
    );
    expect(card).toMatchObject({ kind: "whereis", line: "Last seen in Stranglethorn Vale · 2 h ago" });
    if (card?.kind !== "whereis") throw new Error("not a whereis card");
    expect(card.markers[0]).toMatchObject({ age: "now", label: "2 h ago" });
    expect(card.markers.slice(1).every((m) => m.age === "old")).toBe(true);
    expect(whereisCard(facts, [], now, "h")).toBeUndefined();
  });
});

describe("the board images (WEB-87)", () => {
  const start = Date.parse("2026-10-28T18:00:00Z") / 1000;
  // n friends (made-up names), each with `done` goals done; the board's order (most done first) is the caller's.
  const friend = (name: string, done: number): BoardData["friends"][number] => ({
    name,
    goals: ["pve1", "pve2", "pve3"].slice(0, done).map((slot) => ({ slot, id: "x", done: true })),
    doneCount: done,
    goalCount: 6,
    crossedOut: done === 3,
    today: { pve: 5 * done, pvp: 0 },
    week: { pve: 5 * done, pvp: 0 },
    streak: done,
    best: done,
    pvpVirgin: false,
  });
  const board = (playing: number, idle: number): BoardData => ({
    day: 20754,
    week: 2965,
    label: "Wed evening",
    span: "Wed 19:00 → Thu 19:00",
    start,
    end: start + 86400,
    goals: ["pve1", "pve2", "pve3"].map((slot) => ({
      slot,
      id: "x",
      title: "A goal",
      track: "pve" as const,
      points: 5,
      shortLabel: "Goal",
    })),
    friends: [
      ...Array.from({ length: playing }, (_, i) => friend(`Played ${i + 1}`, 3 - (i % 3))),
      ...Array.from({ length: idle }, (_, i) => friend(`Idle ${i + 1}`, 0)),
    ],
    withoutData: ["Sanne"],
    crown: { name: "Played 1", at: start + 3600 },
    yesterdayCrown: null,
  });
  const cards = (data: BoardData) => boardCards(data, start + 7200, "Europe/Paris", "wow.example.test");

  it("rows only friends who did a goal, in order, and counts the rest on one line", () => {
    const [only, ...more] = cards(board(3, 4));
    expect(more).toEqual([]);
    expect(only!.rows.map((r) => r.name)).toEqual(["Played 1", "Played 2", "Played 3"]);
    expect(only!.rows[0]).toMatchObject({ crown: true });
    expect(only!.rows[0]).not.toHaveProperty("struck");
    expect(only!.rest).toBe("+4 haven't started");
    expect(only!.page).toBeUndefined();
    expect(cardSize(only!)).toEqual({ width: 800, height: 560 });
  });

  it("leaves the line out when everyone played, and shows the line alone when nobody did", () => {
    expect(cards(board(2, 0))[0]!.rest).toBeUndefined();
    expect(cards(board(0, 5))).toMatchObject([{ rows: [], rest: "+5 haven't started" }]);
    expect(cards(board(0, 0))).toMatchObject([{ rows: [] }]);
    expect(cards(board(0, 0))[0]!.rest).toBeUndefined();
  });

  it("pages 8 rows with a marker, the footer on every page and the line on the last", () => {
    const pages = cards(board(20, 2));
    expect(pages.map((p) => [p.page, p.rows.length, p.rest])).toEqual([
      ["1/3", 8, undefined],
      ["2/3", 8, undefined],
      ["3/3", 4, "+2 haven't started"],
    ]);
    expect(pages.map((p) => p.rows[0]!.name)).toEqual(["Played 1", "Played 9", "Played 17"]);
    expect(new Set(pages.map((p) => p.footer)).size).toBe(1);
    // 8 rows: three rows taller than 5; 4 rows and the line: 560.
    expect(pages.map((p) => cardSize(p).height)).toEqual([560 + 3 * BOARD_ROW_HEIGHT, 560 + 3 * BOARD_ROW_HEIGHT, 560]);
  });

  it("stops at 10 pages with +N more on the last", () => {
    const pages = cards(board(85, 3));
    expect(pages).toHaveLength(10);
    expect(pages[9]).toMatchObject({ page: "10/10", rest: "+5 more · +3 haven't started" });
    expect(pages[9]!.rows).toHaveLength(8);
    expect(cardSize(pages[9]!).height).toBe(560 + 4 * BOARD_ROW_HEIGHT);
  });

  it("page 1 is what boardCard draws", () => {
    expect(boardCard(board(20, 2), start + 7200, "Europe/Paris", "wow.example.test")).toEqual(cards(board(20, 2))[0]);
  });
});
