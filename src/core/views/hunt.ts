import { CLASSES, type ClassFile } from "../gamedata/classes";
import { raceInfo } from "../gamedata/races";
import { shortDay } from "../doomsday/missionPool";
import { DAY, type Faction } from "../doomsday/rules";
import { MONTH_SHORT, WEEKDAY_SHORT } from "../names";
import type { CensusInfo, DayRecipeView, HuntTarget, HuntTargetsView, QuarryView } from "./pool6";

// The Hunt on the Mission pool page (WEB-109, boards `mission-pool-v2-overview`, `mission-pool-v2-hunt`): today's
// quarry, the next 7 days and the targets grid weighted by Everloot's census, as text from WEB-108's pool version 6
// view models (src/core/views/pool6.ts). Pure.

/** The grid's columns: the nine classes in the boards' order. */
export const CLASS_ORDER: readonly ClassFile[] = [
  "WARRIOR",
  "PALADIN",
  "HUNTER",
  "ROGUE",
  "PRIEST",
  "SHAMAN",
  "MAGE",
  "WARLOCK",
  "DRUID",
];

/** The race initials on a portrait (boards: Hu, Dw, NE, Gn, Ud). A display choice, by race name. */
const RACE_SHORT: Readonly<Record<string, string>> = {
  Human: "Hu",
  Dwarf: "Dw",
  "Night Elf": "NE",
  Gnome: "Gn",
  Skyborne: "Sk",
  Orc: "Or",
  Undead: "Ud",
  Tauren: "Ta",
  Troll: "Tr",
};

/** "NE": a race's initials on a portrait. */
export function raceShort(race: string): string {
  return RACE_SHORT[race] ?? race.slice(0, 2);
}

/**
 * Both hunting factions, Horde first (the group plays Horde). The pages get the group's own (`groupHunters`, WEB-112):
 * a faction no friend plays doesn't show.
 */
export const HUNTERS: readonly Faction[] = ["Horde", "Alliance"];
export const hunted = (hunter: Faction): Faction => (hunter === "Horde" ? "Alliance" : "Horde");

/** A target as WEB-110's QuarryPortrait shows it, plus its race and class for the next days' labels. */
export interface Portrait {
  key: string;
  /** "Gnome Mage". */
  name: string;
  /** "Gnome". */
  raceName: string;
  /** "Gn". */
  raceShort: string;
  classFile: string;
  /** "Mage". */
  className: string;
}

export function portrait(t: HuntTarget): Portrait {
  return {
    key: t.key,
    name: t.name,
    raceName: t.race,
    raceShort: raceShort(t.race),
    classFile: t.classFile,
    className: t.className,
  };
}

export interface QuarryDay extends Portrait {
  n: number;
  /** "Fri". */
  weekday: string;
}

export interface Quarry {
  /** "Today’s quarry · Thu 19". */
  kicker: string;
  /** The group's target (Horde hunts); undefined: no Hunt drawn today. */
  target?: Portrait;
  /** "Horde hunts". */
  hunter: string;
  /** "+5". */
  points: string;
  /** "9%"; undefined without records. */
  done?: string;
  /** "235"; undefined outside the census. */
  seen?: string;
  /** The other faction's target. */
  other?: { hunter: string; target: Portrait };
  next: QuarryDay[];
}

const weekday = (n: number) => WEEKDAY_SHORT[(n + 4) % 7]!;
const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Today's quarry card: the target of the group's first hunting faction (`quarry` and `days` keyed by the hunted
 * faction), the second's when the group plays both (WEB-112), the next 7 days.
 */
export function quarry(
  q: Partial<Record<Faction, QuarryView>>,
  days: readonly DayRecipeView[],
  today: number,
  hunters: readonly Faction[] = HUNTERS,
  points = 5,
): Quarry {
  const mine = hunters[0] ?? "Horde";
  const theirs = hunters[1];
  const own = q[hunted(mine)];
  const other = theirs === undefined ? undefined : q[hunted(theirs)];
  const out: Quarry = {
    kicker: `Today’s quarry · ${shortDay(today)}`,
    hunter: `${mine} hunts`,
    points: `+${own?.points ?? points}`,
    next: [],
  };
  if (own !== undefined) {
    out.target = portrait(own.target);
    if (own.seen !== undefined) out.seen = String(own.seen);
    if (own.doneToday !== undefined) out.done = pct(own.doneToday);
  }
  if (other !== undefined && theirs !== undefined)
    out.other = { hunter: `${theirs} hunts`, target: portrait(other.target) };
  for (let n = today + 1; n <= today + 7; n++) {
    const t = days.find((d) => d.n === n)?.hunt.targets[hunted(mine)];
    if (t !== undefined) out.next.push({ ...portrait(t), n, weekday: weekday(n) });
  }
  return out;
}

/** The Hunt line on a day tile: the target of the group's first hunting faction. */
export function dayTarget(d: DayRecipeView | undefined, hunter: Faction = HUNTERS[0]!): string | undefined {
  return d?.hunt.targets[hunted(hunter)]?.name;
}

export type CellState = "draw" | "skip" | "off" | "invalid";

export interface TargetCell {
  classFile: ClassFile;
  state: CellState;
  key?: string;
  raceId?: number;
  classId?: number;
  /** "Gnome Mage". */
  name?: string;
  /** "205"; undefined for invalid or outside the census. */
  count?: string;
  /** 0..100: the weight bar against the faction's biggest count in the draw. */
  bar?: number;
  /** "5.5% of draws", "too rare", "off". */
  label?: string;
  /** The phone's line: "205 · 5.5%", "20 · too rare", "205 · off". */
  line?: string;
  today: boolean;
  /** A Forever race new to the list (the row's race). */
  fresh: boolean;
  /** The hover: "Gnome Mage · 235 seen this week · 6.4% of draws · last hunted Thu 12 Nov · done 41%". */
  tip?: string;
}

export interface TargetRow {
  raceId: number;
  name: string;
  fresh: boolean;
  cells: TargetCell[];
}

export interface TargetTab {
  hunter: Faction;
  /** "Horde hunts · Alliance targets". */
  label: string;
  /** Targets in the draw: "25". */
  inDraw: number;
}

/** "Thu 12 Nov" for a day. */
function longDay(n: number): string {
  const d = new Date(n * DAY * 1000);
  return `${weekday(n)} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/** "active 4–10 Nov", "active 28 Oct–3 Nov": the census window in UTC dates. */
function window(from: number, to: number): string {
  const a = new Date(from * 1000);
  const b = new Date(to * 1000);
  const am = MONTH_SHORT[a.getUTCMonth()];
  const bm = MONTH_SHORT[b.getUTCMonth()];
  return am === bm
    ? `active ${a.getUTCDate()}–${b.getUTCDate()} ${bm}`
    : `active ${a.getUTCDate()} ${am}–${b.getUTCDate()} ${bm}`;
}

/** "Everloot census · active 4–10 Nov · 16,400 characters from 13 installs · numbers rounded to 5". */
export function censusLine(c: CensusInfo): string {
  const parts = ["Everloot census"];
  if (c.from !== undefined && c.to !== undefined) parts.push(window(c.from, c.to));
  if (c.characters !== undefined && c.installs !== undefined)
    parts.push(`${c.characters.toLocaleString("en-US")} characters from ${c.installs} installs`);
  if (c.roundTo !== undefined) parts.push(`numbers rounded to ${c.roundTo}`);
  return parts.join(" · ");
}

/** The grid's tabs: one per faction the group hunts with (WEB-112; the page shows none for just one). */
export function tabs(v: HuntTargetsView, hunters: readonly Faction[] = HUNTERS): TargetTab[] {
  return hunters.map((f) => ({
    hunter: f,
    label: `${f} hunts · ${hunted(f)} targets`,
    inDraw: v.factions[hunted(f)].inDraw,
  }));
}

/** The grid of one hunting faction (board `mission-pool-v2-hunt`): races × the nine classes. */
export function targetRows(v: HuntTargetsView, hunter: Faction): TargetRow[] {
  const races = v.factions[hunted(hunter)].races;
  const max = Math.max(1, ...races.flatMap((r) => r.cells.filter((c) => c.state === "on").map((c) => c.count ?? 0)));
  return races.map((r) => ({
    raceId: r.raceId,
    name: r.race,
    fresh: r.forever,
    cells: CLASS_ORDER.map((classFile): TargetCell => {
      const t = r.cells.find((c) => c.classFile === classFile);
      if (t === undefined) return { classFile, state: "invalid", today: false, fresh: r.forever };
      const state: CellState = t.state === "on" ? "draw" : t.state === "skipped" ? "skip" : "off";
      const count = t.count === undefined ? "—" : String(t.count);
      const share = (t.drawShare * 100).toFixed(1);
      const cell: TargetCell = {
        classFile,
        state,
        key: t.key,
        raceId: t.raceId,
        classId: t.classId,
        name: t.name,
        today: t.today,
        fresh: r.forever,
      };
      if (t.count !== undefined) cell.count = count;
      if (state === "draw") {
        cell.bar = ((t.count ?? 0) / max) * 100;
        cell.label = `${share}% of draws`;
        cell.line = `${count} · ${share}%`;
      } else {
        cell.label = state === "off" ? "off" : "too rare";
        cell.line = `${count} · ${cell.label}`;
      }
      const tip = [t.name];
      if (t.count !== undefined) tip.push(`${t.count} seen this week`);
      if (state === "draw") tip.push(`${share}% of draws`);
      if (t.lastHunted !== undefined) tip.push(`last hunted ${longDay(t.lastHunted)}`);
      if (t.donePct !== undefined) tip.push(`done ${pct(t.donePct)}`);
      cell.tip = tip.join(" · ");
      return cell;
    }),
  }));
}

/** Whether a race and class id is a valid target of either faction (the toggle's check). */
export function validTarget(v: HuntTargetsView, raceId: number, classId: number): boolean {
  return (["Alliance", "Horde"] as const).some((f) =>
    v.factions[f].races.some((r) => r.cells.some((c) => c.raceId === raceId && c.classId === classId)),
  );
}

/**
 * ChrClasses ids by classFile, as `UnitClass`'s third value gives them. Source: the client's ChrClasses table, as
 * warcraft.wiki.gg "ClassId" lists them (https://warcraft.wiki.gg/wiki/ClassId); the pool 6 contract uses them.
 */
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

/** "Gnome Mage" for race id 7 and class id 8 (the Admin changes line of a target switched off). */
export function targetNameOf(raceId: number, classId: number): string {
  const cls = (Object.keys(CLASS_IDS) as ClassFile[]).find((f) => CLASS_IDS[f] === classId);
  return `${raceInfo(raceId)?.name ?? "?"} ${cls === undefined ? "?" : CLASSES[cls].name}`;
}
