import { classInfo, type ClassFile } from "../gamedata/classes";
import { raceInfo } from "../gamedata/races";
import { shortDay } from "../doomsday/missionPool";
import { DAY, type Faction } from "../doomsday/rules";
import { MONTH_SHORT, WEEKDAY_SHORT } from "../names";

// The Hunt on the Mission pool page (WEB-109, boards `mission-pool-v2-overview`, `mission-pool-v2-hunt`): today's
// quarry, the next 7 days and the targets grid weighted by Everloot's census. Targets are race id + class id (pool
// version 6 contract); names come from the game data here. Pure.

/**
 * ChrClasses ids by classFile, as `UnitClass`'s third value gives them. Source: the client's ChrClasses table, as
 * warcraft.wiki.gg "ClassId" lists them (https://warcraft.wiki.gg/wiki/ClassId); the pool 6 contract uses them.
 */
export const CLASS_IDS: Readonly<Record<ClassFile, number>> = {
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

const BY_CLASS_ID = new Map<number, ClassFile>(Object.entries(CLASS_IDS).map(([f, id]) => [id, f as ClassFile]));

/** "MAGE" for 8; undefined for an id the game data doesn't know. */
export function classFileOf(classId: number): ClassFile | undefined {
  return BY_CLASS_ID.get(classId);
}

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

/** "Night Elf", "Skyborne"; "?" for an unknown race id. */
export function raceName(race: number): string {
  return raceInfo(race)?.name ?? "?";
}

/** "NE": a race's initials on a portrait. */
export function raceShort(race: number): string {
  const name = raceName(race);
  return RACE_SHORT[name] ?? name.slice(0, 2);
}

export interface Target {
  race: number;
  class: number;
}

/** "Gnome Mage". */
export function targetName(t: Target): string {
  return `${raceName(t.race)} ${classInfo(classFileOf(t.class))?.name ?? "?"}`;
}

export const targetKey = (t: Target) => `${t.race}:${t.class}`;

/** A valid target with what the site knows of it (WEB-108). */
export interface TargetState extends Target {
  /** Everloot's census: seen active in the last 7 days, rounded to 5. Undefined: not in the census. */
  count?: number;
  /** The owner switched it off. */
  off?: boolean;
  /** The last day it was the quarry. */
  lastHunted?: number;
  /** Friends who had it and bagged one, 0..100. */
  donePct?: number;
}

export interface Census {
  /** The window, unix seconds. */
  from: number;
  to: number;
  characters: number;
  installs: number;
}

/** The Hunt's data from the site's draw (WEB-108), keyed by the hunted faction as the schedule is. */
export interface HuntData {
  targets: Readonly<Record<Faction, readonly TargetState[]>>;
  /** Race ids new to the list (Forever's Skyborne). */
  newRaces: readonly number[];
  census?: Census;
  /** The day's targets, keyed by the hunted faction. */
  days: ReadonlyMap<number, Partial<Record<Faction, Target>>>;
  /** Today's Hunt: friends who had it and bagged one, 0..100. */
  donePct?: number;
  /** The Hunt's points. */
  points: number;
}

/** A target with fewer seen is skipped (brief 1.4). */
export const MIN_SEEN = 30;

/** The group plays Horde: Horde hunts first (Alliance targets). */
export const HUNTERS: readonly Faction[] = ["Horde", "Alliance"];
export const hunted = (hunter: Faction): Faction => (hunter === "Horde" ? "Alliance" : "Horde");

export interface Portrait {
  race: number;
  classFile: string;
  /** "Gn". */
  short: string;
  /** "Gnome Mage". */
  name: string;
  /** "Gnome". */
  raceName: string;
  /** "Mage". */
  className: string;
}

export function portrait(t: Target): Portrait {
  const classFile = classFileOf(t.class) ?? "";
  return {
    race: t.race,
    classFile,
    short: raceShort(t.race),
    name: targetName(t),
    raceName: raceName(t.race),
    className: classInfo(classFile)?.name ?? "?",
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

const countOf = (h: HuntData, faction: Faction, t: Target) =>
  h.targets[faction].find((x) => x.race === t.race && x.class === t.class)?.count;

/** Today's quarry card: the Horde's target, the Alliance's, the next 7 days. */
export function quarry(h: HuntData, today: number): Quarry {
  const [mine, theirs] = HUNTERS as [Faction, Faction];
  const day = h.days.get(today);
  const t = day?.[hunted(mine)];
  const o = day?.[hunted(theirs)];
  const q: Quarry = {
    kicker: `Today’s quarry · ${shortDay(today)}`,
    hunter: `${mine} hunts`,
    points: `+${h.points}`,
    next: [],
  };
  if (t !== undefined) {
    q.target = portrait(t);
    const seen = countOf(h, hunted(mine), t);
    if (seen !== undefined) q.seen = String(seen);
  }
  if (h.donePct !== undefined) q.done = `${h.donePct}%`;
  if (o !== undefined) q.other = { hunter: `${theirs} hunts`, target: portrait(o) };
  for (let n = today + 1; n <= today + 7; n++) {
    const x = h.days.get(n)?.[hunted(mine)];
    if (x !== undefined) q.next.push({ ...portrait(x), n, weekday: weekday(n) });
  }
  return q;
}

/** The Hunt line on a day tile: the group's target. */
export function dayTarget(h: HuntData, n: number): string | undefined {
  const t = h.days.get(n)?.[hunted(HUNTERS[0]!)];
  return t === undefined ? undefined : targetName(t);
}

export type CellState = "draw" | "skip" | "off" | "invalid";

export interface TargetCell {
  classFile: ClassFile;
  state: CellState;
  race: number;
  class: number;
  /** "205"; undefined for invalid or outside the census. */
  count?: string;
  /** 0..100: the weight bar against the faction's biggest count. */
  bar?: number;
  /** "5.5% of draws", "too rare", "off". */
  label?: string;
  /** The phone's line: "205 · 5.5%", "20 · too rare", "205 · off". */
  line?: string;
  today: boolean;
  /** A Forever race new to the list. */
  fresh: boolean;
  /** The hover: "Gnome Mage · 235 seen this week · 6.4% of draws · last hunted Thu 12 Nov · done 41%". */
  tip?: string;
}

export interface TargetRow {
  race: number;
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
  /** "?hunter=Alliance". */
  href: string;
}

export interface TargetsView {
  quarry: Quarry;
  tabs: TargetTab[];
  /** The open tab. */
  hunter: Faction;
  rows: TargetRow[];
  /** "Everloot census · active 4–10 Nov · 16,400 characters from 13 installs · numbers rounded to 5". */
  census?: string;
}

const stateOf = (t: TargetState): Exclude<CellState, "invalid"> =>
  t.off ? "off" : t.count === undefined || t.count < MIN_SEEN ? "skip" : "draw";

/** The share of the draw per in-draw target, 1 decimal ("5.5"). */
function shares(list: readonly TargetState[]): Map<string, string> {
  const inDraw = list.filter((t) => stateOf(t) === "draw");
  const total = inDraw.reduce((a, t) => a + t.count!, 0);
  return new Map(inDraw.map((t) => [targetKey(t), ((t.count! / total) * 100).toFixed(1)]));
}

/** "Thu 12 Nov" for a day. */
function longDay(n: number): string {
  const d = new Date(n * DAY * 1000);
  return `${weekday(n)} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

const thousands = (n: number) => n.toLocaleString("en-US");

/** "active 4–10 Nov", "active 28 Oct–3 Nov": the census window in UTC dates. */
function window(c: Census): string {
  const a = new Date(c.from * 1000);
  const b = new Date(c.to * 1000);
  const am = MONTH_SHORT[a.getUTCMonth()];
  const bm = MONTH_SHORT[b.getUTCMonth()];
  return am === bm
    ? `active ${a.getUTCDate()}–${b.getUTCDate()} ${bm}`
    : `active ${a.getUTCDate()} ${am}–${b.getUTCDate()} ${bm}`;
}

export function censusLine(c: Census): string {
  return `Everloot census · ${window(c)} · ${thousands(c.characters)} characters from ${c.installs} installs · numbers rounded to 5`;
}

export function inDrawCount(list: readonly TargetState[]): number {
  return list.filter((t) => stateOf(t) === "draw").length;
}

/** The Hunt targets page (board `mission-pool-v2-hunt`): one tab per hunting faction, races × classes. */
export function targetsView(h: HuntData, today: number, hunter: Faction = HUNTERS[0]!): TargetsView {
  const faction = hunted(hunter);
  const list = h.targets[faction];
  const share = shares(list);
  const max = Math.max(1, ...list.filter((t) => stateOf(t) === "draw").map((t) => t.count!));
  const todays = h.days.get(today)?.[faction];
  const races = [...new Set(list.map((t) => t.race))];
  const rows: TargetRow[] = races.map((race) => {
    const fresh = h.newRaces.includes(race);
    return {
      race,
      name: raceName(race),
      fresh,
      cells: CLASS_ORDER.map((classFile): TargetCell => {
        const cls = CLASS_IDS[classFile];
        const t = list.find((x) => x.race === race && x.class === cls);
        const base = { classFile, race, class: cls, fresh, today: false };
        if (t === undefined) return { ...base, state: "invalid" };
        const state = stateOf(t);
        const cell: TargetCell = {
          ...base,
          state,
          today: todays !== undefined && todays.race === race && todays.class === cls,
        };
        const count = t.count === undefined ? "—" : String(t.count);
        if (t.count !== undefined) cell.count = count;
        const pct = share.get(targetKey(t));
        if (state === "draw") {
          cell.bar = (t.count! / max) * 100;
          cell.label = `${pct}% of draws`;
          cell.line = `${count} · ${pct}%`;
        } else {
          cell.label = state === "off" ? "off" : "too rare";
          cell.line = `${count} · ${cell.label}`;
        }
        const tip = [targetName(t)];
        if (t.count !== undefined) tip.push(`${t.count} seen this week`);
        if (pct !== undefined) tip.push(`${pct}% of draws`);
        if (t.lastHunted !== undefined) tip.push(`last hunted ${longDay(t.lastHunted)}`);
        if (t.donePct !== undefined) tip.push(`done ${t.donePct}%`);
        cell.tip = tip.join(" · ");
        return cell;
      }),
    };
  });
  const view: TargetsView = {
    quarry: quarry(h, today),
    hunter,
    tabs: HUNTERS.map((f) => ({
      hunter: f,
      label: `${f} hunts · ${hunted(f)} targets`,
      inDraw: inDrawCount(h.targets[hunted(f)]),
      href: `?hunter=${f}`,
    })),
    rows,
  };
  if (h.census !== undefined) view.census = censusLine(h.census);
  return view;
}
