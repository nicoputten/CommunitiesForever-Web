import { RUNNABLE_DUNGEONS } from "../gamedata/dungeons";
import {
  activeDays,
  best,
  byFriend,
  charName,
  friendName,
  friendsByZone,
  levelGains,
  levelOf,
  MAX_LEVEL,
  newCharacters,
  ordinal,
  professionGains,
  relative,
  runs,
  second,
  WEEKDAY_NAMES,
  weekdayOfDay,
  zonesByFriend,
} from "./facts";
import { v2Cards } from "./cardsV2";
import type { Candidate, CardDef, History, RecapChar, Week } from "./types";

// The recap's card catalogue (WEB-41, the `bot-recap` board; WEB-57's new cards in cardsV2.ts). Later (Nico,
// 2026-10-27): F5 Road trip, which needs data the addon doesn't record. Each card finds its best example in the week, or nothing when the week doesn't
// meet its threshold. The score is the card's value against its average in earlier weeks, times a weight for how
// much the card is worth showing.

const DAY = 86400;
/** Crafting professions for the gap cards (gathering ones always have someone). */
const CRAFTING = ["Alchemy", "Blacksmithing", "Enchanting", "Engineering", "Leatherworking", "Tailoring"];

function pastValues(history: History, id: string): number[] {
  return history.weeks.map((w) => w.values[id]).filter((v): v is number => v !== undefined);
}

/** A candidate scored against the card's earlier weeks. */
function found(
  history: History,
  id: string,
  value: number,
  facts: Candidate["facts"],
  friends: string[],
  weight = 1,
): Candidate {
  return { score: weight * relative(value, pastValues(history, id)), value, facts, friends };
}

const owner = (week: Week, guid: string) => week.after[guid]?.owner ?? week.before[guid]?.owner ?? "";
const chars = (week: Week) => Object.values(week.after);

function counted<T>(items: Iterable<T>): Map<T, number> {
  const m = new Map<T, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
}

// --- awards: the <site name> of the week ---------------------------------------------------------------------------

function award(
  id: string,
  name: string,
  measure: (week: Week, history: History) => Map<string, number>,
  min: number,
  unit: (n: number) => string,
): CardDef {
  return {
    id,
    slot: "award",
    name,
    find(week, history) {
      const m = measure(week, history);
      const top = best(m);
      if (top === undefined || top[1] < min) return undefined;
      const facts: Candidate["facts"] = { friend: friendName(week, top[0]), amount: unit(top[1]), value: top[1] };
      const runner = second(m, top[0]);
      if (runner !== undefined && runner[1] > 0) {
        facts.runnerUp = friendName(week, runner[0]);
        facts.runnerUpAmount = unit(runner[1]);
      }
      return found(history, id, top[1], facts, [top[0]]);
    },
  };
}

const plural = (one: string, many: string) => (n: number) => `${n} ${n === 1 ? one : many}`;

const AWARDS: CardDef[] = [
  award("A1", "The Grinder", (w) => byFriend(w, levelGains(w)), 2, plural("level", "levels")),
  award(
    "A2",
    "Tourist",
    (w) => new Map([...zonesByFriend(w)].map(([f, z]) => [f, z.size])),
    3,
    plural("zone", "zones"),
  ),
  award(
    "A3",
    "Altoholic",
    (w) => {
      const played = new Map<string, Set<string>>();
      for (const d of w.days) (played.get(d.owner) ?? played.set(d.owner, new Set()).get(d.owner)!).add(d.guid);
      for (const guid of levelGains(w).keys()) {
        const o = owner(w, guid);
        (played.get(o) ?? played.set(o, new Set()).get(o)!).add(guid);
      }
      return new Map([...played].map(([f, g]) => [f, g.size]));
    },
    2,
    plural("character", "characters"),
  ),
  award("A4", "Crafter of the week", (w) => byFriend(w, professionGains(w)), 10, plural("skill point", "skill points")),
  award(
    "A5",
    "Quest machine",
    (w) => {
      const m = new Map<string, number>();
      for (const d of w.days) {
        const n = Object.values(d.entry.quests).reduce((a, b) => a + b, 0);
        if (n > 0) m.set(d.owner, (m.get(d.owner) ?? 0) + n);
      }
      return m;
    },
    5,
    plural("quest", "quests"),
  ),
  award(
    "A6",
    "Dungeon diver",
    (w) =>
      counted(
        runs(w)
          .filter((r) => r.kind === "party" || r.kind === "raid")
          .map((r) => r.owner),
      ),
    2,
    plural("dungeon run", "dungeon runs"),
  ),
  {
    id: "A8",
    slot: "award",
    name: "The Comeback",
    find(week, history) {
      const back = new Map<string, number>();
      for (const friend of week.friends) {
        const last = week.lastActiveBefore[friend.key];
        if (last === undefined) continue;
        const away = Math.floor((week.start - last) / DAY);
        if (away >= 14) back.set(friend.key, away);
      }
      for (const key of [...back.keys()]) if (!friendsPlayedThisWeek(week).has(key)) back.delete(key);
      const top = best(back);
      if (top === undefined) return undefined;
      return found(history, "A8", top[1], { friend: friendName(week, top[0]), days: top[1] }, [top[0]], 0.8);
    },
  },
  award(
    "A9",
    "Most improved",
    (w) => {
      const m = new Map<string, number>();
      for (const c of chars(w)) {
        const before = w.before[c.guid]?.ilvl;
        if (before !== undefined && c.ilvl !== undefined && c.ilvl > before) {
          m.set(c.owner, Math.max(m.get(c.owner) ?? 0, c.ilvl - before));
        }
      }
      return m;
    },
    5,
    plural("item level", "item levels"),
  ),
  {
    id: "A10",
    slot: "award",
    name: "Hall of fame",
    find(week, history) {
      if (week.number % 10 !== 0) return undefined;
      const season = new Map<string, number>();
      for (const past of history.weeks.filter((p) => p.number > week.number - 10)) {
        for (const [f, n] of Object.entries(past.levelsByFriend)) season.set(f, (season.get(f) ?? 0) + n);
      }
      for (const [f, n] of byFriend(week, levelGains(week))) season.set(f, (season.get(f) ?? 0) + n);
      const top = best(season);
      if (top === undefined) return undefined;
      // The season finale always wins its week.
      return {
        score: 1000,
        value: top[1],
        facts: { friend: friendName(week, top[0]), amount: `${top[1]} levels`, weeks: 10 },
        friends: [top[0]],
      };
    },
  },
];

function friendsPlayedThisWeek(week: Week): Set<string> {
  const out = new Set<string>();
  for (const d of week.days) out.add(d.owner);
  for (const g of levelGains(week).keys()) out.add(owner(week, g));
  for (const s of week.sightings) out.add(owner(week, s.guid));
  out.delete("");
  return out;
}

// --- stats ---------------------------------------------------------------------------------------------------------

const STATS: CardDef[] = [
  {
    id: "S1",
    slot: "stat",
    name: "Zone of the week",
    find(week, history) {
      const zones = new Map([...friendsByZone(week)].map(([z, f]) => [z, f.size]));
      const top = best(zones);
      if (top === undefined || top[1] < 2) return undefined;
      return found(history, "S1", top[1], { zone: top[0], friends: top[1] }, [], 1.2);
    },
  },
  {
    id: "S2",
    slot: "stat",
    name: "Class census",
    find(week, history) {
      const classes = counted(chars(week).map((c) => c.classFile ?? ""));
      classes.delete("");
      const fresh = newCharacters(week)
        .map((g) => week.after[g]?.classFile)
        .filter((c): c is string => !!c);
      const top = best(classes);
      if (top === undefined || classes.size < 3) return undefined;
      const grew = best(counted(fresh));
      return found(
        history,
        "S2",
        classes.size,
        {
          topClass: classLabel(top[0]),
          topCount: top[1],
          classes: classes.size,
          grew: grew ? classLabel(grew[0]) : "",
        },
        [],
        grew ? 0.9 : 0.5,
      );
    },
  },
  {
    id: "S3",
    slot: "stat",
    name: "Faction split",
    find(week, history) {
      const f = counted(chars(week).map((c) => c.faction ?? ""));
      const horde = f.get("Horde") ?? 0;
      const alliance = f.get("Alliance") ?? 0;
      if (horde === 0 || alliance === 0) return undefined;
      return found(history, "S3", Math.abs(horde - alliance) + 1, { horde, alliance }, [], 0.5);
    },
  },
  {
    id: "S4",
    slot: "stat",
    name: "Level sum",
    find(week, history) {
      const total = chars(week).reduce((a, c) => a + levelOf(c), 0);
      const gained = [...levelGains(week).values()].reduce((a, b) => a + b, 0);
      if (gained < 1) return undefined;
      return found(history, "S4", gained, { total, gained }, [], 0.7);
    },
  },
  {
    id: "S5",
    slot: "stat",
    name: "Map coverage",
    find(week, history) {
      const before = new Set(week.zonesBefore);
      const now = new Set([...before, ...week.sightings.map((s) => s.zone)]);
      const added = now.size - before.size;
      if (added < 1) return undefined;
      return found(history, "S5", added, { seen: now.size, total: week.totalZones, added }, [], 0.9);
    },
  },
  {
    id: "S6",
    slot: "stat",
    name: "Talent fashion",
    find(week, history) {
      const specs = counted(
        chars(week)
          .filter((c) => c.spec && c.classFile)
          .map((c) => `${c.spec} ${classLabel(c.classFile!)}`),
      );
      const top = best(specs);
      if (top === undefined || top[1] < 2) return undefined;
      return found(history, "S6", top[1], { spec: top[0], count: top[1] }, [], 0.6);
    },
  },
  {
    id: "S7",
    slot: "stat",
    name: "Busiest evening",
    find(week, history) {
      const perDay = new Map<number, Set<string>>();
      for (const d of week.days) (perDay.get(d.day) ?? perDay.set(d.day, new Set()).get(d.day)!).add(d.owner);
      const byWeekday = new Map<string, number>();
      for (const [day, friends] of perDay) {
        const name = WEEKDAY_NAMES[weekdayOfDay(day)]!;
        byWeekday.set(name, Math.max(byWeekday.get(name) ?? 0, friends.size));
      }
      const top = best(byWeekday);
      if (top === undefined || top[1] < 3) return undefined;
      return found(history, "S7", top[1], { weekday: top[0], friends: top[1] }, [], 0.8);
    },
  },
  {
    id: "S8",
    slot: "stat",
    name: "Top dungeon",
    find(week, history) {
      const top = best(
        counted(
          runs(week)
            .filter((r) => r.kind === "party" && r.name)
            .map((r) => r.name!),
        ),
      );
      if (top === undefined || top[1] < 2) return undefined;
      return found(history, "S8", top[1], { dungeon: top[0], runs: top[1] }, [], 1);
    },
  },
  {
    id: "S9",
    slot: "stat",
    name: "Healer / tank census",
    find(week, history) {
      const roles = counted(chars(week).map((c) => c.role ?? ""));
      const tanks = roles.get("tank") ?? 0;
      const healers = roles.get("heal") ?? 0;
      if (tanks + healers === 0) return undefined;
      const before = counted(Object.values(week.before).map((c) => c.role ?? ""));
      const changed = tanks !== (before.get("tank") ?? 0) || healers !== (before.get("heal") ?? 0);
      return found(history, "S9", tanks + healers, { tanks, healers }, [], changed ? 0.8 : 0.4);
    },
  },
  {
    id: "S10",
    slot: "stat",
    name: "Quest log hoarder",
    find(week, history) {
      const top = best(new Map(chars(week).map((c) => [c.guid, c.quests.length])));
      if (top === undefined || top[1] < 15) return undefined;
      return found(
        history,
        "S10",
        top[1],
        { character: charName(week, top[0]), quests: top[1] },
        [owner(week, top[0])],
        0.7,
      );
    },
  },
  {
    id: "S12",
    slot: "stat",
    name: "Season stats",
    find(week, history) {
      if (week.number % 10 !== 0) return undefined;
      const season = history.weeks.filter((p) => p.number > week.number - 10);
      const levels =
        season.reduce((a, p) => a + Object.values(p.levelsByFriend).reduce((x, y) => x + y, 0), 0) +
        [...levelGains(week).values()].reduce((a, b) => a + b, 0);
      return { score: 100, value: levels, facts: { levels, weeks: 10 }, friends: [] };
    },
  },
];

// --- progress ------------------------------------------------------------------------------------------------------

const PROGRESS: CardDef[] = [
  {
    id: "P1",
    slot: "progress",
    name: "Race to 60",
    find(week, history) {
      const gains = levelGains(week);
      if (![...gains.keys()].some((g) => levelOf(week.after[g]) < MAX_LEVEL || levelOf(week.before[g]) < MAX_LEVEL))
        return undefined;
      const top = chars(week)
        .filter((c) => levelOf(c) > 0)
        .sort((a, b) => levelOf(b) - levelOf(a) || a.name.localeCompare(b.name))
        .slice(0, 3);
      if (top.length < 3) return undefined;
      const facts: Candidate["facts"] = {};
      top.forEach((c, i) => {
        facts[`name${i + 1}`] = c.name;
        facts[`level${i + 1}`] = levelOf(c);
      });
      return found(
        history,
        "P1",
        levelOf(top[0]),
        facts,
        top.map((c) => c.owner),
        0.8,
      );
    },
  },
  {
    id: "P2",
    slot: "progress",
    name: "Prediction",
    find(week, history) {
      const p = prediction(week);
      if (p === undefined) return undefined;
      return found(
        history,
        "P2",
        p.gained,
        { character: p.name, weeks: p.weeks, level: p.level },
        [owner(week, p.guid)],
        0.8,
      );
    },
  },
  {
    id: "P3",
    slot: "progress",
    name: "Prediction check",
    find(week, history) {
      const then = history.weeks.find((w) => w.number === week.number - 4)?.prediction;
      if (then === undefined) return undefined;
      const now = levelOf(week.after[then.guid]);
      const right = then.weeks <= 4 ? now >= MAX_LEVEL : now > then.level;
      return found(
        history,
        "P3",
        1,
        { character: then.name, predicted: then.weeks, level: now, right: right ? "yes" : "no" },
        [owner(week, then.guid)],
        1.1,
      );
    },
  },
  {
    id: "P4",
    slot: "progress",
    name: "Mount countdown",
    find(week, history) {
      const close = chars(week)
        .filter((c) => levelOf(c) >= 35 && levelOf(c) < 40)
        .sort((a, b) => levelOf(b) - levelOf(a) || a.name.localeCompare(b.name));
      if (close.length === 0) return undefined;
      const c = close[0]!;
      return found(
        history,
        "P4",
        levelOf(c),
        { character: c.name, level: levelOf(c), left: 40 - levelOf(c) },
        [c.owner],
        0.7,
      );
    },
  },
  crossed("P5", "Halfway club", 30, 0.9),
  crossed("P6", "Max-level club", MAX_LEVEL, 1.5),
  {
    id: "P7",
    slot: "progress",
    name: "Gap alert",
    find(week, history) {
      const bestRank = new Map(CRAFTING.map((p) => [p, 0]));
      const holder = new Map<string, string>();
      for (const c of chars(week)) {
        for (const p of c.professions) {
          if (!bestRank.has(p.name) || p.rank <= bestRank.get(p.name)!) continue;
          bestRank.set(p.name, p.rank);
          holder.set(p.name, c.guid);
        }
      }
      // Only once somebody crafts at all: an empty group has no gap worth a card.
      if (holder.size === 0) return undefined;
      const gaps = [...bestRank].filter(([, r]) => r < 175).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const gap = gaps[0];
      if (gap === undefined) return undefined;
      const closest = holder.get(gap[0]);
      return found(
        history,
        "P7",
        175 - gap[1],
        { profession: gap[0], best: gap[1], closest: closest ? charName(week, closest) : "" },
        closest ? [owner(week, closest)] : [],
        0.6,
      );
    },
  },
  {
    id: "P8",
    slot: "progress",
    name: "Gap closed",
    find(week, history) {
      for (const prof of CRAFTING) {
        const maxBefore = Math.max(
          0,
          ...Object.values(week.before).flatMap((c) => c.professions.filter((p) => p.name === prof).map((p) => p.rank)),
        );
        const top = chars(week)
          .flatMap((c) => c.professions.filter((p) => p.name === prof).map((p) => ({ c, rank: p.rank })))
          .sort((a, b) => b.rank - a.rank)[0];
        if (week.number > 1 && top && maxBefore < 175 && top.rank >= 175) {
          return found(
            history,
            "P8",
            1,
            { profession: prof, character: top.c.name, rank: top.rank },
            [top.c.owner],
            1.3,
          );
        }
      }
      return undefined;
    },
  },
  {
    id: "P9",
    slot: "progress",
    name: "Crafting race",
    find(week, history) {
      const gains = professionGains(week);
      let race: { prof: string; a: RecapChar; b: RecapChar; ra: number; rb: number } | undefined;
      for (const prof of CRAFTING) {
        const holders = chars(week)
          .filter((c) => c.owner && gains.has(c.guid))
          .flatMap((c) => c.professions.filter((p) => p.name === prof).map((p) => ({ c, rank: p.rank })))
          .sort((x, y) => y.rank - x.rank || x.c.name.localeCompare(y.c.name));
        for (let i = 0; i + 1 < holders.length; i++) {
          const [x, y] = [holders[i]!, holders[i + 1]!];
          if (x.c.owner !== y.c.owner && x.rank - y.rank <= 10 && (race === undefined || x.rank > race.ra)) {
            race = { prof, a: x.c, b: y.c, ra: x.rank, rb: y.rank };
          }
        }
      }
      if (race === undefined) return undefined;
      return found(
        history,
        "P9",
        race.ra,
        { profession: race.prof, first: race.a.name, firstRank: race.ra, second: race.b.name, secondRank: race.rb },
        [race.a.owner, race.b.owner],
        0.9,
      );
    },
  },
  {
    id: "P10",
    slot: "progress",
    name: "Profession completionist",
    find(week, history) {
      const done = (c: RecapChar | undefined) => {
        const primaries = (c?.professions ?? []).filter(
          (p) => p.name !== "Cooking" && p.name !== "First Aid" && p.name !== "Fishing",
        );
        return primaries.length === 2 && primaries.every((p) => p.max > 0 && p.rank >= p.max);
      };
      const c = chars(week)
        .filter((x) => done(x) && !done(week.before[x.guid]))
        .sort((a, b) => a.name.localeCompare(b.name))[0];
      if (c === undefined) return undefined;
      const [p1, p2] = c.professions.filter(
        (p) => p.name !== "Cooking" && p.name !== "First Aid" && p.name !== "Fishing",
      );
      return found(
        history,
        "P10",
        1,
        { character: c.name, first: p1!.name, second: p2!.name, rank: p1!.rank },
        [c.owner],
        1,
      );
    },
  },
  {
    id: "P11",
    slot: "progress",
    name: "Gear jump",
    find(week, history) {
      const jumps = new Map<string, number>();
      for (const c of chars(week)) {
        const before = week.before[c.guid]?.ilvl;
        if (before !== undefined && c.ilvl !== undefined) jumps.set(c.guid, c.ilvl - before);
      }
      const top = best(jumps);
      if (top === undefined || top[1] < 5) return undefined;
      return found(
        history,
        "P11",
        top[1],
        {
          character: charName(week, top[0]),
          from: week.before[top[0]]!.ilvl!,
          to: week.after[top[0]]!.ilvl!,
          gained: top[1],
        },
        [owner(week, top[0])],
        1,
      );
    },
  },
  {
    id: "P12",
    slot: "progress",
    name: "Then vs now",
    find(week, history) {
      const first = history.weeks.find((w) => w.number === 1)?.totals;
      if (first === undefined || week.number < 5) return undefined;
      const now = chars(week);
      const levelSum = now.reduce((a, c) => a + levelOf(c), 0);
      return found(
        history,
        "P12",
        levelSum - first.levelSum,
        {
          charactersThen: first.characters,
          charactersNow: now.length,
          levelsThen: first.levelSum,
          levelsNow: levelSum,
          at60Then: first.at60,
          at60Now: now.filter((c) => levelOf(c) >= MAX_LEVEL).length,
        },
        [],
        week.number % 10 === 0 ? 2 : 0.6,
      );
    },
  },
  {
    id: "P13",
    slot: "progress",
    name: "On this week last month",
    find(week, history) {
      const then = new Map<string, string>();
      for (const s of [...week.monthAgo].sort((a, b) => a.seenAt - b.seenAt)) then.set(s.guid, s.zone);
      const moved = [...then].filter(([g, z]) => week.lastSeen[g] !== undefined && week.lastSeen[g]!.zone !== z);
      if (moved.length < 2) return undefined;
      const [guid, zone] = moved.sort(([a], [b]) => charName(week, a).localeCompare(charName(week, b)))[0]!;
      return found(
        history,
        "P13",
        moved.length,
        { character: charName(week, guid), then: zone, now: week.lastSeen[guid]!.zone, moved: moved.length },
        [owner(week, guid)],
        0.7,
      );
    },
  },
];

function crossed(id: string, name: string, mark: number, weight: number): CardDef {
  return {
    id,
    slot: "progress",
    name,
    find(week, history) {
      const who = chars(week)
        .filter((c) => levelOf(c) >= mark && week.before[c.guid] !== undefined && levelOf(week.before[c.guid]) < mark)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (who.length === 0) return undefined;
      const club = chars(week).filter((c) => levelOf(c) >= mark).length;
      return found(
        history,
        id,
        who.length,
        { character: who[0]!.name, more: who.length - 1, club, nth: ordinal(club) },
        [who[0]!.owner],
        weight,
      );
    },
  };
}

/** The fastest climber below 60: weeks to 60 at this week's pace. */
export function prediction(
  week: Week,
): { guid: string; name: string; level: number; gained: number; weeks: number } | undefined {
  const gains = levelGains(week);
  const top = best(
    new Map([...gains].filter(([g]) => levelOf(week.after[g]) < MAX_LEVEL && week.before[g] !== undefined)),
  );
  if (top === undefined || top[1] < 2) return undefined;
  const level = levelOf(week.after[top[0]]);
  return {
    guid: top[0],
    name: charName(week, top[0]),
    level,
    gained: top[1],
    weeks: Math.ceil((MAX_LEVEL - level) / top[1]),
  };
}

// --- social & fun --------------------------------------------------------------------------------------------------

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

const SOCIAL: CardDef[] = [
  {
    id: "F1",
    slot: "social",
    name: "Duo of the week",
    find(week, history) {
      const pairs = new Map<string, number>();
      const evenings = new Map<string, Set<number>>();
      for (const r of runs(week)) {
        for (const guid of r.with) {
          const other = owner(week, guid);
          if (other === "" || other === r.owner) continue;
          const key = pairKey(r.owner, other);
          pairs.set(key, (pairs.get(key) ?? 0) + 1);
          (evenings.get(key) ?? evenings.set(key, new Set()).get(key)!).add(r.day);
        }
      }
      const top = best(pairs);
      if (top === undefined || top[1] < 2) return undefined;
      const [a, b] = top[0].split("\u0000") as [string, string];
      return found(
        history,
        "F1",
        top[1],
        { first: friendName(week, a), second: friendName(week, b), runs: top[1], evenings: evenings.get(top[0])!.size },
        [a, b],
        1.1,
      );
    },
  },
  {
    id: "F2",
    slot: "social",
    name: "Shared quest jackpot",
    find(week, history) {
      let jackpot: { a: RecapChar; b: RecapChar; n: number } | undefined;
      const list = chars(week).sort((x, y) => x.guid.localeCompare(y.guid));
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const [a, b] = [list[i]!, list[j]!];
          if (a.owner === b.owner) continue;
          const shared = a.quests.filter((q) => b.quests.includes(q)).length;
          if (shared >= 5 && (jackpot === undefined || shared > jackpot.n)) jackpot = { a, b, n: shared };
        }
      }
      if (jackpot === undefined) return undefined;
      return found(
        history,
        "F2",
        jackpot.n,
        { first: jackpot.a.name, second: jackpot.b.name, quests: jackpot.n },
        [jackpot.a.owner, jackpot.b.owner],
        0.9,
      );
    },
  },
  {
    id: "F3",
    slot: "social",
    name: "Ghost town",
    find(week, history) {
      const away = new Map<string, number>();
      for (const [guid, s] of Object.entries(week.lastSeen)) {
        if (week.after[guid] === undefined) continue;
        const days = Math.floor((week.end - s.seenAt) / DAY);
        if (days >= 14) away.set(guid, days);
      }
      const top = best(away);
      if (top === undefined) return undefined;
      return found(
        history,
        "F3",
        top[1],
        { character: charName(week, top[0]), zone: week.lastSeen[top[0]]!.zone, days: top[1] },
        [owner(week, top[0])],
        0.8,
      );
    },
  },
  {
    id: "F13",
    slot: "social",
    name: "Group suggestion",
    find(week, history) {
      const g = groupFit(week);
      if (g === undefined) return undefined;
      return found(
        history,
        "F13",
        g.names.length,
        { dungeon: g.dungeon, names: g.names.join(", "), count: g.names.length },
        g.friends,
        0.8,
      );
    },
  },
];

/** The dungeon most friends have a character in range for (one character per friend), at least 3. */
export function groupFit(week: Week): { dungeon: string; names: string[]; friends: string[] } | undefined {
  let top: { dungeon: string; names: string[]; friends: string[] } | undefined;
  for (const d of RUNNABLE_DUNGEONS) {
    const perFriend = new Map<string, RecapChar>();
    for (const c of chars(week).sort((a, b) => levelOf(b) - levelOf(a) || a.name.localeCompare(b.name))) {
      const l = levelOf(c);
      if (l >= d.typicalLevels.min && l <= d.typicalLevels.max && !perFriend.has(c.owner)) perFriend.set(c.owner, c);
    }
    if (perFriend.size >= 3 && (top === undefined || perFriend.size > top.names.length)) {
      const fits = [...perFriend.values()].sort((a, b) => a.name.localeCompare(b.name));
      top = { dungeon: d.name, names: fits.map((c) => c.name), friends: fits.map((c) => c.owner) };
    }
  }
  return top;
}

const FUN: CardDef[] = [
  {
    id: "F4",
    slot: "fun",
    name: "First footsteps",
    find(week, history) {
      const before = new Set(week.zonesBefore);
      if (before.size === 0) return undefined;
      const first = [...week.sightings]
        .filter((s) => !before.has(s.zone) && week.after[s.guid] !== undefined)
        .sort((a, b) => a.seenAt - b.seenAt)[0];
      if (first === undefined) return undefined;
      return found(
        history,
        "F4",
        1,
        {
          zone: first.zone,
          character: charName(week, first.guid),
          weekday: WEEKDAY_NAMES[new Date(first.seenAt * 1000).getUTCDay()]!,
          seen: new Set([...before, ...week.sightings.map((s) => s.zone)]).size,
          total: week.totalZones,
        },
        [owner(week, first.guid)],
        1.2,
      );
    },
  },
  {
    id: "F6",
    slot: "fun",
    name: "Homebody",
    find(week, history) {
      const zones = new Map<string, Set<string>>();
      const count = new Map<string, number>();
      for (const s of week.sightings) {
        (zones.get(s.guid) ?? zones.set(s.guid, new Set()).get(s.guid)!).add(s.zone);
        count.set(s.guid, (count.get(s.guid) ?? 0) + 1);
      }
      const homebodies = new Map(
        [...count].filter(([g, n]) => n >= 3 && zones.get(g)!.size === 1 && week.after[g] !== undefined),
      );
      const top = best(homebodies);
      if (top === undefined) return undefined;
      return found(
        history,
        "F6",
        top[1],
        { character: charName(week, top[0]), zone: [...zones.get(top[0])!][0]! },
        [owner(week, top[0])],
        0.7,
      );
    },
  },
  {
    id: "F9",
    slot: "fun",
    name: "Most loyal alt",
    find(week, history) {
      const top = best(activeDays(week).perChar);
      if (top === undefined || top[1] < 4) return undefined;
      return found(
        history,
        "F9",
        top[1],
        { character: charName(week, top[0]), days: top[1] },
        [owner(week, top[0])],
        0.7,
      );
    },
  },
  {
    id: "F10",
    slot: "fun",
    name: "Longest streak",
    find(week, history) {
      const streaks = new Map<string, number>();
      for (const [friend, days] of activeDays(week).perFriendDays) {
        const sorted = [...days].sort((a, b) => a - b);
        let run = 1;
        let longest = 1;
        for (let i = 1; i < sorted.length; i++) {
          run = sorted[i] === sorted[i - 1]! + 1 ? run + 1 : 1;
          longest = Math.max(longest, run);
        }
        streaks.set(friend, longest);
      }
      const top = best(streaks);
      if (top === undefined || top[1] < 3) return undefined;
      return found(history, "F10", top[1], { friend: friendName(week, top[0]), days: top[1] }, [top[0]], 0.8);
    },
  },
  {
    id: "F11",
    slot: "fun",
    name: "Fresh face",
    find(week, history) {
      const fresh = newCharacters(week)
        .map((g) => week.after[g]!)
        .sort((a, b) => levelOf(b) - levelOf(a) || a.name.localeCompare(b.name))[0];
      if (fresh === undefined) return undefined;
      return found(
        history,
        "F11",
        1,
        {
          character: fresh.name,
          friend: friendName(week, fresh.owner),
          level: levelOf(fresh),
          class: fresh.classFile ? classLabel(fresh.classFile) : "character",
          race: fresh.race ?? "",
        },
        [fresh.owner],
        1,
      );
    },
  },
  {
    id: "F12",
    slot: "fun",
    name: "Who am I?",
    find(week, history) {
      const pool = chars(week)
        .filter((c) => c.classFile && c.race && levelOf(c) > 0)
        .sort((a, b) => a.guid.localeCompare(b.guid));
      if (pool.length < 3) return undefined;
      const c = pool[week.number % pool.length]!;
      const zone = week.lastSeen[c.guid]?.zone;
      const prof = [...c.professions].sort((a, b) => b.rank - a.rank)[0]?.name;
      // The riddle: clues from what the site knows, the answer in a Discord spoiler.
      const clues = [
        `A ${c.race!} ${classLabel(c.classFile!)}.`,
        `Somewhere in the ${Math.floor(levelOf(c) / 10) * 10}s.`,
        ...(prof !== undefined ? [`Knows ${prof}.`] : []),
        ...(zone !== undefined ? [`Last seen in ${zone}.`] : []),
      ];
      const facts: Candidate["facts"] = { character: c.name, riddle: clues.join(" ") };
      return found(history, "F12", 1, facts, [c.owner], 0.5);
    },
  },
];

/** "Warlock" from "WARLOCK". */
export function classLabel(classFile: string): string {
  return classFile.charAt(0) + classFile.slice(1).toLowerCase();
}

const V2 = v2Cards({ found, owner });

export const CARDS: readonly CardDef[] = [
  ...AWARDS,
  ...V2.awards,
  ...STATS,
  ...V2.stats,
  ...PROGRESS,
  ...V2.progress,
  ...SOCIAL,
  ...V2.social,
  ...FUN,
  ...V2.fun,
];

/** The cards that wait for data the addon doesn't record (Nico, 2026-10-27); A7, S11, F7 and F8 came with WEB-57. */
export const LATER = ["F5"] as const;
