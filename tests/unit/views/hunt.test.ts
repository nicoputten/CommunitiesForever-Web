import { describe, expect, it } from "vitest";
import {
  censusLine,
  dayTarget,
  quarry,
  raceShort,
  tabs,
  targetNameOf,
  targetRows,
  validTarget,
} from "@/core/views/hunt";
import type { DayRecipeView } from "@/core/views/pool6";
import { CENSUS, target, targetsView } from "./pool6Fixture";

// WEB-109: the Hunt on the Mission pool page from WEB-108's pool 6 view models (boards `mission-pool-v2-overview`,
// `mission-pool-v2-hunt`): the quarry, races × classes, draw share, skipped, off, invalid, today, new races, the
// census line. Day 20766 is Mon 9 Nov 2026.

const TODAY = 20766;

function day(n: number, alliance?: [number, number], horde?: [number, number]): DayRecipeView {
  const targets: DayRecipeView["hunt"]["targets"] = {};
  if (alliance !== undefined) targets.Alliance = target("Alliance", ...alliance);
  if (horde !== undefined) targets.Horde = target("Horde", ...horde);
  return { n, pve: [], hunt: { n, targets, pinned: {}, locked: false }, locked: false, changed: false };
}

describe("the quarry", () => {
  it("the Horde's target with census and done, the Alliance's, the next 7 days", () => {
    const days = [day(TODAY, [7, 8], [5, 4]), day(TODAY + 1, [1, 1]), day(TODAY + 2, [1, 2])];
    const q = quarry(
      {
        Alliance: { n: TODAY, target: target("Alliance", 7, 8), points: 5, seen: 235, census: CENSUS, doneToday: 0.09 },
        Horde: { n: TODAY, target: target("Horde", 5, 4), points: 5 },
      },
      days,
      TODAY,
    );
    expect(q).toMatchObject({
      kicker: "Today’s quarry · Mon 9",
      hunter: "Horde hunts",
      points: "+5",
      done: "9%",
      seen: "235",
      target: { raceShort: "Gn", name: "Gnome Mage", classFile: "MAGE", raceName: "Gnome", className: "Mage" },
      other: { hunter: "Alliance hunts", target: { raceShort: "Ud", name: "Undead Rogue" } },
    });
    expect(q.next.map((d) => `${d.weekday} ${d.raceShort} ${d.className}`)).toEqual([
      "Tue Hu Warrior",
      "Wed Hu Paladin",
    ]);
    expect(dayTarget(days[0])).toBe("Gnome Mage");
    expect(dayTarget(day(TODAY))).toBeUndefined();
  });

  it("no Hunt drawn: no target, no stats, no days", () => {
    const q = quarry({}, [], TODAY);
    expect(q.target).toBeUndefined();
    expect(q.done).toBeUndefined();
    expect(q.seen).toBeUndefined();
    expect(q.next).toEqual([]);
  });
});

describe("Hunt targets", () => {
  it("race initials; a target's name by ids for the Admin changes line", () => {
    expect(
      ["Human", "Dwarf", "Night Elf", "Gnome", "Skyborne", "Orc", "Undead", "Tauren", "Troll"].map(raceShort),
    ).toEqual(["Hu", "Dw", "NE", "Gn", "Sk", "Or", "Ud", "Ta", "Tr"]);
    expect(targetNameOf(4, 11)).toBe("Night Elf Druid");
    expect(targetNameOf(96, 7)).toBe("Skyborne Shaman");
  });

  it("tabs per hunting faction, Horde first, with the targets in the draw", () => {
    expect(tabs(targetsView()).map((t) => `${t.label} ${t.inDraw}`)).toEqual([
      "Horde hunts · Alliance targets 4",
      "Alliance hunts · Horde targets 1",
    ]);
  });

  it("rows by race in list order, nine class columns; draw, skipped, off and invalid cells", () => {
    const rows = targetRows(targetsView(), "Horde");
    expect(rows.map((r) => `${r.name}${r.fresh ? " NEW" : ""}`)).toEqual([
      "Human",
      "Gnome",
      "Dwarf",
      "Skyborne NEW",
      "Night Elf",
    ]);
    const human = rows[0]!.cells;
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
      raceId: 1,
      classId: 2,
      name: "Human Paladin",
    });
    expect(human[0]!.bar).toBeCloseTo((205 / 435) * 100);
    expect(human[2]).toMatchObject({ state: "invalid" });
    expect(rows[2]!.cells[3]).toMatchObject({ state: "skip", count: "20", label: "too rare", line: "20 · too rare" });
    expect(rows[4]!.cells[2]).toMatchObject({ state: "off", count: "230", label: "off", line: "230 · off" });
    expect(rows[3]!.cells[8]).toMatchObject({ state: "draw", fresh: true, label: "7.9% of draws" });
    expect(rows[3]!.cells[0]).toMatchObject({ state: "skip", fresh: true });
  });

  it("today's target has the red ring; the hover has seen, share, last hunted and done", () => {
    const gnome = targetRows(targetsView(), "Horde")[1]!.cells[6]!;
    expect(gnome.today).toBe(true);
    expect(gnome.tip).toBe("Gnome Mage · 235 seen this week · 24.7% of draws · last hunted Thu 5 Nov · done 41%");
    expect(targetRows(targetsView(), "Horde")[0]!.cells[1]!.tip).toBe(
      "Human Paladin · 435 seen this week · 45.8% of draws",
    );
  });

  it("a target outside the census is skipped without a count", () => {
    const tauren = targetRows(targetsView(), "Alliance")[1]!.cells[8]!;
    expect(tauren).toMatchObject({ state: "skip", label: "too rare", line: "— · too rare" });
    expect(tauren.count).toBeUndefined();
  });

  it("only valid targets can be switched", () => {
    expect(validTarget(targetsView(), 7, 8)).toBe(true);
    expect(validTarget(targetsView(), 7, 11)).toBe(false);
  });

  it("the census line: window, characters, installs, rounding; parts it lacks are left out", () => {
    expect(censusLine(CENSUS)).toBe(
      "Everloot census · active 4–10 Nov · 16,400 characters from 13 installs · numbers rounded to 5",
    );
    expect(
      censusLine({
        ...CENSUS,
        from: Date.UTC(2026, 9, 28) / 1000,
        to: Date.UTC(2026, 10, 3) / 1000,
        characters: 900,
        installs: 3,
      }),
    ).toBe("Everloot census · active 28 Oct–3 Nov · 900 characters from 3 installs · numbers rounded to 5");
    const bare = { ...CENSUS, from: undefined, to: undefined, roundTo: undefined };
    expect(censusLine(bare)).toBe("Everloot census · 16,400 characters from 13 installs");
  });
});
