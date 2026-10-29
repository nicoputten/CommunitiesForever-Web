import { DAY, dayOf, dayStart, goalsForDay, goalsForWeek, weekOf, weekStart, type Schedule } from "@/core/doomsday/rules";
import { zoneOffset } from "@/core/doomsday/engine";

// The design sample's Doomsday (WEB-63): the fields the addon's CF-52, CF-53, CF-55 and CF-56 write (as
// tests/fixtures/doomsday/savedvariables.lua), so the engine (WEB-58) computes Doomsday from the uploads instead of a
// made-up snapshot. The same invented friends as sample.ts; times relative to "now", so the e2e run (real clock) gets
// the same picture. A friend's records stop at their data's age: only Nico and Femke (data 1 hour old) have today's.
// Goal sets are the engine's own draw; victims and items are made up.

const H = 3600;
const ZONE = "Europe/Paris";

type Lua = string | number | boolean | Lua[] | { [key: string]: Lua };

interface Kills {
  /** Kills per day for the last days (index 0 = today), cycling. */
  perDay: number[];
  zones: string[];
  /** Days back the kills start. */
  days: number;
}

interface DoomScript {
  /** Days back the friend's Doomsday records start (the heatmap's first coloured day). */
  history: number;
  /** Goals done per earlier day, cycling (0 ends a streak). */
  pattern: number[];
  /** Only PvE goals, never a kill (the PvP Virgin): earlier days stop at the 3 dailies, weeks skip the bounty. */
  pveOnly?: boolean;
  /** Today's goals done: index in the set and minutes after the reset (squeezed into the time since the reset). */
  today?: [number, number][];
  /** This week's weeklies done: index in the set and hours after the week's start. */
  week?: [number, number][];
  kills?: Kills;
  /** Lifetime honorable kills and PvP rank per character name, in the design file (day 3); day 2 had `before`. */
  pvp: Record<string, { hk: number; rank: number; before?: { hk: number; rank: number } }>;
  /** Riding skill per character name; day 2 had `before`. */
  riding?: Record<string, { now: number; before?: number }>;
}

/** Keyed by display name; "Nico" is the uploader. */
const SCRIPTS: Record<string, DoomScript> = {
  Nico: {
    history: 40,
    pattern: [3, 4, 2, 5, 3, 1, 4, 3, 0, 2, 4, 5],
    today: [
      [0, 12],
      [1, 55],
    ],
    week: [
      [2, 51],
      [3, 70],
    ],
    kills: { perDay: [3, 5, 0, 7, 4, 2, 6], zones: ["Hillsbrad Foothills", "Stranglethorn Vale", "Arathi Highlands"], days: 10 },
    pvp: {
      "Ves Doombringer": { hk: 132, rank: 6, before: { hk: 96, rank: 5 } },
      "Grom Ashfeller": { hk: 12, rank: 2 },
      "Sela Moonbrook": { hk: 0, rank: 0 },
    },
    riding: { "Grom Ashfeller": { now: 75, before: 0 } },
  },
  Femke: {
    history: 60,
    pattern: [3, 3, 0, 2, 3, 3, 1, 3, 0, 3],
    pveOnly: true,
    today: [
      [0, 9],
      [1, 30],
      [2, 41],
    ],
    week: [
      [0, 20],
      [2, 70],
    ],
    pvp: { "Lia Thornwhisper": { hk: 0, rank: 0 }, "Zul Kazrek": { hk: 0, rank: 0 } },
  },
  Bob: {
    history: 70,
    pattern: [2, 4, 3, 0, 1, 3, 4, 2, 0],
    week: [[1, 30]],
    kills: { perDay: [6, 9, 4, 8, 5], zones: ["Hillsbrad Foothills", "Alterac Mountains", "Arathi Highlands"], days: 10 },
    pvp: {
      "Bob Example": { hk: 1450, rank: 7, before: { hk: 1430, rank: 7 } },
      "Tok Ironhide": { hk: 40, rank: 1 },
    },
    riding: { "Bob Example": { now: 75 } },
  },
  Mira: {
    history: 84,
    pattern: [4, 5, 3, 0, 4, 5, 2, 4, 0],
    week: [
      [0, 6],
      [1, 30],
    ],
    kills: { perDay: [2, 3, 1, 4], zones: ["Tanaris", "Felwood"], days: 8 },
    pvp: { "Mira Sunstrider": { hk: 380, rank: 4 }, "Kel Dawnhammer": { hk: 0, rank: 0 } },
    riding: { "Mira Sunstrider": { now: 150 } },
  },
  Jorrit: {
    history: 30,
    pattern: [1, 2, 0, 1, 1, 2],
    kills: { perDay: [1, 0, 2], zones: ["Stonetalon Mountains"], days: 6 },
    pvp: { "Ruk Bloodhoof": { hk: 9, rank: 1 } },
  },
};

// Made-up victims: Alliance race and class pairs of DOOMSDAY.md "Lists", names only invented.
const VICTIMS: [string, string][] = [
  ["Human", "PALADIN"],
  ["NightElf", "DRUID"],
  ["Dwarf", "HUNTER"],
  ["Gnome", "MAGE"],
  ["Human", "PRIEST"],
  ["NightElf", "ROGUE"],
];

export interface DoomChar {
  guid: string;
  name: string;
  classFile: string;
  level: number;
}

/** The character fields of CF-52 (`pvp`, `riding`) for the file of day 3 (`before`: day 2). */
export function doomsdayChar(owner: string, c: DoomChar, before: boolean): Record<string, Lua> {
  const script = SCRIPTS[owner];
  const pvp = script?.pvp[c.name];
  const riding = script?.riding?.[c.name];
  const out: Record<string, Lua> = {};
  if (pvp !== undefined) {
    const p = before && pvp.before !== undefined ? pvp.before : pvp;
    out.pvp = { hk: p.hk, rank: p.rank };
  }
  const r = before ? riding?.before : riding?.now;
  if (r !== undefined && r > 0) out.riding = r;
  return out;
}

/**
 * A friend's `feed` (kills, duels) and `goals` up to `asOf` (their data's time), as the addon writes them. Undefined
 * for a friend without a script (Sanne has no addon).
 */
export function doomsdayPerson(
  owner: string,
  chars: readonly DoomChar[],
  now: number,
  asOf: number,
): { feed: Record<string, Lua>; goals: Record<string, Lua> } | undefined {
  const script = SCRIPTS[owner];
  if (script === undefined || chars.length === 0) return undefined;
  const s: Schedule = { offset: zoneOffset(ZONE, now), reset: 68400 };
  const today = dayOf(now, s);
  const last = dayOf(asOf, s);
  const elapsed = Math.min(now - dayStart(today, s), 2 * H);
  const main = chars[0]!;

  // Goals per Doomsday day: the engine's draw, the first k done a few hours after the reset.
  const days: Record<string, Lua> = {};
  for (let n = today - script.history; n <= last; n++) {
    const { set, swapped } = goalsForDay(n);
    const done: Record<string, number> = {};
    if (n === today) {
      for (const [i, minute] of script.today ?? []) {
        const id = set[i];
        if (id !== undefined) done[id] = dayStart(n, s) + Math.round((minute / 120) * elapsed);
      }
    } else {
      const k = Math.min(
        script.pattern[(n - (today - script.history)) % script.pattern.length]!,
        script.pveOnly === true ? 3 : 5,
      );
      set.slice(0, k).forEach((id, i) => (done[id] = dayStart(n, s) + (2 + i) * H));
    }
    const at = Math.min(asOf, Math.max(dayStart(n, s) + H, ...Object.values(done)));
    days[String(n)] = { set, swapped, done, at };
  }

  // Weeks: the engine's draw; past weeks two weeklies done, this week as scripted.
  const weeks: Record<string, Lua> = {};
  const thisWeek = weekOf(today);
  for (let w = weekOf(today - script.history); w <= weekOf(last); w++) {
    const { set, swapped } = goalsForWeek(w);
    const start = dayStart(weekStart(w), s);
    const done: Record<string, number> = {};
    if (w === thisWeek) {
      for (const [i, hours] of script.week ?? []) {
        const id = set[i];
        if (id !== undefined && start + hours * H <= asOf) done[id] = start + hours * H;
      }
    } else {
      set.slice(0, 2).forEach((id, i) => (done[id] = start + (30 + 24 * i) * H));
    }
    if (script.pveOnly === true) {
      const bounty = set[3];
      if (bounty !== undefined) delete done[bounty];
    }
    weeks[String(w)] = { set, swapped, done, at: Math.min(asOf, start + 3 * DAY) };
  }

  // The feed, per realm day and character: world kills of the main character, and Nico's duel with Bob today.
  const feed: Record<string, Record<string, Lua>> = {};
  const entry = (t: number) => {
    const day = String(Math.floor((t + s.offset!) / DAY));
    const byChar = (feed[day] ??= {});
    return (byChar[main.guid] ??= { name: main.name, classFile: main.classFile, at: t }) as Record<string, Lua>;
  };
  if (script.kills !== undefined) {
    const { perDay, zones, days: back } = script.kills;
    for (let d = 0; d < back; d++) {
      const count = perDay[d % perDay.length]!;
      for (let i = 0; i < count; i++) {
        const t = asOf - d * DAY - (i + 1) * 9 * 60;
        if (t <= dayStart(today - script.history, s)) continue;
        const [race, cls] = VICTIMS[(d + i) % VICTIMS.length]!;
        const skull = (d + i) % 11 === 0;
        const kill: Record<string, Lua> = {
          t,
          zone: zones[(d + i) % zones.length]!,
          name: `Foe ${String.fromCharCode(65 + ((d * 7 + i) % 26))}${(d * 13 + i) % 9} Example`,
          lvl: skull ? -1 : main.level - 2 + ((d + i) % 6),
          myLvl: main.level,
          class: cls,
          race,
          solo: (d + i) % 3 === 0,
          bg: false,
        };
        const e = entry(t);
        ((e.pvpKills ??= []) as Lua[]).push(kill);
      }
    }
  }
  if (owner === "Nico" && script.today !== undefined) {
    const t = dayStart(today, s) + Math.round((40 / 120) * elapsed);
    ((entry(t).duels ??= []) as Lua[]).push({ t, won: true, vs: "Bob Example" });
    // Ves's first epic (CF-53 loot), in the design file only: a feat, First in the group (WEB-56).
    const looted = dayStart(today, s) + Math.round((31 / 120) * elapsed);
    if (looted <= asOf) {
      entry(looted).loot = {
        rare: 1,
        epic: [{ id: 99001, name: "Robes of the Exalted", slot: "INVTYPE_ROBE", level: main.level }],
      };
    }
  }

  return {
    feed,
    goals: { days, weeks, streak: 0, best: 0, pool: 1, reset: 68400 },
  };
}
