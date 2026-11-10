import { describe, expect, it } from "vitest";
import {
  censusLine,
  classFileOf,
  dayTarget,
  raceShort,
  targetName,
  targetsView,
  type HuntData,
} from "@/core/views/hunt";

// WEB-109: the Hunt targets (board `mission-pool-v2-hunt`): races × classes, census weight, share of the draw,
// skipped, off, invalid, today, new races; the census line. Day 20766 is Mon 9 Nov 2026.

const TODAY = 20766;

function data(over: Partial<HuntData> = {}): HuntData {
  return {
    targets: {
      Alliance: [
        { race: 1, class: 2, count: 435 },
        { race: 1, class: 1, count: 205 },
        { race: 7, class: 8, count: 235, lastHunted: TODAY - 4, donePct: 41 },
        { race: 3, class: 4, count: 20 },
        { race: 95, class: 11, count: 75 },
        { race: 95, class: 1, count: 10 },
        { race: 4, class: 3, count: 230, off: true },
      ],
      Horde: [
        { race: 5, class: 4, count: 690 },
        { race: 6, class: 11 },
      ],
    },
    newRaces: [95, 96],
    census: {
      from: Date.UTC(2026, 10, 4, 23) / 1000,
      to: Date.UTC(2026, 10, 10, 15) / 1000,
      characters: 16400,
      installs: 13,
    },
    days: new Map([[TODAY, { Alliance: { race: 7, class: 8 }, Horde: { race: 5, class: 4 } }]]),
    points: 5,
    ...over,
  };
}

describe("Hunt targets", () => {
  it("names from the game data: race initials, race + class", () => {
    expect(targetName({ race: 4, class: 11 })).toBe("Night Elf Druid");
    expect(targetName({ race: 96, class: 7 })).toBe("Skyborne Shaman");
    expect([1, 3, 4, 7, 95, 2, 5, 6, 8].map(raceShort)).toEqual(["Hu", "Dw", "NE", "Gn", "Sk", "Or", "Ud", "Ta", "Tr"]);
    expect(classFileOf(11)).toBe("DRUID");
    expect(classFileOf(6)).toBeUndefined();
    expect(dayTarget(data(), TODAY)).toBe("Gnome Mage");
    expect(dayTarget(data(), TODAY + 1)).toBeUndefined();
  });

  it("tabs per hunting faction, Horde first, with the targets in the draw", () => {
    const v = targetsView(data(), TODAY);
    expect(v.hunter).toBe("Horde");
    expect(v.tabs.map((t) => `${t.label} ${t.inDraw}`)).toEqual([
      "Horde hunts · Alliance targets 4",
      "Alliance hunts · Horde targets 1",
    ]);
  });

  it("rows by race in list order, nine class columns; draw, skipped, off and invalid cells", () => {
    const v = targetsView(data(), TODAY);
    expect(v.rows.map((r) => `${r.name}${r.fresh ? " NEW" : ""}`)).toEqual([
      "Human",
      "Gnome",
      "Dwarf",
      "Skyborne NEW",
      "Night Elf",
    ]);
    const human = v.rows[0]!.cells;
    expect(human.map((c) => c.classFile)).toEqual([
      "WARRIOR",
      "PALADIN",
      "HUNTER",
      "ROGUE",
      "PRIEST",
      "SHAMAN",
      "MAGE",
      "WARLOCK",
      "DRUID",
    ]);
    // In the draw: 435 + 205 + 235 + 75 = 950.
    expect(human[1]).toMatchObject({
      state: "draw",
      count: "435",
      bar: 100,
      label: "45.8% of draws",
      line: "435 · 45.8%",
    });
    expect(human[0]!.bar).toBeCloseTo((205 / 435) * 100);
    expect(human[2]).toMatchObject({ state: "invalid" });
    expect(human[2]!.count).toBeUndefined();
    expect(v.rows[2]!.cells[3]).toMatchObject({ state: "skip", count: "20", label: "too rare", line: "20 · too rare" });
    expect(v.rows[4]!.cells[2]).toMatchObject({ state: "off", count: "230", label: "off", line: "230 · off" });
    const sky = v.rows[3]!.cells;
    expect(sky[8]).toMatchObject({ state: "draw", fresh: true, label: "7.9% of draws" });
    expect(sky[0]).toMatchObject({ state: "skip", fresh: true });
  });

  it("today's target has the red ring; the hover has seen, share, last hunted and done", () => {
    const gnome = targetsView(data(), TODAY).rows[1]!.cells[6]!;
    expect(gnome.today).toBe(true);
    expect(gnome.tip).toBe("Gnome Mage · 235 seen this week · 24.7% of draws · last hunted Thu 5 Nov · done 41%");
    expect(targetsView(data(), TODAY).rows[0]!.cells[1]!.tip).toBe(
      "Human Paladin · 435 seen this week · 45.8% of draws",
    );
  });

  it("a target outside the census is skipped without a count", () => {
    const tauren = targetsView(data(), TODAY, "Alliance").rows[1]!.cells[8]!;
    expect(tauren).toMatchObject({ state: "skip", label: "too rare", line: "— · too rare" });
    expect(tauren.count).toBeUndefined();
  });

  it("the census line: window, characters, installs, rounding", () => {
    expect(targetsView(data(), TODAY).census).toBe(
      "Everloot census · active 4–10 Nov · 16,400 characters from 13 installs · numbers rounded to 5",
    );
    expect(
      censusLine({
        from: Date.UTC(2026, 9, 28) / 1000,
        to: Date.UTC(2026, 10, 3) / 1000,
        characters: 900,
        installs: 3,
      }),
    ).toBe("Everloot census · active 28 Oct–3 Nov · 900 characters from 3 installs · numbers rounded to 5");
    expect(targetsView(data({ census: undefined }), TODAY).census).toBeUndefined();
  });
});
