import type { Settings } from "@/core/doomsday/missionPool";
import type { Faction } from "@/core/doomsday/rules";
import { draw, goal } from "@/core/doomsday/rules";
import type { ClassFile } from "@/core/gamedata/classes";
import { CLASS_IDS, type HuntData, type Target, type TargetState } from "@/core/views/hunt";
import type { PoolData, Theme } from "@/core/views/missionPool";

// TEMPORARY (WEB-109): pool version 6's data until WEB-108 lands its catalogue, census and draw; WEB-109 swaps this
// file for WEB-108's module before it merges. Nothing here is the real catalogue: the themes are a stand-in from the
// draw's categories, the Hunt days are today's pool-5 draw.

/**
 * A stand-in theme per draw category of the PvE dailies (rules.ts `category`), until the addon's catalogue (CF-118)
 * tags every mission.
 */
const THEME_OF_CATEGORY: Readonly<Record<string, Theme>> = {
  quests: "questing",
  loot: "loot",
  economy: "loot",
  social: "social",
  teamwork: "social",
  care: "social",
  crafts: "professions",
  cooking: "professions",
  firstaid: "professions",
  fishing: "professions",
  exploration: "exploration",
  travel: "exploration",
};

/**
 * The valid targets per hunted faction, from the game files (the pool 6 contract: Everloot class_races, build
 * 1.60.1.70862), with Everloot's census (https://everloot.app/census, CC BY-SA 4.0): characters active 4–10 Nov 2026,
 * 16,400 characters from 13 installs, rounded to 5. Race ids: src/core/gamedata/races.ts.
 */
const CENSUS: Readonly<Record<Faction, readonly [number, Partial<Record<ClassFile, number>>][]>> = {
  Alliance: [
    [1, { WARRIOR: 205, PALADIN: 435, HUNTER: 140, ROGUE: 100, PRIEST: 180, MAGE: 155, WARLOCK: 195 }],
    [3, { WARRIOR: 90, PALADIN: 140, HUNTER: 165, ROGUE: 20, PRIEST: 30, SHAMAN: 325 }],
    [4, { WARRIOR: 65, HUNTER: 230, ROGUE: 60, PRIEST: 75, DRUID: 255 }],
    [7, { WARRIOR: 65, ROGUE: 175, PRIEST: 110, MAGE: 235, WARLOCK: 125 }],
    [95, { WARRIOR: 10, HUNTER: 35, ROGUE: 15, MAGE: 35, DRUID: 75 }],
  ],
  Horde: [
    [2, { WARRIOR: 625, HUNTER: 680, ROGUE: 195, SHAMAN: 640, MAGE: 235, WARLOCK: 440 }],
    [5, { WARRIOR: 180, PALADIN: 1370, ROGUE: 690, PRIEST: 765, MAGE: 595, WARLOCK: 600 }],
    [6, { WARRIOR: 620, HUNTER: 340, SHAMAN: 575, DRUID: 1420 }],
    [8, { WARRIOR: 155, HUNTER: 280, ROGUE: 100, PRIEST: 305, SHAMAN: 290, MAGE: 270, WARLOCK: 185 }],
    [96, { WARRIOR: 110, HUNTER: 190, ROGUE: 115, SHAMAN: 290, DRUID: 390 }],
  ],
};

/** UnitRace tokens of the pool-5 Hunt as race ids (src/core/gamedata/races.ts). */
const RACE_IDS: Readonly<Record<string, number>> = {
  Human: 1,
  Orc: 2,
  Dwarf: 3,
  NightElf: 4,
  Scourge: 5,
  Tauren: 6,
  Gnome: 7,
  Troll: 8,
};

function targets(faction: Faction, settings: Settings): TargetState[] {
  return CENSUS[faction].flatMap(([race, counts]) =>
    Object.entries(counts).map(([cls, count]) => {
      const t: TargetState = { race, class: CLASS_IDS[cls as ClassFile], count };
      if (settings[`hunt:${t.race}:${t.class}`]?.off) t.off = true;
      return t;
    }),
  );
}

/** Whether a race and class is a valid target of either faction. */
export function sampleValidTarget(race: number, cls: number): boolean {
  return (["Alliance", "Horde"] as const).some((f) =>
    CENSUS[f].some(([r, counts]) => r === race && Object.keys(counts).some((c) => CLASS_IDS[c as ClassFile] === cls)),
  );
}

/** The pool-5 draw's Hunt as ids, keyed by the hunted faction. */
function huntOn(n: number): Partial<Record<Faction, Target>> {
  const out: Partial<Record<Faction, Target>> = {};
  const h = draw(n).hunt;
  for (const hunter of ["Horde", "Alliance"] as const) {
    const c = h?.[hunter];
    const race = c === undefined ? undefined : RACE_IDS[c.race];
    if (c === undefined || race === undefined) continue;
    out[hunter === "Horde" ? "Alliance" : "Horde"] = { race, class: CLASS_IDS[c.class as ClassFile] };
  }
  return out;
}

export function samplePoolData(today: number, settings: Settings): PoolData {
  const days = new Map<number, Partial<Record<Faction, Target>>>();
  for (let n = today; n < today + 16; n++) days.set(n, huntOn(n));
  const hunt: HuntData = {
    targets: { Alliance: targets("Alliance", settings), Horde: targets("Horde", settings) },
    newRaces: [95, 96],
    census: {
      from: Date.UTC(2026, 10, 4, 23) / 1000,
      to: Date.UTC(2026, 10, 10, 15) / 1000,
      characters: 16400,
      installs: 13,
    },
    days,
    points: 5,
  };
  return {
    themeOf: (id) => {
      const g = goal(id);
      return g?.slot === "daily" ? (THEME_OF_CATEGORY[g.category ?? ""] ?? "combat") : undefined;
    },
    duel: [],
    isNew: () => false,
    check: () => undefined,
    duels: new Map(),
    hunt,
  };
}
