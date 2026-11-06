import { describe, expect, it } from "vitest";
import {
  BAND_ROWS,
  bandLayout,
  bandsByLevel,
  DOT_RULE_PHONE,
  joinNames,
  levelPosition,
  roster,
  spreadDots,
  type CharacterView,
} from "@/core/views";
import { NOW, sample } from "./sample";

describe("level spread layout", () => {
  it("places levels on the 1–60 track", () => {
    expect([levelPosition(1), levelPosition(60), levelPosition(0), levelPosition(70)]).toEqual([0, 1, 0, 1]);
  });

  const at = (...levels: number[]) => levels.map((level, i) => ({ guid: `g${i}`, level }) as CharacterView);
  const levels = (list: CharacterView[], phone = false) =>
    spreadDots(list, undefined, phone ? DOT_RULE_PHONE : undefined).map((d) => d.characters.map((c) => c.level));

  it("merges characters within two levels into one dot of at most 3 levels, the viewer's with a gold ring", () => {
    const { spread } = roster(sample(), NOW);
    const dots = spreadDots(spread.characters, "Nico#2201");
    expect(dots.map((d) => d.characters.map((c) => c.level))).toEqual([
      [12],
      [15],
      [18],
      [24],
      [27],
      [33],
      [37, 39],
      [41],
      [60],
    ]);
    const group = dots[6]!;
    expect(group).toMatchObject({ level: 38, position: levelPosition(38), own: true });
    expect(group.characters.map((c) => c.name)).toEqual(["Lia Thornwhisper", "Ves Doombringer"]);
    // Nico's: Sela 12, Grom 24 and Ves (in the group).
    expect(dots.filter((d) => d.own).map((d) => d.level)).toEqual([12, 24, 38]);
    expect(spreadDots(spread.characters).some((d) => d.own)).toBe(false);
  });

  it("chains merges, keeps three levels apart separate and caps a dot at 3 levels (WEB-87)", () => {
    expect(levels(at(10, 12, 14, 17, 20, 20))).toEqual([[10, 12], [14], [17], [20, 20]]);
    expect(spreadDots(at(10, 11, 12))[0]!.level).toBe(11);
    expect(spreadDots(at(20, 21))[0]!.level).toBe(20.5);
    expect(levels(at())).toEqual([]);
  });

  // A live roster where levels 1 to 16 all made one dot "23" (Nico, 2026-11-06).
  const low = at(1, 1, 1, 3, 4, 5, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 10, 10, 12, 12, 14, 15, 16);

  it("splits a long chain of close levels into dots of at most 3 levels (WEB-87)", () => {
    const dots = spreadDots(low);
    expect(dots.map((d) => d.characters.map((c) => c.level))).toEqual([
      [1, 1, 1, 3],
      [4, 5],
      [7, 7, 7, 8, 8, 8, 8, 9, 9, 9],
      [10, 10, 12, 12],
      [14, 15, 16],
    ]);
    expect(dots.map((d) => d.level)).toEqual([2, 4.5, 8, 11, 15]);
    for (const d of dots) expect(d.characters.at(-1)!.level! - d.characters[0]!.level!).toBeLessThanOrEqual(2);
  });

  it("on a phone merges within four levels, at most 5 levels a dot, dots 24 px apart (WEB-32, WEB-87)", () => {
    const { spread } = roster(sample(), NOW);
    const dots = spreadDots(spread.characters, "Nico#2201", DOT_RULE_PHONE);
    // 12–15 and 18 would sit 4.5 levels apart: 18 joins.
    expect(dots.map((d) => d.characters.map((c) => c.level))).toEqual([
      [12, 15, 18],
      [24, 27],
      [33, 37],
      [39, 41],
      [60],
    ]);
    expect(dots.map((d) => d.level)).toEqual([15, 25.5, 35, 40, 60]);

    const phone = spreadDots(low, undefined, DOT_RULE_PHONE);
    expect(phone.map((d) => d.characters.map((c) => c.level))).toEqual([
      [1, 1, 1, 3, 4, 5],
      [7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 10, 10],
      [12, 12, 14, 15, 16],
    ]);
    // 5 levels are 24 px on the 375 px layout's track: never closer.
    for (const list of [
      spread.characters,
      low,
      at(1, 5, 6),
      at(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16),
    ]) {
      const mids = spreadDots(list, undefined, DOT_RULE_PHONE).map((d) => d.level);
      for (let i = 1; i < mids.length; i++) expect(mids[i]! - mids[i - 1]!).toBeGreaterThanOrEqual(5);
    }
    expect(levels(at(1, 5, 6), true)).toEqual([[1, 5, 6]]);
  });

  it("lists dungeons lowest level first: by min, then max, then name (WEB-87)", () => {
    const band = (name: string, min: number, max: number) =>
      ({ dungeon: { id: name, name, typicalLevels: { min, max } } }) as unknown as Parameters<typeof bandsByLevel>[0];
    const list = [band("Ruins", 15, 22), band("Hall", 13, 20), band("Ragefire", 13, 18), band("Alpha", 13, 18)];
    expect([...list].sort(bandsByLevel).map((b) => b.dungeon.name)).toEqual(["Alpha", "Ragefire", "Hall", "Ruins"]);
  });

  it("stacks bands without overlap, most fits first, at most 4 rows with the rest hidden (WEB-45)", () => {
    const { spread } = roster(sample(), NOW);
    const all = bandLayout(spread);
    expect(all.shown).toHaveLength(spread.bands.length);
    expect(all.hidden).toBe(0);
    expect(all.shown.find((p) => p.best)).toMatchObject({ row: 0, band: spread.best });
    for (const a of all.shown) {
      for (const b of all.shown) {
        if (a === b || a.row !== b.row) continue;
        const [x, y] = [a.band.dungeon.typicalLevels, b.band.dungeon.typicalLevels];
        expect(x.max < y.min || x.min > y.max).toBe(true);
      }
    }
    // Row 0 holds the most fits; a band never has more fits than the band that took its place earlier.
    const firstRow = all.shown.filter((p) => p.row === 0).map((p) => p.band.fits.length);
    expect(Math.max(...firstRow)).toBe(Math.max(...spread.bands.map((b) => b.fits.length)));

    // Five overlapping bands: four rows shown, one hidden behind "Show all".
    const band = (id: string, fits: number) =>
      ({
        dungeon: { id, name: id, shortName: id, typicalLevels: { min: 30, max: 40 } },
        fits: Array.from({ length: fits }, (_, i) => ({ guid: `${id}${i}` })),
      }) as unknown as (typeof spread.bands)[number];
    const five = [band("a", 2), band("b", 6), band("c", 3), band("d", 5), band("e", 4)];
    const limited = bandLayout({ bands: five }, BAND_ROWS);
    expect(limited.shown.map((p) => [p.band.dungeon.id, p.row])).toEqual([
      ["b", 0],
      ["d", 1],
      ["e", 2],
      ["c", 3],
    ]);
    expect(limited.hidden).toBe(1);
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
