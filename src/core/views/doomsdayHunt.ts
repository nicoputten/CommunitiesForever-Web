import { classInfo } from "../gamedata/classes";
import { raceInfo } from "../gamedata/races";
import {
  CENSUS_URL,
  type HuntCensus,
  type HuntKill,
  type HuntTarget,
  HUNT_CLASSES,
  HUNT_TARGETS,
  classFileOf,
  huntTargets,
  targetKey,
} from "../doomsday/hunt";
import { clockAt, weekOf } from "../doomsday/rules";
import type { DoomsdaySnapshot, FriendDoomsday } from "../doomsday/snapshot";
import { MONTH_SHORT, WEEKDAY_SHORT } from "../names";
import { compareText } from "./characters";

// The Hunt on the Doomsday pages (WEB-110, boards DS01HuntToday and DS02HuntMore, design/boards/doomsday-hunt): the
// Hunt card, "The Hunt today" with tomorrow's quarry, the Today so far line, the board's Hunt column, the PvP tab's
// trophies and "Hunt · this week", and the six Hunt feats. Census numbers are Everloot's sample ("seen this week"),
// always linked to its census with the window's dates; without a census they don't show.

type Faction = "Alliance" | "Horde";

/** A target for the portrait (race ring + class icon) and its name. */
export interface QuarryView {
  key: string;
  /** "Night Elf Hunter". */
  name: string;
  /** "Night Elf". */
  raceName: string;
  /** The race ring's letters: "NE", "Gn". */
  raceShort: string;
  classFile?: string;
  className: string;
}

/** A census number with its link (Everloot's census, CC BY-SA 4.0) and its window. */
export interface SeenView {
  /** "230". */
  count: string;
  href: string;
  /** "Everloot census · active 4–10 Nov": the link's accessible name and hover. */
  title: string;
}

/** The Hunt card in Your goals (DS01). */
export interface HuntCardView {
  quarry: QuarryView;
  /** "+5 PvP". */
  worth: string;
  /** Open, with a census: "230" seen this week. */
  seen?: SeenView;
  /** "Everloot census: Night Elf Hunters seen in the last 7 days. More seen = easier to find." */
  seenTip?: string;
  /** Done: "bagged at 21:02 in Ashenvale" (no zone from an older addon: "bagged at 21:02"). */
  bagged?: string;
}

export interface HuntTodayView {
  /** "1 of 12 bagged one". */
  count: string;
  /** Up to four friends, those who bagged one first. */
  friends: { key: string; name: string; classFile?: string; bagged: boolean; text: string }[];
  /** "+ 8 more", to the board's Hunt column. */
  more?: { text: string; href: string };
  tomorrow?: QuarryView;
}

export type TrophyCell =
  | { kind: "na" }
  | {
      kind: "target";
      key: string;
      count: number;
      /** Seen fewer than RARE_SEEN this week: the blue ring. */
      rare: boolean;
      /** "Human Paladin · bagged 3× · last Tue · 435 seen this week". */
      label: string;
    };

export interface TrophiesView {
  /** "Hunt trophies · Ves". */
  title: string;
  /** "6 of 28 · 9 quarries". */
  summary: string;
  percent: number;
  classes: { id: number; classFile?: string; name: string }[];
  rows: { race: number; name: string; cells: TrophyCell[] }[];
  /** "Rarest: Skyborne Druid (75 seen this week) · …"; only with a census. */
  rarest?: { name: string; seen: SeenView };
}

export interface HuntWeekView {
  rows: { place: number; key: string; name: string; classFile?: string; days: string }[];
}

export interface HuntFeatView {
  id: string;
  title: string;
  text: string;
  done: boolean;
  /** Unfinished: "9 / 10" and its share. */
  progress?: { text: string; percent: number };
}

/** Under this many seen this week a target gets the blue "rare" ring (board DS02HuntMore). */
export const RARE_SEEN = 60;

/** How many friends "The Hunt today" lists before "+ N more" (board DS01HuntToday). */
const TODAY_FRIENDS = 4;

/** The board tab with its Hunt column ("+ N more"). */
export const BOARD_HUNT_HREF = "/doomsday/board#hunt";

/** The race ring's letters: the initials of a two-word race ("NE"), else its first two letters ("Gn"). */
export function raceShort(name: string): string {
  const words = name.split(" ").filter((w) => w !== "");
  if (words.length > 1) return words.map((w) => w[0]!.toUpperCase()).join("");
  return name.slice(0, 2);
}

export function quarryView(t: HuntTarget): QuarryView {
  const raceName = raceInfo(t.race)?.name ?? "Unknown race";
  const classFile = classFileOf(t.class);
  const className = classInfo(classFile)?.name ?? "Unknown class";
  const view: QuarryView = {
    key: targetKey(t),
    name: `${raceName} ${className}`,
    raceName,
    raceShort: raceShort(raceName),
    className,
  };
  if (classFile !== undefined) view.classFile = classFile;
  return view;
}

/** "4–10 Nov", "28 Oct–3 Nov": the census's 7-day window in the zone. */
export function censusWindow(c: HuntCensus, timeZone: string): string {
  const part = (at: number) => {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "numeric" })
      .formatToParts(new Date(at * 1000))
      .reduce<Record<string, string>>((acc, x) => ({ ...acc, [x.type]: x.value }), {});
    return { day: p.day ?? "", month: MONTH_SHORT[Number(p.month) - 1] ?? "" };
  };
  const from = part(c.at - 6 * 86400);
  const to = part(c.at);
  return from.month === to.month ? `${from.day}–${to.day} ${to.month}` : `${from.day} ${from.month}–${to.day} ${to.month}`;
}

function seenOf(t: HuntTarget, census: HuntCensus | undefined, timeZone: string): SeenView | undefined {
  const n = census?.counts[targetKey(t)];
  if (census === undefined || n === undefined) return undefined;
  return {
    count: n.toLocaleString("en-GB"),
    href: CENSUS_URL,
    title: `Everloot census · active ${censusWindow(census, timeZone)}`,
  };
}

/** The faction a friend hunts; Alliance targets when unknown (the group plays Horde). */
function huntedOf(f: FriendDoomsday | undefined): Faction {
  return f?.hunted ?? "Alliance";
}

function todayKill(f: FriendDoomsday, day: number): HuntKill | undefined {
  return (f.huntKills ?? []).find((k) => k.day === day);
}

/** "21:02 in Ashenvale" / "21:02". */
function at(k: HuntKill, s: DoomsdaySnapshot, timeZone: string, sep: string): string {
  const time = clockAt(k.at, s.schedule.dayStart, timeZone);
  return k.zone === undefined ? time : `${time}${sep}${k.zone}`;
}

/**
 * The Hunt card of a Hunt goal on Today: its column ("hunt:alliance") names the hunted faction. Done: when and where
 * the viewer bagged it, the zone when the addon sent one.
 */
export function huntCard(
  s: DoomsdaySnapshot,
  me: FriendDoomsday,
  goal: { columnId: string; points: number; doneAt?: number },
  timeZone: string,
): HuntCardView | undefined {
  const hunted: Faction = goal.columnId === "hunt:horde" ? "Horde" : "Alliance";
  const target = s.quarry?.today[hunted];
  if (target === undefined) return undefined;
  const quarry = quarryView(target);
  const card: HuntCardView = { quarry, worth: `+${goal.points} PvP` };
  if (goal.doneAt !== undefined) {
    const kill = todayKill(me, s.schedule.day);
    const time = clockAt(kill?.at ?? goal.doneAt, s.schedule.dayStart, timeZone);
    card.bagged = kill?.zone === undefined ? `bagged at ${time}` : `bagged at ${time} in ${kill.zone}`;
    return card;
  }
  const seen = seenOf(target, s.census, timeZone);
  if (seen !== undefined) {
    card.seen = seen;
    card.seenTip = `Everloot census: ${quarry.name}s seen in the last 7 days. More seen = easier to find.`;
  }
  return card;
}

/** Friends with Doomsday data; the viewer's own faction decides tomorrow's quarry. */
export function huntToday(s: DoomsdaySnapshot, viewerKey: string | undefined, timeZone: string): HuntTodayView {
  const active = s.friends.filter((f) => f.status === "active");
  const rows = active
    .map((f) => ({ f, kill: todayKill(f, s.schedule.day) }))
    .sort(
      (a, b) =>
        Number(b.kill !== undefined) - Number(a.kill !== undefined) ||
        (a.kill?.at ?? 0) - (b.kill?.at ?? 0) ||
        compareText(a.f.name, b.f.name),
    );
  const bagged = rows.filter((r) => r.kill !== undefined).length;
  const view: HuntTodayView = {
    count: `${bagged} of ${active.length} bagged one`,
    friends: rows.slice(0, TODAY_FRIENDS).map(({ f, kill }) => {
      const row: HuntTodayView["friends"][number] = {
        key: f.friendKey,
        name: f.name,
        bagged: kill !== undefined,
        text: kill === undefined ? "—" : at(kill, s, timeZone, " · "),
      };
      if (f.classFile !== undefined) row.classFile = f.classFile;
      return row;
    }),
  };
  if (rows.length > TODAY_FRIENDS) view.more = { text: `+ ${rows.length - TODAY_FRIENDS} more`, href: BOARD_HUNT_HREF };
  const me = s.friends.find((f) => f.friendKey === viewerKey);
  const tomorrow = s.quarry?.tomorrow[huntedOf(me)];
  if (tomorrow !== undefined) view.tomorrow = quarryView(tomorrow);
  return view;
}

/** Today so far: "Grom bagged a Night Elf Hunter · 20:14", in the order they were bagged. */
export function huntSoFar(s: DoomsdaySnapshot, timeZone: string): { key: string; text: string }[] {
  return s.friends
    .filter((f) => f.status === "active")
    .flatMap((f) => {
      const k = todayKill(f, s.schedule.day);
      return k === undefined ? [] : [{ f, k }];
    })
    .sort((a, b) => a.k.at - b.k.at || compareText(a.f.name, b.f.name))
    .map(({ f, k }) => ({
      key: f.friendKey,
      text: `${f.name} bagged a ${quarryView(k).name} · ${clockAt(k.at, s.schedule.dayStart, timeZone)}`,
    }));
}

/** The board's Hunt cell hover: "Bagged 20:14 in Ashenvale". */
export function boardHuntTitle(s: DoomsdaySnapshot, f: FriendDoomsday, timeZone: string): string | undefined {
  const k = todayKill(f, s.schedule.day);
  return k === undefined ? undefined : `Bagged ${at(k, s, timeZone, " in ")}`;
}

/** "Tue" within the last week, else "2 Nov". */
function lastDay(atSec: number, now: number, timeZone: string): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "numeric" })
    .formatToParts(new Date(atSec * 1000))
    .reduce<Record<string, string>>((acc, x) => ({ ...acc, [x.type]: x.value }), {});
  if (now - atSec < 6 * 86400) return WEEKDAY_SHORT[WEEKDAY_SHORT.indexOf(p.weekday ?? "")] ?? p.weekday ?? "";
  return `${p.day} ${MONTH_SHORT[Number(p.month) - 1]}`;
}

/** The PvP tab's trophy collection of one friend (DS02): the other faction's valid targets, gold where bagged. */
export function huntTrophies(s: DoomsdaySnapshot, f: FriendDoomsday, timeZone: string): TrophiesView {
  const hunted = huntedOf(f);
  const kills = f.huntKills ?? [];
  const byKey = new Map<string, HuntKill[]>();
  for (const k of kills) byKey.set(targetKey(k), [...(byKey.get(targetKey(k)) ?? []), k]);
  const targets = huntTargets(hunted);
  const got = targets.filter((t) => byKey.has(targetKey(t))).length;
  const quarries = kills.filter((k) => targets.some((t) => targetKey(t) === targetKey(k))).length;
  const view: TrophiesView = {
    title: `Hunt trophies · ${f.name}`,
    summary: `${got} of ${targets.length} · ${quarries} ${quarries === 1 ? "quarry" : "quarries"}`,
    percent: targets.length === 0 ? 0 : Math.round((got / targets.length) * 100),
    classes: HUNT_CLASSES.map((id) => {
      const classFile = classFileOf(id);
      const c: TrophiesView["classes"][number] = { id, name: classInfo(classFile)?.name ?? "Unknown class" };
      if (classFile !== undefined) c.classFile = classFile;
      return c;
    }),
    rows: HUNT_TARGETS[hunted].map((r) => ({
      race: r.race,
      name: raceInfo(r.race)?.name ?? "Unknown race",
      cells: HUNT_CLASSES.map((c): TrophyCell => {
        if (!r.classes.includes(c)) return { kind: "na" };
        const t = { race: r.race, class: c };
        const mine = byKey.get(targetKey(t)) ?? [];
        const seen = s.census?.counts[targetKey(t)];
        const label = [
          quarryView(t).name,
          mine.length > 0 ? `bagged ${mine.length}×` : undefined,
          mine.length > 0 ? `last ${lastDay(mine[mine.length - 1]!.at, s.now, timeZone)}` : undefined,
          seen !== undefined ? `${seen.toLocaleString("en-GB")} seen this week` : undefined,
        ]
          .filter((x) => x !== undefined)
          .join(" · ");
        return { kind: "target", key: targetKey(t), count: mine.length, rare: seen !== undefined && seen < RARE_SEEN, label };
      }),
    })),
  };
  const counted = targets
    .map((t) => ({ t, n: s.census?.counts[targetKey(t)] }))
    .filter((x): x is { t: HuntTarget; n: number } => x.n !== undefined)
    .sort((a, b) => a.n - b.n);
  const rarest = counted[0];
  const seen = rarest === undefined ? undefined : seenOf(rarest.t, s.census, timeZone);
  if (rarest !== undefined && seen !== undefined) {
    view.rarest = { name: quarryView(rarest.t).name, seen };
  }
  return view;
}

/** "Hunt · this week": friends ranked by days with the quarry bagged this week (none: not listed). */
export function huntWeek(s: DoomsdaySnapshot): HuntWeekView {
  const ranked = s.friends
    .filter((f) => f.status === "active")
    .map((f) => ({ f, days: new Set((f.huntKills ?? []).filter((k) => weekOf(k.day) === s.schedule.week).map((k) => k.day)).size }))
    .filter((r) => r.days > 0)
    .sort((a, b) => b.days - a.days || compareText(a.f.name, b.f.name));
  return {
    rows: ranked.map(({ f, days }, i) => {
      const row: HuntWeekView["rows"][number] = {
        place: i + 1,
        key: f.friendKey,
        name: f.name,
        days: `${days} ${days === 1 ? "day" : "days"}`,
      };
      if (f.classFile !== undefined) row.classFile = f.classFile;
      return row;
    }),
  };
}

/** The longest run of consecutive Doomsday days with a quarry bagged. */
function longestRun(days: readonly number[]): number {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  sorted.forEach((d, i) => {
    run = i > 0 && d === sorted[i - 1]! + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** The six Hunt feats of a friend with their progress (DS02; ids of the pool-6 contract). */
export function huntFeats(s: DoomsdaySnapshot, f: FriendDoomsday): HuntFeatView[] {
  const hunted = huntedOf(f);
  const kills = f.huntKills ?? [];
  const targets = huntTargets(hunted);
  const valid = kills.filter((k) => targets.some((t) => targetKey(t) === targetKey(k)));
  const classes = [...new Set(targets.map((t) => t.class))];
  const rare = new Set(s.rare ?? []);
  const feat = (id: string, title: string, text: string, value: number, target: number): HuntFeatView => {
    const v = Math.min(value, target);
    const view: HuntFeatView = { id, title, text, done: v >= target };
    if (!view.done) view.progress = { text: `${v} / ${target}`, percent: Math.round((v / target) * 100) };
    return view;
  };
  return [
    feat("f.huntFirst", "First quarry", "Bag your first Hunt target", valid.length, 1),
    feat("f.hunt10", "Quarry ×10", "Bag 10 Hunt targets", valid.length, 10),
    feat(
      "f.huntClasses",
      "Every class",
      `Bag every ${hunted} class`,
      new Set(valid.map((k) => k.class)).size,
      classes.length,
    ),
    feat(
      "f.huntAll",
      "Big game",
      `Bag all ${targets.length} race and class targets`,
      new Set(valid.map(targetKey)).size,
      targets.length,
    ),
    feat(
      "f.huntRare",
      "Rare quarry",
      "Bag a target under 1% of the census",
      valid.some((k) => rare.has(targetKey(k))) ? 1 : 0,
      1,
    ),
    feat("f.huntWeek", "Hunter’s week", "Bag the quarry 7 days in a row", longestRun(valid.map((k) => k.day)), 7),
  ];
}
