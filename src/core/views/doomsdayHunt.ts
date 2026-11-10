import type { Faction } from "../doomsday/rules";
import { clockAt } from "../doomsday/rules";
import type { DoomsdaySnapshot, FriendDoomsday } from "../doomsday/snapshot";
import { MONTH_SHORT, WEEKDAY_SHORT } from "../names";
import type {
  CensusInfo,
  FriendHuntView,
  HuntKill,
  HuntTarget,
  HuntTodayView as HuntTodayData,
  HuntWeekRow,
  TrophiesView as TrophiesData,
} from "./pool6";
import { CENSUS_URL } from "./pool6";

// The Hunt on the Doomsday pages (WEB-110, boards DS01HuntToday and DS02HuntMore, design/boards/doomsday-hunt): the
// Hunt card, "The Hunt today" with tomorrow's quarry, the board's Hunt column, the PvP tab's
// trophies and "Hunt · this week", and the six Hunt feats. The facts are WEB-108's (src/core/views/pool6.ts, from
// src/server/hunt.ts `doomsdayHunt`); this turns them into text. Census numbers are Everloot's sample ("seen this
// week"), always with its link and dates; without a census they don't show.

/** What the Doomsday pages get of the Hunt (WEB-108's `DoomsdayHuntData`). */
export interface HuntPageData {
  hunt: HuntTodayData;
  friends: FriendHuntView[];
  week: HuntWeekRow[];
}

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

/** A census number with its source: Everloot's census (CC BY-SA 4.0), linked in the ⓘ next to it, and its window. */
export interface SeenView {
  /** "230". */
  count: string;
  href: string;
  /** "13–19 Nov": the census's 7 days. */
  window: string;
}

/** The Hunt card in Your goals (DS01). */
export interface HuntCardView {
  quarry: QuarryView;
  /** "+5 PvP". */
  worth: string;
  /** Open, with a census: "230" seen this week. */
  seen?: SeenView;
  /** After the linked "Everloot census: ": "Night Elf Hunters seen in the last 7 days (13–19 Nov). More seen = …". */
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
      /** Seen fewer than 60 this week: the blue ring. */
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
  classes: { classFile: string; name: string }[];
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

/** How many friends "The Hunt today" lists before "+ N more" (board DS01HuntToday). */
const TODAY_FRIENDS = 4;

/** The board tab with its Hunt column ("+ N more"). */
export const BOARD_HUNT_HREF = "/doomsday/board#hunt";

/** The trophy grid's columns: the 9 classes in the game's order (boards DS02HuntMore, MP06Hunt). */
const CLASS_ORDER = [
  ["WARRIOR", "Warrior"],
  ["PALADIN", "Paladin"],
  ["HUNTER", "Hunter"],
  ["ROGUE", "Rogue"],
  ["PRIEST", "Priest"],
  ["SHAMAN", "Shaman"],
  ["MAGE", "Mage"],
  ["WARLOCK", "Warlock"],
  ["DRUID", "Druid"],
] as const;

/** The race ring's letters: the initials of a two-word race ("NE"), else its first two letters ("Gn"). */
export function raceShort(name: string): string {
  const words = name.split(" ").filter((w) => w !== "");
  if (words.length > 1) return words.map((w) => w[0]!.toUpperCase()).join("");
  return name.slice(0, 2);
}

export function quarryView(t: HuntTarget): QuarryView {
  return {
    key: t.key,
    name: t.name,
    raceName: t.race,
    raceShort: raceShort(t.race),
    classFile: t.classFile,
    className: t.className,
  };
}

function dayMonth(at: number, timeZone: string): { day: string; month: string; weekday: string } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "numeric" })
    .formatToParts(new Date(at * 1000))
    .reduce<Record<string, string>>((acc, x) => ({ ...acc, [x.type]: x.value }), {});
  return {
    day: String(Number(p.day)),
    month: MONTH_SHORT[Number(p.month) - 1] ?? "",
    weekday: WEEKDAY_SHORT[WEEKDAY_SHORT.indexOf(p.weekday ?? "")] ?? p.weekday ?? "",
  };
}

/** "4–10 Nov", "28 Oct–3 Nov": the census's 7-day window in the zone (Everloot's own when it names one). */
export function censusWindow(c: CensusInfo, timeZone: string): string {
  const to = c.to ?? c.asOf;
  const from = dayMonth(c.from ?? to - 6 * 86400, timeZone);
  const end = dayMonth(to, timeZone);
  return from.month === end.month
    ? `${from.day}–${end.day} ${end.month}`
    : `${from.day} ${from.month}–${end.day} ${end.month}`;
}

function seenOf(n: number | undefined, census: CensusInfo | undefined, timeZone: string): SeenView | undefined {
  if (n === undefined || census === undefined) return undefined;
  return { count: n.toLocaleString("en-GB"), href: census.url ?? CENSUS_URL, window: censusWindow(census, timeZone) };
}

function friendOf(data: HuntPageData | undefined, key: string): FriendHuntView | undefined {
  return data?.friends.find((f) => f.owner === key);
}

/** "21:02 in Ashenvale" / "21:02"; undefined for a kill without its time (an older addon). */
function when(k: HuntKill, s: DoomsdaySnapshot, timeZone: string, sep: string): string | undefined {
  if (k.at === undefined) return undefined;
  const time = clockAt(k.at, s.schedule.dayStart, timeZone);
  return k.zone === undefined ? time : `${time}${sep}${k.zone}`;
}

/**
 * The Hunt card of a Hunt goal on Today: its column ("hunt:alliance") names the hunted faction. Done: when and where
 * the viewer bagged it, the zone when the addon sent one.
 */
export function huntCard(
  s: DoomsdaySnapshot,
  data: HuntPageData | undefined,
  viewerKey: string,
  goal: { columnId: string; points: number; doneAt?: number },
  timeZone: string,
): HuntCardView | undefined {
  const hunted: Faction = goal.columnId === "hunt:horde" ? "Horde" : "Alliance";
  const q = data?.hunt.quarry[hunted];
  if (q === undefined) return undefined;
  const quarry = quarryView(q.target);
  const card: HuntCardView = { quarry, worth: `+${goal.points} PvP` };
  const kill = friendOf(data, viewerKey)?.todayKill;
  const doneAt = kill?.at ?? goal.doneAt;
  if (goal.doneAt !== undefined || kill !== undefined) {
    const time = doneAt === undefined ? undefined : clockAt(doneAt, s.schedule.dayStart, timeZone);
    card.bagged = [
      time === undefined ? "bagged" : `bagged at ${time}`,
      kill?.zone === undefined ? undefined : `in ${kill.zone}`,
    ]
      .filter((x) => x !== undefined)
      .join(" ");
    return card;
  }
  const seen = seenOf(q.seen, q.census, timeZone);
  if (seen !== undefined) {
    card.seen = seen;
    card.seenTip = `${quarry.name}s seen in the last 7 days (${seen.window}). More seen = easier to find.`;
  }
  return card;
}

/** "The Hunt today": friends with Doomsday data, those who bagged one first; the viewer's faction decides tomorrow. */
export function huntToday(
  s: DoomsdaySnapshot,
  data: HuntPageData,
  viewerKey: string | undefined,
  timeZone: string,
): HuntTodayView {
  const active = new Map(s.friends.filter((f) => f.status === "active").map((f) => [f.friendKey, f]));
  const rows = data.hunt.friends.flatMap((h) => {
    const f = active.get(h.owner);
    if (f === undefined) return [];
    const done = friendOf(data, h.owner)?.todayDone === true;
    return [{ f, kill: h.kill, done }];
  });
  const bagged = rows.filter((r) => r.done).length;
  const view: HuntTodayView = {
    count: `${bagged} of ${rows.length} bagged one`,
    friends: rows.slice(0, TODAY_FRIENDS).map(({ f, kill, done }) => {
      const row: HuntTodayView["friends"][number] = {
        key: f.friendKey,
        name: f.name,
        bagged: done,
        text: !done ? "—" : ((kill === undefined ? undefined : when(kill, s, timeZone, " · ")) ?? "bagged"),
      };
      if (f.classFile !== undefined) row.classFile = f.classFile;
      return row;
    }),
  };
  if (rows.length > TODAY_FRIENDS) view.more = { text: `+ ${rows.length - TODAY_FRIENDS} more`, href: BOARD_HUNT_HREF };
  const hunted = viewerKey === undefined ? undefined : friendOf(data, viewerKey)?.hunts[0];
  const tomorrow = data.hunt.tomorrow[hunted ?? "Alliance"];
  if (tomorrow !== undefined) view.tomorrow = quarryView(tomorrow);
  return view;
}

/** The board's Hunt column: the quarry of a hunted faction. */
export function boardQuarry(data: HuntPageData | undefined, hunted: Faction): QuarryView | undefined {
  const q = data?.hunt.quarry[hunted];
  return q === undefined ? undefined : quarryView(q.target);
}

/** A bagged cell's hover on the board: "Bagged 20:14 in Ashenvale". */
export function boardHuntTitle(
  s: DoomsdaySnapshot,
  data: HuntPageData | undefined,
  f: FriendDoomsday,
  timeZone: string,
): string | undefined {
  const k = friendOf(data, f.friendKey)?.todayKill;
  const at = k === undefined ? undefined : when(k, s, timeZone, " in ");
  return at === undefined ? undefined : `Bagged ${at}`;
}

/** "Tue" within the last week, else "2 Nov": a Doomsday day, by its start in the zone. */
function lastDay(day: number, s: DoomsdaySnapshot, timeZone: string): string {
  const start = s.schedule.dayStart - (s.schedule.day - day) * 86400;
  const d = dayMonth(start, timeZone);
  return s.schedule.day - day < 6 ? d.weekday : `${d.day} ${d.month}`;
}

/** The PvP tab's trophy collection of one friend (DS02): the other faction's valid targets, gold where bagged. */
export function huntTrophies(
  s: DoomsdaySnapshot,
  f: FriendDoomsday,
  view: TrophiesData,
  timeZone: string,
): TrophiesView {
  const out: TrophiesView = {
    title: `Hunt trophies · ${f.name}`,
    summary: `${view.distinct} of ${view.total} · ${view.quarries} ${view.quarries === 1 ? "quarry" : "quarries"}`,
    percent: view.total === 0 ? 0 : Math.round((view.distinct / view.total) * 100),
    classes: CLASS_ORDER.map(([classFile, name]) => ({ classFile, name })),
    rows: view.races.map((r) => ({
      race: r.raceId,
      name: r.race,
      cells: CLASS_ORDER.map(([classFile]): TrophyCell => {
        const c = r.cells.find((x) => x.classFile === classFile);
        if (c === undefined) return { kind: "na" };
        const label = [
          c.name,
          c.count > 0 ? `bagged ${c.count}×` : undefined,
          c.count > 0 && c.last !== undefined ? `last ${lastDay(c.last, s, timeZone)}` : undefined,
          c.seen !== undefined ? `${c.seen.toLocaleString("en-GB")} seen this week` : undefined,
        ]
          .filter((x) => x !== undefined)
          .join(" · ");
        return { kind: "target", key: c.key, count: c.count, rare: c.scarce, label };
      }),
    })),
  };
  const seen = view.rarest === undefined ? undefined : seenOf(view.rarest.seen, view.census, timeZone);
  if (view.rarest !== undefined && seen !== undefined) out.rarest = { name: view.rarest.target.name, seen };
  return out;
}

/** "Hunt · this week": friends ranked by days with the quarry bagged this week (none: not listed). */
export function huntWeek(s: DoomsdaySnapshot, data: HuntPageData): HuntWeekView {
  const active = new Map(s.friends.filter((f) => f.status === "active").map((f) => [f.friendKey, f]));
  const rows = data.week.flatMap((w) => {
    const f = active.get(w.owner);
    return f === undefined ? [] : [{ f, days: w.days }];
  });
  return {
    rows: rows.map(({ f, days }, i) => {
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

/** The six Hunt feats of a friend with their progress (DS02; WEB-108's ids and names). */
export function huntFeats(f: FriendHuntView): HuntFeatView[] {
  return f.feats.map((p) => {
    // The board names the other faction: "Bag every Alliance class".
    const text = p.id === "f.huntClasses" ? `Bag every ${f.hunts[0] ?? "Alliance"} class` : p.text;
    const view: HuntFeatView = { id: p.id, title: p.name.replace("'", "’"), text, done: p.done };
    if (!p.done) {
      view.progress = {
        text: `${p.value} / ${p.target}`,
        percent: p.target === 0 ? 0 : Math.round((p.value / p.target) * 100),
      };
    }
    return view;
  });
}

/** The Hunt data of one friend (the PvP and Feats tabs' picked friend). */
export function friendHunt(data: HuntPageData | undefined, key: string | undefined): FriendHuntView | undefined {
  return key === undefined ? undefined : friendOf(data, key);
}
