import type { MissionStats, PlannedPeriod, Settings } from "@/core/doomsday/missionPool";
import { draw, type Faction, goal, pool } from "@/core/doomsday/rules";
import { CLASSES, type ClassFile } from "@/core/gamedata/classes";
import { raceInfo } from "@/core/gamedata/races";
import type { PoolData } from "@/core/views/missionPool";
import {
  CENSUS_LICENCE,
  CENSUS_URL,
  type CensusInfo,
  type DayRecipeView,
  type HuntTarget,
  type HuntTargetCell,
  type HuntTargetsView,
  type QuarryView,
  type RecipeTileView,
  type Theme,
  type ThemeCardView,
} from "@/core/views/pool6";

// TEMPORARY (WEB-109): pool version 6's view models (src/core/views/pool6.ts) until WEB-108 fills them from its
// catalogue, census and draw; WEB-109 swaps this file for WEB-108's functions before it merges. Nothing here is the
// real catalogue: the themes are a stand-in from the draw's categories, the Hunt days are today's pool-5 draw.

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

const THEMES: readonly [Theme, string][] = [
  ["questing", "Questing"],
  ["loot", "Loot & gold"],
  ["social", "Social"],
  ["professions", "Professions"],
  ["exploration", "Exploration"],
  ["combat", "Combat & character"],
];

/** ChrClasses ids (warcraft.wiki.gg "ClassId"), as the pool 6 contract uses them. */
const CLASS_IDS: Readonly<Record<ClassFile, number>> = {
  WARRIOR: 1,
  PALADIN: 2,
  HUNTER: 3,
  ROGUE: 4,
  PRIEST: 5,
  SHAMAN: 7,
  MAGE: 8,
  WARLOCK: 9,
  DRUID: 11,
};

/**
 * The valid targets per hunted faction, from the game files (the pool 6 contract: Everloot class_races, build
 * 1.60.1.70862), with Everloot's census (https://everloot.app/census, CC BY-SA 4.0): characters active 4–10 Nov 2026,
 * 16,400 characters from 13 installs, rounded to 5. Race ids and tokens: src/core/gamedata/races.ts.
 */
const CENSUS: Readonly<Record<Faction, readonly [number, string, Partial<Record<ClassFile, number>>][]>> = {
  Alliance: [
    [1, "Human", { WARRIOR: 205, PALADIN: 435, HUNTER: 140, ROGUE: 100, PRIEST: 180, MAGE: 155, WARLOCK: 195 }],
    [3, "Dwarf", { WARRIOR: 90, PALADIN: 140, HUNTER: 165, ROGUE: 20, PRIEST: 30, SHAMAN: 325 }],
    [4, "NightElf", { WARRIOR: 65, HUNTER: 230, ROGUE: 60, PRIEST: 75, DRUID: 255 }],
    [7, "Gnome", { WARRIOR: 65, ROGUE: 175, PRIEST: 110, MAGE: 235, WARLOCK: 125 }],
    [95, "Skyborne", { WARRIOR: 10, HUNTER: 35, ROGUE: 15, MAGE: 35, DRUID: 75 }],
  ],
  Horde: [
    [2, "Orc", { WARRIOR: 625, HUNTER: 680, ROGUE: 195, SHAMAN: 640, MAGE: 235, WARLOCK: 440 }],
    [5, "Scourge", { WARRIOR: 180, PALADIN: 1370, ROGUE: 690, PRIEST: 765, MAGE: 595, WARLOCK: 600 }],
    [6, "Tauren", { WARRIOR: 620, HUNTER: 340, SHAMAN: 575, DRUID: 1420 }],
    [8, "Troll", { WARRIOR: 155, HUNTER: 280, ROGUE: 100, PRIEST: 305, SHAMAN: 290, MAGE: 270, WARLOCK: 185 }],
    [96, "Skyborne", { WARRIOR: 110, HUNTER: 190, ROGUE: 115, SHAMAN: 290, DRUID: 390 }],
  ],
};

const CENSUS_INFO: CensusInfo = {
  at: Date.UTC(2026, 10, 10, 15) / 1000,
  asOf: Date.UTC(2026, 10, 10, 15) / 1000,
  from: Date.UTC(2026, 10, 4, 23) / 1000,
  to: Date.UTC(2026, 10, 10, 15) / 1000,
  characters: 16400,
  installs: 13,
  source: "everloot",
  roundTo: 5,
  stale: false,
  url: CENSUS_URL,
  licence: CENSUS_LICENCE,
};

function target(faction: Faction, raceId: number, raceToken: string, classFile: ClassFile): HuntTarget {
  const race = raceInfo(raceId)?.name ?? raceToken;
  const className = CLASSES[classFile].name;
  return {
    key: `${raceId}:${CLASS_IDS[classFile]}`,
    faction,
    raceId,
    classId: CLASS_IDS[classFile],
    raceToken,
    classFile,
    race,
    className,
    name: `${race} ${className}`,
  };
}

function findTarget(faction: Faction, raceToken: string, classFile: string): HuntTarget | undefined {
  const r = CENSUS[faction].find(([, token]) => token === raceToken);
  return r === undefined || r[2][classFile as ClassFile] === undefined
    ? undefined
    : target(faction, r[0], r[1], classFile as ClassFile);
}

/** The pool-5 draw's Hunt as targets, keyed by the hunted faction. */
function huntOn(n: number): Partial<Record<Faction, HuntTarget>> {
  const out: Partial<Record<Faction, HuntTarget>> = {};
  const h = draw(n).hunt;
  for (const hunter of ["Horde", "Alliance"] as const) {
    const c = h?.[hunter];
    const faction = hunter === "Horde" ? "Alliance" : "Horde";
    const t = c === undefined ? undefined : findTarget(faction, c.race, c.class);
    if (t !== undefined) out[faction] = t;
  }
  return out;
}

function targets(settings: Settings, today: Partial<Record<Faction, HuntTarget>>): HuntTargetsView {
  const factions = {} as HuntTargetsView["factions"];
  for (const faction of ["Alliance", "Horde"] as const) {
    const cells = CENSUS[faction].map(([raceId, token, counts]) =>
      Object.entries(counts).map(([cls, count]): HuntTargetCell => {
        const t = target(faction, raceId, token, cls as ClassFile);
        const off = settings[`hunt:${t.raceId}:${t.classId}`]?.off === true;
        return {
          ...t,
          count,
          share: count / 16400,
          drawShare: 0,
          state: off ? "off" : count < 30 ? "skipped" : "on",
          rare: count / 16400 < 0.01,
          forever: raceId >= 95,
          today: today[faction]?.key === t.key,
        };
      }),
    );
    const on = cells.flat().filter((c) => c.state === "on");
    const total = on.reduce((a, c) => a + (c.count ?? 0), 0);
    for (const c of on) c.drawShare = (c.count ?? 0) / total;
    factions[faction] = {
      hunter: faction === "Alliance" ? "Horde" : "Alliance",
      races: CENSUS[faction].map(([raceId, token], i) => ({
        raceId,
        race: raceInfo(raceId)?.name ?? token,
        forever: raceId >= 95,
        cells: cells[i]!,
      })),
      total: cells.flat().length,
      inDraw: on.length,
    };
  }
  return { census: CENSUS_INFO, factions };
}

function tile(
  id: RecipeTileView["id"],
  label: string,
  perPeriod: number,
  period: "day" | "week",
  size: number,
): RecipeTileView {
  const back = (size / perPeriod) * (period === "week" ? 7 : 1);
  return { id, label, perPeriod, period, pool: size, backEveryDays: back, soon: period === "week" && back <= 42 };
}

function card(
  id: ThemeCardView["id"],
  label: string,
  kind: ThemeCardView["kind"],
  missions: string[],
  settings: Settings,
  stats: ReadonlyMap<string, MissionStats>,
): ThemeCardView {
  let cameUp = 0;
  let had = 0;
  let done = 0;
  for (const m of missions) {
    const s = stats.get(m);
    cameUp += s?.cameUp ?? 0;
    had += s?.had ?? 0;
    done += s?.done ?? 0;
  }
  const c: ThemeCardView = {
    id,
    label,
    kind,
    count: missions.length,
    off: missions.filter((m) => settings[m]?.off).length,
    cameUp,
    fresh: 0,
    missions,
  };
  if (had > 0) c.donePct = done / had;
  return c;
}

export function samplePoolData(
  today: number,
  settings: Settings,
  days: readonly PlannedPeriod[],
  stats: ReadonlyMap<string, MissionStats>,
): PoolData {
  const huntDays = new Map<number, Partial<Record<Faction, HuntTarget>>>();
  for (const d of days) huntDays.set(d.n, huntOn(d.n));
  for (let n = today; n < today + 16; n++) if (!huntDays.has(n)) huntDays.set(n, huntOn(n));
  const view = targets(settings, huntDays.get(today) ?? {});
  const on = (ids: readonly string[]) => ids.filter((id) => !settings[id]?.off).length;
  const quarry: PoolData["quarry"] = {};
  for (const faction of ["Alliance", "Horde"] as const) {
    const t = huntDays.get(today)?.[faction];
    if (t === undefined) continue;
    const cell = view.factions[faction].races.flatMap((r) => r.cells).find((c) => c.key === t.key);
    const q: QuarryView = { n: today, target: t, points: 5, census: CENSUS_INFO };
    if (cell?.count !== undefined) q.seen = cell.count;
    quarry[faction] = q;
  }
  const all = [...pool("daily"), ...pool("skirmish"), ...pool("weekly"), ...pool("bounty")];
  const themeOf = (id: string) => THEME_OF_CATEGORY[goal(id)?.category ?? ""] ?? "combat";
  return {
    recipe: [
      tile("pve", "Daily PvE", 3, "day", on(pool("daily"))),
      tile("hunt", "The Hunt", 1, "day", view.factions.Alliance.inDraw),
      tile("pvp", "Daily PvP", 2, "day", on(pool("skirmish"))),
      tile("weekly", "Weekly", 3, "week", on(pool("weekly"))),
      tile("bounty", "Bounty", 1, "week", on(pool("bounty"))),
      { id: "off", label: "Off", perPeriod: 0, period: "day", pool: all.length - on(all), soon: false },
    ],
    days: days.map((p): DayRecipeView => ({
      n: p.n,
      pve: p.plan.slice(0, 3),
      ...(p.plan[3] !== undefined ? { skirmish: p.plan[3] } : {}),
      hunt: { n: p.n, targets: huntDays.get(p.n) ?? {}, pinned: {}, locked: p.locked },
      locked: p.locked,
      changed: p.changed,
    })),
    quarry,
    cards: [
      ...THEMES.map(([theme, label]) =>
        card(
          theme,
          label,
          "Daily PvE",
          pool("daily").filter((id) => themeOf(id) === theme),
          settings,
          stats,
        ),
      ),
      card("skirmish", "Skirmish", "PvP", pool("skirmish"), settings, stats),
      card("weekly", "Weekly", "Weekly", pool("weekly"), settings, stats),
      card("bounty", "Bounty", "PvP", pool("bounty"), settings, stats),
    ],
    targets: view,
  };
}

/** Whether a race and class id is a valid target of either faction (the toggle's check). */
export function sampleValidTarget(raceId: number, classId: number): boolean {
  return (["Alliance", "Horde"] as const).some((f) =>
    CENSUS[f].some(
      ([r, , counts]) => r === raceId && Object.keys(counts).some((c) => CLASS_IDS[c as ClassFile] === classId),
    ),
  );
}
