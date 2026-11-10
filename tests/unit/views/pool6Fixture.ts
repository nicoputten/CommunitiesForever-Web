import type { Faction } from "@/core/doomsday/rules";
import type { CensusInfo, HuntTarget, HuntTargetCell, HuntTargetsView } from "@/core/views/pool6";

// WEB-109: made-up pool version 6 view models (src/core/views/pool6.ts) for the Mission pool page's tests.

const RACES: Record<number, [string, string]> = {
  1: ["Human", "Human"],
  2: ["Orc", "Orc"],
  3: ["Dwarf", "Dwarf"],
  4: ["Night Elf", "NightElf"],
  5: ["Undead", "Scourge"],
  6: ["Tauren", "Tauren"],
  7: ["Gnome", "Gnome"],
  95: ["Skyborne", "Skyborne"],
};
const CLASSES: Record<number, [string, string]> = {
  1: ["WARRIOR", "Warrior"],
  2: ["PALADIN", "Paladin"],
  3: ["HUNTER", "Hunter"],
  4: ["ROGUE", "Rogue"],
  8: ["MAGE", "Mage"],
  11: ["DRUID", "Druid"],
};

export function target(faction: Faction, raceId: number, classId: number): HuntTarget {
  const [race, raceToken] = RACES[raceId]!;
  const [classFile, className] = CLASSES[classId]!;
  return {
    key: `${raceId}:${classId}`,
    faction,
    raceId,
    classId,
    raceToken,
    classFile,
    race,
    className,
    name: `${race} ${className}`,
  };
}

export const CENSUS: CensusInfo = {
  at: Date.UTC(2026, 10, 10, 15) / 1000,
  asOf: Date.UTC(2026, 10, 10, 15) / 1000,
  from: Date.UTC(2026, 10, 4, 23) / 1000,
  to: Date.UTC(2026, 10, 10, 15) / 1000,
  characters: 16400,
  installs: 13,
  source: "everloot",
  roundTo: 5,
  stale: false,
  url: "https://everloot.app/census",
  licence: "CC BY-SA 4.0",
};

type CellIn = [raceId: number, classId: number, count: number | undefined, extra?: Partial<HuntTargetCell>];

function faction(f: Faction, cells: CellIn[], forever: number[]): HuntTargetsView["factions"][Faction] {
  const all = cells.map(([r, c, count, extra]): HuntTargetCell => {
    const cell: HuntTargetCell = {
      ...target(f, r, c),
      drawShare: 0,
      state: count === undefined || count < 30 ? "skipped" : "on",
      rare: false,
      forever: forever.includes(r),
      today: false,
      ...extra,
    };
    if (count !== undefined) cell.count = count;
    return cell;
  });
  const on = all.filter((c) => c.state === "on");
  const total = on.reduce((a, c) => a + c.count!, 0);
  for (const c of on) c.drawShare = c.count! / total;
  const races = [...new Set(all.map((c) => c.raceId))].map((raceId) => ({
    raceId,
    race: RACES[raceId]![0],
    forever: forever.includes(raceId),
    cells: all.filter((c) => c.raceId === raceId),
  }));
  return { hunter: f === "Alliance" ? "Horde" : "Alliance", races, total: all.length, inDraw: on.length };
}

/** Alliance targets (Horde hunts) and Horde targets (Alliance hunts); today Gnome Mage and Undead Rogue. */
export function targetsView(today = 20766): HuntTargetsView {
  return {
    census: CENSUS,
    factions: {
      Alliance: faction(
        "Alliance",
        [
          [1, 2, 435],
          [1, 1, 205],
          [7, 8, 235, { today: true, lastHunted: today - 4, donePct: 0.41 }],
          [3, 4, 20],
          [95, 11, 75],
          [95, 1, 10],
          [4, 3, 230, { state: "off" }],
        ],
        [95],
      ),
      Horde: faction(
        "Horde",
        [
          [5, 4, 690, { today: true }],
          [6, 11, undefined],
        ],
        [],
      ),
    },
  };
}
