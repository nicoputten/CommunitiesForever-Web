import { describe, expect, it } from "vitest";
import {
  bandRows,
  joinNames,
  levelPosition,
  MERGE_LEVELS_PHONE,
  roster,
  spreadDots,
  type CharacterView,
} from "@/core/views";
import { NOW, sample } from "./sample";

describe("level spread layout", () => {
  it("places levels on the 1–60 track", () => {
    expect([levelPosition(1), levelPosition(60), levelPosition(0), levelPosition(70)]).toEqual([0, 1, 0, 1]);
  });

  it("merges characters within two levels into one dot, the viewer's with a gold ring (WEB-32)", () => {
    const { spread } = roster(sample(), NOW);
    const dots = spreadDots(spread.characters, "Nico#2201");
    expect(dots.map((d) => d.characters.map((c) => c.level))).toEqual([
      [12],
      [15],
      [18],
      [24],
      [27],
      [33],
      [37, 39, 41],
      [60],
    ]);
    const group = dots[6]!;
    expect(group).toMatchObject({ level: 39, position: levelPosition(39), own: true });
    expect(group.characters.map((c) => c.name)).toEqual(["Lia Thornwhisper", "Ves Doombringer", "Bob Example"]);
    // Nico's: Sela 12, Grom 24 and Ves (in the group).
    expect(dots.filter((d) => d.own).map((d) => d.level)).toEqual([12, 24, 39]);
    expect(spreadDots(spread.characters).some((d) => d.own)).toBe(false);
  });

  it("chains merges and keeps three levels apart separate", () => {
    const at = (...levels: number[]) => levels.map((level, i) => ({ guid: `g${i}`, level }) as CharacterView);
    const levels = (list: CharacterView[]) => spreadDots(list).map((d) => d.characters.map((c) => c.level));
    expect(levels(at(10, 12, 14, 17, 20, 20))).toEqual([[10, 12, 14], [17], [20, 20]]);
    expect(spreadDots(at(10, 12, 14))[0]!.level).toBe(12);
    expect(spreadDots(at(20, 21))[0]!.level).toBe(20.5);
    expect(levels(at())).toEqual([]);
  });

  it("merges within four levels on a phone, so dots stay 24 px apart", () => {
    const { spread } = roster(sample(), NOW);
    const dots = spreadDots(spread.characters, "Nico#2201", MERGE_LEVELS_PHONE);
    expect(dots.map((d) => d.characters.map((c) => c.level))).toEqual([[12, 15, 18], [24, 27], [33, 37, 39, 41], [60]]);
    expect(dots.map((d) => d.level)).toEqual([15, 25.5, 37, 60]);
  });

  it("stacks bands without overlap, the best band first", () => {
    const { spread } = roster(sample(), NOW);
    const placed = bandRows(spread);
    expect(placed).toHaveLength(spread.bands.length);
    expect(placed.find((p) => p.best)).toMatchObject({ row: 0, band: spread.best });
    for (const a of placed) {
      for (const b of placed) {
        if (a === b || a.row !== b.row) continue;
        const [x, y] = [a.band.dungeon.typicalLevels, b.band.dungeon.typicalLevels];
        expect(x.max < y.min || x.min > y.max).toBe(true);
      }
    }
  });

  it("joins names", () => {
    expect([joinNames([]), joinNames(["Sanne"]), joinNames(["Sanne", "Pim"]), joinNames(["A", "B", "C"])]).toEqual([
      "",
      "Sanne",
      "Sanne and Pim",
      "A, B and C",
    ]);
  });
});
