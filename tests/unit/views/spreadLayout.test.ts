import { describe, expect, it } from "vitest";
import { bandRows, joinNames, labelRows, levelPosition, roster } from "@/core/views";
import { NOW, sample } from "./sample";

describe("level spread layout", () => {
  it("places levels on the 1–60 track", () => {
    expect([levelPosition(1), levelPosition(60), levelPosition(0), levelPosition(70)]).toEqual([0, 1, 0, 1]);
  });

  it("puts names that would overlap into further rows, and keeps the ends on the track", () => {
    const places = labelRows(
      [
        { position: 0, text: "Sela Moonbrook" },
        { position: 0.5, text: "Ves Doombringer" },
        { position: 0.52, text: "Lia Thornwhisper" },
        { position: 1, text: "Mira Sunstrider" },
      ],
      1000,
    );
    expect(places).toEqual([
      { row: 0, align: "start" },
      { row: 0, align: "center" },
      { row: 1, align: "center" },
      { row: 0, align: "end" },
    ]);
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
