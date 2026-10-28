import type { FeedDay } from "../feed";
import { best, charName, friendName, levelGains, second, WEEKDAY_NAMES, weekdayOfDay } from "./facts";
import type { Candidate, CardDef, History, Week } from "./types";

// Recap v2 (WEB-57; the bot repo's boards `bot-recap-v2`, `bot-recap-v2-cards`): the cards that read the addon's new
// feed fields (CF-52 kills, deaths and duels, CF-53 loot, gold, sessions and groups) and the PvP rank. The thresholds
// are the designer's "Shows when" (Nico, 2026-10-29). A card finds nothing without its data: a week without those
// fields (an older addon) shows none of them. Gold is never shown as an amount.

const HOUR = 3600;
/** Big spender: gold spent in one realm day, in copper (50 gold; Nico, 2026-10-29). */
export const BIG_SPEND = 50 * 100 * 100;

type Found = (
  history: History,
  id: string,
  value: number,
  facts: Candidate["facts"],
  friends: string[],
  weight?: number,
) => Candidate;

export interface V2Helpers {
  found: Found;
  owner: (week: Week, guid: string) => string;
}

const plural = (one: string, many: string) => (n: number) => `${n} ${n === 1 ? one : many}`;

function add<K>(m: Map<K, number>, k: K, n = 1) {
  m.set(k, (m.get(k) ?? 0) + n);
}

/** The week's feed days with a field (CF-52 or CF-53) present. */
function daysWith(week: Week, field: keyof FeedDay) {
  return week.days.filter((d) => d.entry[field] !== undefined);
}

/** The hour and minute of a moment in a time zone ("03:12"), and the hour as a number. */
function localTime(at: number, timeZone: string | undefined): { hour: number; text: string } {
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone ?? "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(at * 1000));
  return { hour: Number(text.slice(0, 2)), text };
}

export function v2Cards({ found, owner }: V2Helpers): {
  awards: CardDef[];
  stats: CardDef[];
  progress: CardDef[];
  social: CardDef[];
  fun: CardDef[];
} {
  /** An award on a per-friend measure: the most, at least `min`. */
  const award = (
    id: string,
    name: string,
    measure: (week: Week) => Map<string, number> | undefined,
    min: number,
    unit: (n: number, week: Week, friend: string) => string,
  ): CardDef => ({
    id,
    slot: "award",
    name,
    find(week, history) {
      const m = measure(week);
      if (m === undefined) return undefined;
      const top = best(m);
      if (top === undefined || top[1] < min) return undefined;
      const facts: Candidate["facts"] = {
        friend: friendName(week, top[0]),
        amount: unit(top[1], week, top[0]),
        value: top[1],
      };
      const runner = second(m, top[0]);
      if (runner !== undefined && runner[1] > 0) {
        facts.runnerUp = friendName(week, runner[0]);
        facts.runnerUpAmount = unit(runner[1], week, runner[0]);
      }
      return found(history, id, top[1], facts, [top[0]]);
    },
  });

  const killsByFriend = (week: Week) => {
    const days = daysWith(week, "kills");
    if (days.length === 0) return undefined;
    const m = new Map<string, number>();
    for (const d of days)
      add(
        m,
        d.owner,
        Object.values(d.entry.kills!).reduce((a, b) => a + b, 0),
      );
    return m;
  };

  const bgRuns = (week: Week) =>
    week.days.flatMap((d) =>
      d.entry.runs.filter((r) => r.kind === "pvp").map((r) => ({ ...r, owner: d.owner, day: d.day })),
    );

  /** The friends each friend grouped with per day (CF-53 `groups`: community characters). */
  const groupsByDay = (week: Week) => {
    const out = new Map<number, Map<string, Set<string>>>();
    for (const d of daysWith(week, "groups")) {
      const day = out.get(d.day) ?? out.set(d.day, new Map()).get(d.day)!;
      for (const guid of d.entry.groups!) {
        const other = owner(week, guid);
        if (other === "" || other === d.owner) continue;
        (day.get(d.owner) ?? day.set(d.owner, new Set()).get(d.owner)!).add(other);
      }
    }
    return out;
  };

  /** Deaths of the week per character, with their cause and zone (CF-52). */
  const deaths = (week: Week) =>
    daysWith(week, "deaths").flatMap((d) => d.entry.deaths!.map((x) => ({ ...x, guid: d.guid, owner: d.owner })));

  /** Duels between friends' characters: the opponent's owner by full name (never split). */
  const friendDuels = (week: Week) => {
    const byName = new Map(Object.values(week.after).map((c) => [c.name, c.owner]));
    return daysWith(week, "duels").flatMap((d) =>
      d.entry.duels!.flatMap((x) => {
        const other = x.vs === undefined ? undefined : byName.get(x.vs);
        return other === undefined || other === d.owner || x.won === undefined
          ? []
          : [{ a: d.owner, b: other, won: x.won }];
      }),
    );
  };

  const timeZoneOf = (week: Week, friend: string) => week.friends.find((f) => f.key === friend)?.timeZone;

  const awards: CardDef[] = [
    award("A11", "Warmonger", killsByFriend, 25, plural("honorable kill", "honorable kills")),
    award(
      "A12",
      "Battlemaster",
      (w) => {
        const m = new Map<string, number>();
        for (const r of bgRuns(w)) if (r.won === true) add(m, r.owner);
        return m;
      },
      3,
      plural("battleground win", "battleground wins"),
    ),
    award(
      "A13",
      "Loot goblin",
      (w) => {
        const days = daysWith(w, "loot");
        if (days.length === 0) return undefined;
        const m = new Map<string, number>();
        for (const d of days) add(m, d.owner, (d.entry.loot!.rare ?? 0) + d.entry.loot!.epic.length);
        return m;
      },
      4,
      (n, w, friend) => {
        const epics = daysWith(w, "loot")
          .filter((d) => d.owner === friend)
          .reduce((a, d) => a + d.entry.loot!.epic.length, 0);
        const blues = n - epics;
        const blue = `${blues} ${blues === 1 ? "blue" : "blues"}`;
        return epics > 0 ? `${blue} and ${epics} ${epics === 1 ? "purple" : "purples"}` : blue;
      },
    ),
    award(
      "A14",
      "Duelist",
      (w) => {
        const days = daysWith(w, "duels");
        if (days.length === 0) return undefined;
        const m = new Map<string, number>();
        for (const d of days) add(m, d.owner, d.entry.duels!.filter((x) => x.won === true).length);
        return m;
      },
      5,
      plural("duel won", "duels won"),
    ),
    // Redefined (Nico, 2026-10-29): grouped with the most different friends.
    award(
      "A7",
      "Social butterfly",
      (w) => {
        const days = groupsByDay(w);
        if (days.size === 0) return undefined;
        const friends = new Map<string, Set<string>>();
        for (const day of days.values()) {
          for (const [f, others] of day)
            for (const o of others) (friends.get(f) ?? friends.set(f, new Set()).get(f)!).add(o);
        }
        return new Map([...friends].map(([f, s]) => [f, s.size]));
      },
      3,
      (n) => `grouped with ${n} ${n === 1 ? "friend" : "friends"}`,
    ),
  ];

  const stats: CardDef[] = [
    {
      id: "S13",
      slot: "stat",
      name: "Bloodbath zone",
      find(week, history) {
        const zones = new Map<string, number>();
        const who = new Map<string, Set<string>>();
        for (const d of daysWith(week, "kills")) {
          for (const [zone, n] of Object.entries(d.entry.kills!)) {
            add(zones, zone, n);
            (who.get(zone) ?? who.set(zone, new Set()).get(zone)!).add(d.owner);
          }
        }
        const top = best(zones);
        if (top === undefined || top[1] < 20) return undefined;
        return found(history, "S13", top[1], { zone: top[0], kills: top[1], friends: who.get(top[0])!.size }, [], 1.1);
      },
    },
    {
      id: "S14",
      slot: "stat",
      name: "Battleground of the week",
      find(week, history) {
        const games = new Map<string, { won: number; lost: number; results: string; players: Map<string, number> }>();
        for (const r of [...bgRuns(week)].sort((a, b) => a.day - b.day)) {
          if (r.name === undefined || r.won === undefined) continue;
          const g =
            games.get(r.name) ?? games.set(r.name, { won: 0, lost: 0, results: "", players: new Map() }).get(r.name)!;
          if (r.won) g.won++;
          else g.lost++;
          g.results += r.won ? "W" : "L";
          add(g.players, r.owner);
        }
        const top = best(new Map([...games].map(([n, g]) => [n, g.won + g.lost])));
        if (top === undefined || top[1] < 3) return undefined;
        const g = games.get(top[0])!;
        const most = best(g.players)!;
        return found(
          history,
          "S14",
          top[1],
          {
            battleground: top[0],
            games: top[1],
            won: g.won,
            lost: g.lost,
            results: g.results,
            friend: friendName(week, most[0]),
            played: most[1],
          },
          [],
          1,
        );
      },
    },
    {
      id: "S15",
      slot: "stat",
      name: "Deadliest zone",
      find(week, history) {
        const zones = new Map<string, number>();
        const who = new Map<string, Set<string>>();
        for (const d of deaths(week)) {
          if (d.zone === undefined) continue;
          add(zones, d.zone);
          (who.get(d.zone) ?? who.set(d.zone, new Set()).get(d.zone)!).add(d.owner);
        }
        const top = best(zones);
        if (top === undefined || top[1] < 5) return undefined;
        return found(history, "S15", top[1], { zone: top[0], deaths: top[1], friends: who.get(top[0])!.size }, [], 0.9);
      },
    },
    {
      id: "S11",
      slot: "stat",
      name: "Biggest group night",
      find(week, history) {
        let top: { day: number; friends: Set<string> } | undefined;
        for (const [day, links] of groupsByDay(week)) {
          const friends = new Set<string>();
          for (const [f, others] of links) {
            friends.add(f);
            for (const o of others) friends.add(o);
          }
          if (top === undefined || friends.size > top.friends.size) top = { day, friends };
        }
        if (top === undefined || top.friends.size < 4) return undefined;
        const names = [...top.friends].map((f) => friendName(week, f)).sort();
        return found(
          history,
          "S11",
          top.friends.size,
          { weekday: WEEKDAY_NAMES[weekdayOfDay(top.day)]!, friends: top.friends.size, names: names.join(", ") },
          [],
          1,
        );
      },
    },
  ];

  const progress: CardDef[] = [
    {
      id: "P14",
      slot: "progress",
      name: "Rank race",
      find(week, history) {
        // Two friends' characters at the same PvP rank, this week's honor within 10% (Nico, 2026-10-29).
        const ranked = Object.values(week.after)
          .filter((c) => (c.pvpRank ?? 0) >= 1 && (c.weekHonor ?? 0) > 0)
          .sort((a, b) => b.pvpRank! - a.pvpRank! || b.weekHonor! - a.weekHonor! || a.name.localeCompare(b.name));
        for (let i = 0; i < ranked.length; i++) {
          for (let j = i + 1; j < ranked.length; j++) {
            const [a, b] = [ranked[i]!, ranked[j]!];
            if (a.owner === b.owner || a.pvpRank !== b.pvpRank) continue;
            if ((a.weekHonor! - b.weekHonor!) / a.weekHonor! > 0.1) continue;
            return found(
              history,
              "P14",
              a.pvpRank!,
              {
                rank: a.pvpRankName ?? `Rank ${a.pvpRank}`,
                leader: a.name,
                second: b.name,
                leaderHonor: a.weekHonor!,
                secondHonor: b.weekHonor!,
              },
              [a.owner, b.owner],
              1,
            );
          }
        }
        return undefined;
      },
    },
  ];

  const social: CardDef[] = [
    {
      id: "F14",
      slot: "social",
      name: "Revenge",
      find(week, history) {
        const died = new Map<string, number>();
        for (const d of deaths(week)) if (d.cause === "player") add(died, d.guid);
        const kills = new Map<string, number>();
        for (const d of daysWith(week, "kills"))
          add(
            kills,
            d.guid,
            Object.values(d.entry.kills!).reduce((a, b) => a + b, 0),
          );
        const top = best(
          new Map([...died].filter(([g, n]) => n >= 3 && (kills.get(g) ?? 0) >= 10).map(([g]) => [g, kills.get(g)!])),
        );
        if (top === undefined) return undefined;
        return found(
          history,
          "F14",
          top[1],
          { character: charName(week, top[0]), deaths: died.get(top[0])!, kills: top[1] },
          [owner(week, top[0])],
          1,
        );
      },
    },
    {
      id: "F15",
      slot: "social",
      name: "Duel rivals",
      find(week, history) {
        // Each side records its own duels: a pair's duels are the larger side's records, the score from that side.
        const sides = new Map<string, { won: number; lost: number }>();
        for (const d of friendDuels(week)) {
          const side =
            sides.get(`${d.a}\u0000${d.b}`) ??
            sides.set(`${d.a}\u0000${d.b}`, { won: 0, lost: 0 }).get(`${d.a}\u0000${d.b}`)!;
          if (d.won) side.won++;
          else side.lost++;
        }
        let top: { a: string; b: string; won: number; lost: number } | undefined;
        for (const [key, side] of sides) {
          const [a, b] = key.split("\u0000") as [string, string];
          const n = side.won + side.lost;
          if (
            top === undefined ||
            n > top.won + top.lost ||
            (n === top.won + top.lost && key < `${top.a}\u0000${top.b}`)
          ) {
            top = { a, b, ...side };
          }
        }
        if (top === undefined || top.won + top.lost < 4) return undefined;
        const [lead, trail, high, low] =
          top.won >= top.lost ? [top.a, top.b, top.won, top.lost] : [top.b, top.a, top.lost, top.won];
        return found(
          history,
          "F15",
          top.won + top.lost,
          {
            first: friendName(week, lead),
            second: friendName(week, trail),
            score: `${high}–${low}`,
            duels: top.won + top.lost,
          },
          [top.a, top.b],
          1,
        );
      },
    },
  ];

  const fun: CardDef[] = [
    {
      id: "F16",
      slot: "fun",
      name: "Most deaths",
      find(week, history) {
        const m = new Map<string, number>();
        for (const d of deaths(week)) add(m, d.guid);
        const top = best(m);
        if (top === undefined || top[1] < 6) return undefined;
        const facts: Candidate["facts"] = { character: charName(week, top[0]), deaths: top[1] };
        const runner = second(m, top[0]);
        if (runner !== undefined) {
          facts.runnerUp = charName(week, runner[0]);
          facts.runnerUpDeaths = runner[1];
        }
        return found(history, "F16", top[1], facts, [owner(week, top[0])], 0.9);
      },
    },
    {
      id: "F17",
      slot: "fun",
      name: "Fell to their death",
      find(week, history) {
        const falls = deaths(week).filter((d) => d.cause === "fall");
        const m = new Map<string, number>();
        for (const d of falls) add(m, d.guid);
        const top = best(m);
        if (top === undefined) return undefined;
        const zones = new Set(
          falls
            .filter((d) => d.guid === top[0])
            .map((d) => d.zone)
            .filter(Boolean),
        );
        return found(
          history,
          "F17",
          top[1],
          { character: charName(week, top[0]), falls: top[1], zone: zones.size === 1 ? [...zones][0]! : "" },
          [owner(week, top[0])],
          1,
        );
      },
    },
    {
      id: "F18",
      slot: "fun",
      name: "Died by fire",
      find(week, history) {
        const fires = deaths(week).filter((d) => d.cause === "fire" || d.cause === "lava");
        const m = new Map<string, number>();
        for (const d of fires) add(m, d.guid);
        const top = best(m);
        if (top === undefined) return undefined;
        const zone = fires.find((d) => d.guid === top[0] && d.zone !== undefined)?.zone ?? "";
        return found(
          history,
          "F18",
          fires.length,
          { character: charName(week, top[0]), deaths: fires.length, zone },
          [owner(week, top[0])],
          1,
        );
      },
    },
    {
      id: "F19",
      slot: "fun",
      name: "Untouchable",
      find(week, history) {
        // Only characters whose every day of the week carries deaths (CF-52): 0 must mean none, not unknown.
        const known = new Map<string, boolean>();
        for (const d of week.days) known.set(d.guid, (known.get(d.guid) ?? true) && d.entry.deaths !== undefined);
        const died = new Set(deaths(week).map((d) => d.guid));
        const top = best(new Map([...levelGains(week)].filter(([g]) => known.get(g) === true && !died.has(g))));
        if (top === undefined || top[1] < 5) return undefined;
        const after = week.after[top[0]]?.level ?? 0;
        return found(
          history,
          "F19",
          top[1],
          {
            character: charName(week, top[0]),
            friend: friendName(week, owner(week, top[0])),
            levels: top[1],
            from: after - top[1],
            to: after,
          },
          [owner(week, top[0])],
          1,
        );
      },
    },
    {
      id: "F20",
      slot: "fun",
      name: "Big spender",
      find(week, history) {
        const m = new Map<string, number>();
        for (const d of daysWith(week, "gold")) {
          const spent = d.entry.gold!.spent ?? 0;
          if (spent >= BIG_SPEND) m.set(d.owner, Math.max(m.get(d.owner) ?? 0, spent));
        }
        const top = best(m);
        if (top === undefined) return undefined;
        // Never an amount (Nico): the value is only for the score.
        return found(history, "F20", top[1], { friend: friendName(week, top[0]) }, [top[0]], 0.9);
      },
    },
    {
      id: "F21",
      slot: "fun",
      name: "Purple rain",
      find(week, history) {
        const epics = daysWith(week, "loot").flatMap((d) =>
          d.entry.loot!.epic.filter((e) => e.name !== undefined).map((e) => ({ item: e.name!, guid: d.guid })),
        );
        if (epics.length === 0) return undefined;
        const list = epics.slice(0, 3).map((e) => `[${e.item}] for ${charName(week, e.guid)}`);
        return found(
          history,
          "F21",
          epics.length,
          {
            epics: epics.length,
            items: list.join(" · "),
            character: charName(week, epics[0]!.guid),
            item: epics[0]!.item,
          },
          [...new Set(epics.map((e) => owner(week, e.guid)))],
          1.2,
        );
      },
    },
    {
      id: "F22",
      slot: "fun",
      name: "Marathon",
      find(week, history) {
        let top: { guid: string; owner: string; from: number; to: number } | undefined;
        for (const d of daysWith(week, "sessions")) {
          for (const s of d.entry.sessions!) {
            if (s.from === undefined || s.to === undefined) continue;
            if (top === undefined || s.to - s.from > top.to - top.from)
              top = { guid: d.guid, owner: d.owner, from: s.from, to: s.to };
          }
        }
        if (top === undefined || top.to - top.from < 5 * HOUR) return undefined;
        const tz = timeZoneOf(week, top.owner);
        return found(
          history,
          "F22",
          Math.floor((top.to - top.from) / HOUR),
          {
            character: charName(week, top.guid),
            hours: Math.floor((top.to - top.from) / HOUR),
            weekday: new Intl.DateTimeFormat("en-GB", { timeZone: tz ?? "UTC", weekday: "long" }).format(
              new Date(top.from * 1000),
            ),
            from: localTime(top.from, tz).text,
            to: localTime(top.to, tz).text,
          },
          [top.owner],
          1,
        );
      },
    },
    {
      id: "F7",
      slot: "fun",
      name: "Night owl",
      find(week, history) {
        // Played after 01:00 (to 05:00) in the friend's own time zone, the most nights; the latest time shown.
        const nights = new Map<string, number>();
        const latest = new Map<string, { guid: string; minutes: number; text: string }>();
        for (const d of daysWith(week, "sessions")) {
          const tz = timeZoneOf(week, d.owner);
          for (const s of d.entry.sessions!) {
            if (s.to === undefined) continue;
            const end = localTime(s.to, tz);
            if (end.hour < 1 || end.hour >= 5) continue;
            add(nights, d.owner);
            const minutes = end.hour * 60 + Number(end.text.slice(3));
            if ((latest.get(d.owner)?.minutes ?? -1) < minutes)
              latest.set(d.owner, { guid: d.guid, minutes, text: end.text });
          }
        }
        const top = best(nights);
        if (top === undefined) return undefined;
        const l = latest.get(top[0])!;
        return found(
          history,
          "F7",
          top[1],
          { character: charName(week, l.guid), time: l.text, nights: top[1] },
          [top[0]],
          0.9,
        );
      },
    },
    {
      id: "F8",
      slot: "fun",
      name: "Early bird",
      find(week, history) {
        // Logged in before 07:00 in the friend's own time zone, on the most days; the earliest time shown.
        const days = new Map<string, Set<number>>();
        const earliest = new Map<string, { minutes: number; text: string }>();
        for (const d of daysWith(week, "sessions")) {
          const tz = timeZoneOf(week, d.owner);
          for (const s of d.entry.sessions!) {
            if (s.from === undefined) continue;
            const start = localTime(s.from, tz);
            if (start.hour < 5 || start.hour >= 7) continue;
            (days.get(d.owner) ?? days.set(d.owner, new Set()).get(d.owner)!).add(d.day);
            const minutes = start.hour * 60 + Number(start.text.slice(3));
            if ((earliest.get(d.owner)?.minutes ?? 24 * 60) > minutes)
              earliest.set(d.owner, { minutes, text: start.text });
          }
        }
        const top = best(new Map([...days].map(([f, s]) => [f, s.size])));
        if (top === undefined) return undefined;
        return found(
          history,
          "F8",
          top[1],
          { friend: friendName(week, top[0]), time: earliest.get(top[0])!.text, days: top[1] },
          [top[0]],
          0.9,
        );
      },
    },
  ];

  return { awards, stats, progress, social, fun };
}

/** The week's PvP and danger numbers for the headlines and challenges. */
export function v2Totals(week: Week): {
  kills: number;
  topKillZone?: { zone: string; kills: number };
  topKillZones: string[];
  deaths: number;
  bgGames: number;
} {
  const zones = new Map<string, number>();
  for (const d of week.days) for (const [z, n] of Object.entries(d.entry.kills ?? {})) add(zones, z, n);
  const kills = [...zones.values()].reduce((a, b) => a + b, 0);
  const sorted = [...zones].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const out: ReturnType<typeof v2Totals> = {
    kills,
    topKillZones: sorted.slice(0, 3).map(([z]) => z),
    deaths: week.days.reduce((a, d) => a + (d.entry.deaths?.length ?? 0), 0),
    bgGames: week.days.reduce((a, d) => a + d.entry.runs.filter((r) => r.kind === "pvp").length, 0),
  };
  if (sorted[0] !== undefined) out.topKillZone = { zone: sorted[0][0], kills: sorted[0][1] };
  return out;
}
