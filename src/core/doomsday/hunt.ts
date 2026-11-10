import { classInfo } from "../gamedata/classes";
import type { FeedHunt } from "../feed";
import {
  CENSUS_LICENCE,
  CENSUS_URL,
  type CensusInfo,
  type FriendHuntView,
  type HuntDay,
  type HuntFeatId,
  type HuntFeatProgress,
  type HuntKill,
  type HuntTarget,
  type HuntTargetCell,
  type HuntTargetsView,
  type HuntTodayView,
  type HuntWeekRow,
  type QuarryView,
  type TrophiesView,
} from "../views/pool6";
import {
  CLASS_IDS,
  type Combo,
  combos,
  enemyOf,
  type Faction,
  pick,
  POOL_VERSION,
  RACE_IDS,
  raceName,
  type TargetIds,
  weekOf,
  weekStart,
} from "./rules";

// The Hunt from pool version 6 (WEB-108): the site draws each day's quarry per hunted faction, weighted by Everloot's
// census (https://everloot.app/census, CC BY-SA 4.0), and sends it to the addons in the schedule. Here: the targets,
// the census (Everloot's population answers or the owner's import), the draw with its locks and pins, and the Hunt
// kills of the uploads with everything the pages derive from them. Pure: src/server/hunt.ts stores and fetches.

/** A target seen fewer times than this in the census is skipped; it comes back once its count grows (BRIEF 1.4). */
export const MIN_SEEN = 30;
/** Never the same target twice within this many days: any 7 days in a row have 7 different quarries per faction. */
export const NO_REPEAT_DAYS = 7;
/** Under this share of the census a target is rare (p.rareQuarry, f.huntRare). */
export const RARE_SHARE = 0.01;
/** Trophies: a target seen fewer than this this week gets a blue ring (DS02). */
export const SCARCE_SEEN = 60;
/** The Hunt's points (BOT-API "Goals": the Hunt is worth 5). */
export const HUNT_POINTS = 5;
/** The salts of the census-weighted draw, per hunted faction (the site's own; never the addon's SALT). */
const HUNT_SALT: Readonly<Record<Faction, number>> = { Alliance: 61, Horde: 62 };

export const FACTIONS: readonly Faction[] = ["Alliance", "Horde"];

// --- targets -----------------------------------------------------------------------------------------------------

/** "4:3": a target's key, race id then class id. */
export function targetKey(t: TargetIds): string {
  return `${t.race}:${t.class}`;
}

/** The ids of a combination in a hunted faction's list, also for pool versions without ids (from the tokens). */
export function comboIds(hunted: Faction, c: Combo): TargetIds | undefined {
  const race = c.raceId ?? RACE_IDS[hunted][c.race];
  const cls = c.classId ?? CLASS_IDS[c.class];
  return race !== undefined && cls !== undefined ? { race, class: cls } : undefined;
}

const VANILLA = new Set(
  combos("Horde", 4)
    .concat(combos("Alliance", 4))
    .map((c) => `${c.race}:${c.class}`),
);

function toTarget(hunted: Faction, c: Combo): HuntTarget {
  const ids = comboIds(hunted, c)!;
  const race = raceName(c.race);
  const className = classInfo(c.class)?.name ?? c.class;
  return {
    key: targetKey(ids),
    faction: hunted,
    raceId: ids.race,
    classId: ids.class,
    raceToken: c.race,
    classFile: c.class,
    race,
    className,
    name: `${race} ${className}`,
  };
}

/** The valid targets of a hunted faction in list order (28 each from pool version 6). */
export function huntTargets(hunted: Faction, version = POOL_VERSION): HuntTarget[] {
  return combos(enemyOf(hunted), version).map((c) => toTarget(hunted, c));
}

const ALL = new Map<string, HuntTarget>(FACTIONS.flatMap((f) => huntTargets(f).map((t) => [t.key, t] as const)));

/** A valid target by key ("4:3"); undefined for anything else. */
export function targetOf(key: string | undefined): HuntTarget | undefined {
  return key === undefined ? undefined : ALL.get(key);
}

/** Forever's additions to Vanilla's list (blue border on MP06): a new race, or a new class for a race. */
export function isForever(t: HuntTarget): boolean {
  return !VANILLA.has(`${t.raceToken}:${t.classFile}`);
}

// --- the census ------------------------------------------------------------------------------------------------

/** The census as stored: counts per target key, with what Everloot says about them. */
export interface Census {
  /** Everloot's "data as of", or the import's time (unix seconds). */
  asOf: number;
  from?: number;
  to?: number;
  characters?: number;
  installs?: number;
  roundTo?: number;
  source: "everloot" | "import";
  /** Target key -> count. A target without a count is unrecorded (Everloot hides counts under 10), never zero. */
  counts: Record<string, number>;
}

/** The race names Everloot's census uses, per faction, to race ids (Skyborne: one name, an id per faction). */
const CENSUS_RACES: Readonly<Record<Faction, Readonly<Record<string, number>>>> = {
  Alliance: { Human: 1, Dwarf: 3, "Night Elf": 4, NightElf: 4, Gnome: 7, Skyborne: 95, "High Order Skyborne": 95 },
  Horde: { Orc: 2, Undead: 5, Scourge: 5, Tauren: 6, Troll: 8, Skyborne: 96, "Windshaper Skyborne": 96 },
};

/** A class name or token ("Mage", "MAGE", "Death Knight" is not one) to its id. */
function classIdOf(x: unknown): number | undefined {
  if (typeof x === "number") return Object.values(CLASS_IDS).includes(x) ? x : undefined;
  if (typeof x !== "string") return undefined;
  return CLASS_IDS[x.toUpperCase().replace(/\s+/g, "")];
}

function raceIdOf(faction: Faction, x: unknown): number | undefined {
  if (typeof x === "number") return Object.values(RACE_IDS[faction]).includes(x) ? x : undefined;
  return typeof x === "string" ? CENSUS_RACES[faction][x.trim()] : undefined;
}

const isTable = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isCount = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < 1e9;
const unix = (x: unknown): number | undefined => {
  if (typeof x === "number" && Number.isFinite(x) && x > 0) return Math.floor(x > 1e11 ? x / 1000 : x);
  if (typeof x !== "string") return undefined;
  const t = Date.parse(x);
  return Number.isNaN(t) ? undefined : Math.floor(t / 1000);
};

/**
 * One answer of Everloot's population tool (`GET /api/tools/population?faction=…&class=…&window=week`, or the MCP
 * tool's structured content), as a census part: the race-and-class cells of valid targets. Untrusted: anything that
 * isn't a valid target or a whole count is dropped; undefined when it isn't a population answer at all.
 */
export function parsePopulation(raw: unknown): Census | undefined {
  const answer = isTable(raw) && isTable(raw.answer) ? raw.answer : raw;
  if (!isTable(answer) || !isTable(answer.page)) return undefined;
  const page = answer.page;
  if (!Array.isArray(page.cells)) return undefined;
  const counts: Record<string, number> = {};
  for (const cell of page.cells.slice(0, 500)) {
    if (!isTable(cell) || cell.slice !== "raceClass" || !isCount(cell.count)) continue;
    const faction = cell.faction === "Alliance" || cell.faction === "Horde" ? cell.faction : undefined;
    if (faction === undefined) continue;
    const race = raceIdOf(faction, cell.race);
    const cls = classIdOf(cell.class);
    if (race === undefined || cls === undefined) continue;
    const key = targetKey({ race, class: cls });
    if (targetOf(key) !== undefined) counts[key] = cell.count;
  }
  const window = isTable(page.window) ? page.window : {};
  const rule = isTable(page.rule) ? page.rule : {};
  const out: Census = { asOf: unix(answer.dataAsOf) ?? 0, source: "everloot", counts };
  const from = unix(window.from);
  const to = unix(window.to);
  if (from !== undefined) out.from = from;
  if (to !== undefined) out.to = to;
  if (isCount(page.characters)) out.characters = page.characters;
  if (isCount(page.installs)) out.installs = page.installs;
  if (isCount(rule.roundTo)) out.roundTo = rule.roundTo;
  return out;
}

/** The census parts of one fetch (one answer per faction and class) as one census; undefined without any part. */
export function mergeCensus(parts: readonly Census[]): Census | undefined {
  if (parts.length === 0) return undefined;
  const out: Census = { ...parts[0]!, counts: {} };
  for (const p of parts) {
    Object.assign(out.counts, p.counts);
    out.asOf = Math.max(out.asOf, p.asOf);
    for (const k of ["from", "to", "characters", "installs", "roundTo"] as const)
      if (out[k] === undefined && p[k] !== undefined) out[k] = p[k];
  }
  return out;
}

/** The longest import the owner can paste (BRIEF 1.4's manual JSON). */
export const MAX_IMPORT = 256 * 1024;

/**
 * The owner's manual import (the Hunt targets page) as a census, or the reason it is refused. Accepts Everloot
 * population answers (one, or a list), or `{ characters?, installs?, from?, to?, counts }` where `counts` is keyed by
 * "<raceId>:<classId>" or nested as `{ Alliance: { "Night Elf": { Hunter: 230 } } }`.
 */
export function parseCensusImport(text: string, now: number): Census | { error: string } {
  if (text.length > MAX_IMPORT) return { error: "That file is too big." };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "That isn't JSON." };
  }
  const list = Array.isArray(raw) ? raw.slice(0, 50) : [raw];
  const answers = list.map(parsePopulation).filter((c): c is Census => c !== undefined);
  let census: Census | undefined;
  if (answers.length > 0) census = mergeCensus(answers);
  else if (isTable(raw) && isTable(raw.counts)) {
    const counts: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw.counts)) {
      if (isCount(value) && targetOf(key) !== undefined) counts[key] = value;
      const faction = key === "Alliance" || key === "Horde" ? key : undefined;
      if (faction === undefined || !isTable(value)) continue;
      for (const [race, classes] of Object.entries(value)) {
        if (!isTable(classes)) continue;
        for (const [cls, n] of Object.entries(classes)) {
          const r = raceIdOf(faction, race);
          const c = classIdOf(cls);
          const k = r !== undefined && c !== undefined ? targetKey({ race: r, class: c }) : undefined;
          if (k !== undefined && isCount(n) && targetOf(k) !== undefined) counts[k] = n;
        }
      }
    }
    census = { asOf: unix(raw.asOf) ?? now, source: "import", counts };
    for (const k of ["characters", "installs"] as const) if (isCount(raw[k])) census[k] = raw[k];
    const from = unix(raw.from);
    const to = unix(raw.to);
    if (from !== undefined) census.from = from;
    if (to !== undefined) census.to = to;
  }
  if (census === undefined) return { error: "No census counts in that file." };
  if (Object.keys(census.counts).length === 0) return { error: "No counts of Hunt targets in that file." };
  return { ...census, source: "import", asOf: census.asOf > 0 ? census.asOf : now };
}

/** The census's share of a target (0..1); undefined without a count or a total. */
export function shareOf(census: Census | undefined, key: string): number | undefined {
  const n = census?.counts[key];
  return n !== undefined && census?.characters !== undefined && census.characters > 0
    ? n / census.characters
    : undefined;
}

/** Targets under 1% of the census, as keys (the schedule's `rare`). */
export function rareTargets(census: Census | undefined): string[] {
  if (census === undefined) return [];
  return [...ALL.keys()].filter((k) => {
    const s = shareOf(census, k);
    return s !== undefined && s < RARE_SHARE;
  });
}

/** The census for the pages: its dates, size and source, linked to Everloot. */
export function censusInfo(census: Census | undefined, at: number, stale: boolean): CensusInfo | undefined {
  if (census === undefined) return undefined;
  const out: CensusInfo = {
    at,
    asOf: census.asOf,
    source: census.source,
    stale,
    url: CENSUS_URL,
    licence: CENSUS_LICENCE,
  };
  for (const k of ["from", "to", "characters", "installs", "roundTo"] as const)
    if (census[k] !== undefined) out[k] = census[k];
  return out;
}

// --- the draw --------------------------------------------------------------------------------------------------

/** A day's quarry per hunted faction, as target keys. */
export type HuntPick = Partial<Record<Faction, string>>;

/** Why a target is or isn't in the draw: off (the owner), skipped (under 30 seen, or no count), on. */
export function targetState(
  key: string,
  off: ReadonlySet<string>,
  census: Census | undefined,
): HuntTargetCell["state"] {
  if (off.has(key)) return "off";
  if (census === undefined) return "on";
  const n = census.counts[key];
  return n !== undefined && n >= MIN_SEEN ? "on" : "skipped";
}

/** A target's weight in the draw: its census count; 1 each without a census (every target alike). */
export function weightOf(key: string, off: ReadonlySet<string>, census: Census | undefined): number {
  if (targetState(key, off, census) !== "on") return 0;
  return census === undefined ? 1 : census.counts[key]!;
}

function weightedKey(list: readonly { key: string; weight: number }[], n: number, salt: number): string | undefined {
  const total = list.reduce((a, x) => a + x.weight, 0);
  if (total <= 0) return undefined;
  let k = pick(n, salt, total);
  for (const x of list) {
    k -= x.weight;
    if (k <= 0) return x.key;
  }
  return list[list.length - 1]?.key;
}

/**
 * One day's quarry for a hunted faction: a target in the draw, weighted by its census count, not drawn on the 6 days
 * before (`recent`). Deterministic for a day and a census. When nothing is left: first the 7-day rule goes, then the
 * census (every target that isn't off, alike), then the owner's off; undefined only without targets.
 */
export function drawTarget(
  hunted: Faction,
  n: number,
  recent: readonly string[],
  off: ReadonlySet<string>,
  census: Census | undefined,
): string | undefined {
  const targets = huntTargets(hunted).map((t) => t.key);
  const tries: (() => { key: string; weight: number }[])[] = [
    () => targets.filter((k) => !recent.includes(k)).map((key) => ({ key, weight: weightOf(key, off, census) })),
    () => targets.map((key) => ({ key, weight: weightOf(key, off, census) })),
    () => targets.filter((k) => !off.has(k) && !recent.includes(k)).map((key) => ({ key, weight: 1 })),
    () => targets.map((key) => ({ key, weight: 1 })),
  ];
  for (const t of tries) {
    const key = weightedKey(t(), n, HUNT_SALT[hunted]);
    if (key !== undefined) return key;
  }
  return undefined;
}

export interface HuntPlanInput {
  today: number;
  /** The days planned, in order (from yesterday to 16 days ahead). */
  days: readonly number[];
  /** The stored plan: frozen when locked, as last drawn while free; older days for the 7-day rule. */
  stored: Readonly<Record<number, HuntPick>>;
  /** The owner's pins from the day editor. They win over everything. */
  pins: Readonly<Record<number, HuntPick>>;
  /** Targets the owner switched off. */
  off: ReadonlySet<string>;
  census?: Census;
}

export interface HuntPlannedDay {
  n: number;
  pick: HuntPick;
  pinned: Partial<Record<Faction, boolean>>;
  locked: boolean;
}

/** Today and tomorrow are locked (and every day before them), as the missions (missionPool.ts dayLocked). */
export function huntLocked(n: number, today: number): boolean {
  return n <= today + 1;
}

/**
 * The Hunt over the window. A locked day keeps its stored quarry (a day that has none yet is drawn once, then frozen);
 * a free day is drawn again (`recompute`, after the daily census and every change) or keeps its stored one. Pins win
 * on free days. The 7-day rule looks at the 6 days before each day, stored or just drawn.
 */
export function planHunts(input: HuntPlanInput, recompute = false): HuntPlannedDay[] {
  const picks = new Map<number, HuntPick>();
  for (const [n, p] of Object.entries(input.stored)) picks.set(Number(n), p);
  const out: HuntPlannedDay[] = [];
  for (const n of input.days) {
    const locked = huntLocked(n, input.today);
    const stored = input.stored[n];
    const pin = locked ? {} : (input.pins[n] ?? {});
    const pick: HuntPick = {};
    const pinned: Partial<Record<Faction, boolean>> = {};
    for (const f of FACTIONS) {
      const recent: string[] = [];
      for (let d = n - (NO_REPEAT_DAYS - 1); d < n; d++) {
        const k = picks.get(d)?.[f];
        if (k !== undefined) recent.push(k);
      }
      let key: string | undefined;
      if (pin[f] !== undefined && targetOf(pin[f])?.faction === f) {
        key = pin[f];
        pinned[f] = true;
      } else if (stored?.[f] !== undefined && (locked || !recompute)) key = stored[f];
      else key = drawTarget(f, n, recent, input.off, input.census);
      if (key !== undefined) pick[f] = key;
    }
    picks.set(n, pick);
    out.push({ n, pick, pinned, locked });
  }
  return out;
}

/** The schedule's Hunt per day (keyed by the hunted faction, as ids). */
export function scheduleHuntDays(plan: readonly HuntPlannedDay[]): Record<number, Partial<Record<Faction, TargetIds>>> {
  const out: Record<number, Partial<Record<Faction, TargetIds>>> = {};
  for (const d of plan) {
    const day: Partial<Record<Faction, TargetIds>> = {};
    for (const f of FACTIONS) {
      const t = targetOf(d.pick[f]);
      if (t !== undefined) day[f] = { race: t.raceId, class: t.classId };
    }
    if (Object.keys(day).length > 0) out[d.n] = day;
  }
  return out;
}

/** A planned day for the pages (the calendar line, the 7-day strip). */
export function huntDay(d: HuntPlannedDay): HuntDay {
  const targets: HuntDay["targets"] = {};
  for (const f of FACTIONS) {
    const t = targetOf(d.pick[f]);
    if (t !== undefined) targets[f] = t;
  }
  return { n: d.n, targets, pinned: { ...d.pinned }, locked: d.locked };
}

// --- the Hunt targets grid (MP06) --------------------------------------------------------------------------------

export interface TargetsInput {
  today: number;
  census?: Census;
  /** When the census was stored, and whether the last fetch failed. */
  censusAt?: number;
  stale?: boolean;
  off: ReadonlySet<string>;
  /** Every stored day's quarry (for "last hunted"), today's included. */
  days: Readonly<Record<number, HuntPick>>;
  /** Per target key: friends who had it as their quarry, and how many bagged it. */
  done?: Readonly<Record<string, { had: number; bagged: number }>>;
}

export function huntTargetsView(input: TargetsInput): HuntTargetsView {
  const { census, off } = input;
  const factions = {} as HuntTargetsView["factions"];
  for (const f of FACTIONS) {
    const targets = huntTargets(f);
    const total = targets.reduce((a, t) => a + weightOf(t.key, off, census), 0);
    const races: HuntTargetsView["factions"][Faction]["races"] = [];
    for (const t of targets) {
      const weight = weightOf(t.key, off, census);
      const cell: HuntTargetCell = {
        ...t,
        drawShare: total > 0 ? weight / total : 0,
        state: targetState(t.key, off, census),
        rare: (shareOf(census, t.key) ?? 1) < RARE_SHARE,
        forever: isForever(t),
        today: input.days[input.today]?.[f] === t.key,
      };
      const count = census?.counts[t.key];
      if (count !== undefined) cell.count = count;
      const share = shareOf(census, t.key);
      if (share !== undefined) cell.share = share;
      const last = Object.entries(input.days)
        .map(([n, p]) => ({ n: Number(n), k: p[f] }))
        .filter((x) => x.n < input.today && x.k === t.key)
        .reduce<number | undefined>((a, x) => (a === undefined || x.n > a ? x.n : a), undefined);
      if (last !== undefined) cell.lastHunted = last;
      const d = input.done?.[t.key];
      if (d !== undefined && d.had > 0) cell.donePct = d.bagged / d.had;
      let row = races.find((r) => r.raceId === t.raceId);
      if (row === undefined) {
        row = { raceId: t.raceId, race: t.race, forever: !VANILLA_RACES.has(t.raceToken), cells: [] };
        races.push(row);
      }
      row.cells.push(cell);
    }
    factions[f] = {
      hunter: enemyOf(f),
      races,
      total: targets.length,
      inDraw: targets.filter((t) => weightOf(t.key, off, census) > 0).length,
    };
  }
  const out: HuntTargetsView = { factions };
  const info = censusInfo(census, input.censusAt ?? census?.asOf ?? 0, input.stale ?? false);
  if (info !== undefined) out.census = info;
  return out;
}

const VANILLA_RACES = new Set(["Human", "Dwarf", "NightElf", "Gnome", "Orc", "Scourge", "Tauren", "Troll"]);

// --- Hunt kills (uploads) ----------------------------------------------------------------------------------------

/** One upload's Hunt entry with who and when. */
export interface HuntEntry {
  owner: string;
  guid: string;
  day: number;
  /** The killer's faction (the character's); undefined when unknown. */
  faction?: string;
  hunt: FeedHunt;
}

/** The target a Hunt entry names: by ids when sent (CF-118), else by its race and class tokens. */
export function entryTarget(e: HuntEntry): HuntTarget | undefined {
  const factions: Faction[] =
    e.faction === "Horde" ? ["Alliance"] : e.faction === "Alliance" ? ["Horde"] : ["Alliance", "Horde"];
  const h = e.hunt;
  for (const hunted of factions) {
    if (h.raceId !== undefined && h.classId !== undefined) {
      const t = targetOf(targetKey({ race: h.raceId, class: h.classId }));
      if (t !== undefined && t.faction === hunted) return t;
    }
    if (h.race !== undefined && h.class !== undefined) {
      const t = huntTargets(hunted).find((x) => x.raceToken === h.race && x.classFile === h.class);
      if (t !== undefined) return t;
    }
  }
  return undefined;
}

/**
 * Every Hunt kill, oldest first. `quarryOf(day)`: that day's quarry per hunted faction (the stored plan, or the draw
 * of an older pool version). A kill is the quarry when it is that day's target of the hunted faction.
 */
export function huntKills(entries: readonly HuntEntry[], quarryOf: (day: number) => HuntPick): HuntKill[] {
  const out: HuntKill[] = [];
  for (const e of entries) {
    const target = entryTarget(e);
    const kill: HuntKill = {
      owner: e.owner,
      guid: e.guid,
      day: e.day,
      quarry: target !== undefined && quarryOf(e.day)[target.faction] === target.key,
    };
    if (e.hunt.at !== undefined) kill.at = e.hunt.at;
    if (e.hunt.zone !== undefined) kill.zone = e.hunt.zone;
    if (target !== undefined) kill.target = target;
    out.push(kill);
  }
  return out.sort((a, b) => a.day - b.day || (a.at ?? 0) - (b.at ?? 0) || cmp(a.owner, b.owner));
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// --- per friend ------------------------------------------------------------------------------------------------

/** A friend as the Hunt sees them: the factions of their characters. */
export interface HuntFriend {
  owner: string;
  factions: readonly string[];
}

/** The factions a friend hunts: Horde characters hunt Alliance targets and the other way round. */
export function huntedBy(f: HuntFriend): Faction[] {
  const out: Faction[] = [];
  if (f.factions.includes("Horde")) out.push("Alliance");
  if (f.factions.includes("Alliance")) out.push("Horde");
  // No known faction: the group plays Horde (Nico 2026-10-28), as the engine's Hunts.
  return out.length > 0 ? out : ["Alliance"];
}

export const HUNT_FEATS: readonly { id: HuntFeatId; name: string; text: string }[] = [
  { id: "f.huntFirst", name: "First quarry", text: "Bag your first Hunt target" },
  { id: "f.hunt10", name: "Quarry ×10", text: "Bag 10 Hunt targets" },
  { id: "f.huntClasses", name: "Every class", text: "Bag every class of the other faction" },
  { id: "f.huntAll", name: "Big game", text: "Bag all 28 race and class targets" },
  { id: "f.huntRare", name: "Rare quarry", text: "Bag a target under 1% of the census" },
  { id: "f.huntWeek", name: "Hunter's week", text: "Bag the quarry 7 days in a row" },
];

/** A kill's time for a feat: its own, else the day's number as a stand-in order (never shown as a time). */
const timeOf = (k: HuntKill) => k.at;

/**
 * The six Hunt feats for one friend from their kills. "Bag" in First quarry, ×10 and Hunter's week is a quarry kill;
 * Every class, Big game and Rare quarry count every Hunt kill of a valid target (the trophies). `rare`: target keys
 * under 1% of the census.
 */
export function huntFeats(
  kills: readonly HuntKill[],
  hunted: readonly Faction[],
  rare: ReadonlySet<string>,
): HuntFeatProgress[] {
  const quarries = kills.filter((k) => k.quarry);
  const trophies = kills.filter((k) => k.target !== undefined);
  const feat = (id: HuntFeatId, value: number, target: number, reached: HuntKill | undefined): HuntFeatProgress => {
    const meta = HUNT_FEATS.find((f) => f.id === id)!;
    const out: HuntFeatProgress = { ...meta, value: Math.min(value, target), target, done: reached !== undefined };
    if (reached !== undefined) {
      out.kill = reached;
      const at = timeOf(reached);
      if (at !== undefined) out.at = at;
    }
    return out;
  };
  // The kill that made a count reach `n` (the n-th distinct thing), oldest first.
  const reachedAt = (list: readonly HuntKill[], keyOf: (k: HuntKill) => string, n: number) => {
    const seen = new Set<string>();
    for (const k of list) {
      seen.add(keyOf(k));
      if (seen.size >= n) return k;
    }
    return undefined;
  };

  // Every class / Big game: of either hunted faction, the one the friend is closest on.
  const best = (perFaction: (f: Faction) => { value: number; target: number; reached?: HuntKill }) =>
    hunted
      .map(perFaction)
      .sort(
        (a, b) =>
          Number(b.reached !== undefined) - Number(a.reached !== undefined) || b.value / b.target - a.value / a.target,
      )[0]!;
  const classes = best((f) => {
    const list = trophies.filter((k) => k.target!.faction === f);
    const all = new Set(huntTargets(f).map((t) => t.classId));
    const r = reachedAt(list, (k) => String(k.target!.classId), all.size);
    return { value: new Set(list.map((k) => k.target!.classId)).size, target: all.size, ...(r ? { reached: r } : {}) };
  });
  const big = best((f) => {
    const list = trophies.filter((k) => k.target!.faction === f);
    const all = huntTargets(f).length;
    const r = reachedAt(list, (k) => k.target!.key, all);
    return { value: new Set(list.map((k) => k.target!.key)).size, target: all, ...(r ? { reached: r } : {}) };
  });
  const rareKill = trophies.find((k) => rare.has(k.target!.key));

  // Hunter's week: 7 days in a row with a quarry.
  const days = [...new Set(quarries.map((k) => k.day))].sort((a, b) => a - b);
  let run = 0;
  let longest = 0;
  let weekDay: number | undefined;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1]! + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    if (run >= 7 && weekDay === undefined) weekDay = days[i];
  }
  const weekKill = weekDay !== undefined ? quarries.find((k) => k.day === weekDay) : undefined;

  return [
    feat("f.huntFirst", quarries.length, 1, quarries[0]),
    feat("f.hunt10", quarries.length, 10, quarries[9]),
    feat("f.huntClasses", classes.value, classes.target, classes.reached),
    feat("f.huntAll", big.value, big.target, big.reached),
    feat("f.huntRare", rareKill !== undefined ? 1 : 0, 1, rareKill),
    feat("f.huntWeek", longest, 7, weekKill),
  ];
}

/** A friend's trophies (DS02) for one hunted faction. */
export function trophies(
  owner: string,
  kills: readonly HuntKill[],
  hunted: Faction,
  census: Census | undefined,
  censusAt?: number,
): TrophiesView {
  const mine = kills.filter((k) => k.target?.faction === hunted);
  const races: TrophiesView["races"] = [];
  let rarest: TrophiesView["rarest"];
  for (const t of huntTargets(hunted)) {
    const list = mine.filter((k) => k.target!.key === t.key);
    const seen = census?.counts[t.key];
    const cell = {
      ...t,
      count: list.length,
      scarce: seen !== undefined && seen < SCARCE_SEEN,
    } as TrophiesView["races"][number]["cells"][number];
    if (list.length > 0) cell.last = list[list.length - 1]!.day;
    if (seen !== undefined) {
      cell.seen = seen;
      if (list.length > 0 && (rarest === undefined || seen < rarest.seen)) rarest = { target: t, seen };
    }
    let row = races.find((r) => r.raceId === t.raceId);
    if (row === undefined) races.push((row = { raceId: t.raceId, race: t.race, cells: [] }));
    row.cells.push(cell);
  }
  const out: TrophiesView = {
    owner,
    hunted,
    races,
    distinct: new Set(mine.map((k) => k.target!.key)).size,
    total: huntTargets(hunted).length,
    quarries: kills.filter((k) => k.quarry).length,
  };
  if (rarest !== undefined) out.rarest = rarest;
  const info = censusInfo(census, censusAt ?? census?.asOf ?? 0, false);
  if (info !== undefined) out.census = info;
  return out;
}

export interface FriendHuntInput {
  friend: HuntFriend;
  /** Every Hunt kill of the group (only this friend's are used). */
  kills: readonly HuntKill[];
  today: number;
  census?: Census;
  censusAt?: number;
  /** Days the friend's goal records have the Hunt done (an addon without `hunts[]` kills still marks it). */
  doneDays?: ReadonlySet<number>;
}

/** Everything the Doomsday pages show of one friend's Hunt. */
export function friendHunt(input: FriendHuntInput): FriendHuntView {
  const { friend, today, census } = input;
  const kills = input.kills.filter((k) => k.owner === friend.owner);
  const hunted = huntedBy(friend);
  const quarries = kills.filter((k) => k.quarry);
  const todayKill = quarries.find((k) => k.day === today);
  const week = weekOf(today);
  const first = weekStart(week);
  const weekDays = new Set([
    ...quarries.filter((k) => k.day >= first && k.day <= today).map((k) => k.day),
    ...[...(input.doneDays ?? [])].filter((d) => d >= first && d <= today),
  ]);
  const out: FriendHuntView = {
    owner: friend.owner,
    hunts: hunted,
    todayDone: todayKill !== undefined || (input.doneDays?.has(today) ?? false),
    bagged: [...quarries].reverse(),
    trophies: trophies(friend.owner, kills, hunted[0]!, census, input.censusAt),
    weekDays: weekDays.size,
    feats: huntFeats(kills, hunted, new Set(rareTargets(census))),
  };
  if (todayKill !== undefined) out.todayKill = todayKill;
  return out;
}

/** "Hunt · this week": friends ranked by days with the quarry bagged, then by person key; friends without one left out. */
export function huntWeek(friends: readonly FriendHuntView[]): HuntWeekRow[] {
  return friends
    .filter((f) => f.weekDays > 0)
    .map((f) => ({ owner: f.owner, days: f.weekDays }))
    .sort((a, b) => b.days - a.days || cmp(a.owner, b.owner));
}

/** The Hunt today box (DS01) and the quarry cards. */
export function huntToday(
  today: number,
  plan: Readonly<Record<number, HuntPick>>,
  friends: readonly FriendHuntView[],
  census: Census | undefined,
  censusAt?: number,
): HuntTodayView {
  const quarry: HuntTodayView["quarry"] = {};
  const tomorrow: HuntTodayView["tomorrow"] = {};
  const info = censusInfo(census, censusAt ?? census?.asOf ?? 0, false);
  for (const f of FACTIONS) {
    const t = targetOf(plan[today]?.[f]);
    if (t !== undefined) {
      const hunters = friends.filter((x) => x.hunts.includes(f));
      const q: QuarryView = { n: today, target: t, points: HUNT_POINTS };
      const seen = census?.counts[t.key];
      if (seen !== undefined) q.seen = seen;
      if (info !== undefined) q.census = info;
      if (hunters.length > 0) q.doneToday = hunters.filter((x) => x.todayDone).length / hunters.length;
      quarry[f] = q;
    }
    const next = targetOf(plan[today + 1]?.[f]);
    if (next !== undefined) tomorrow[f] = next;
  }
  const at = (x: FriendHuntView) => x.todayKill?.at ?? Number.MAX_SAFE_INTEGER;
  const sorted = [...friends].sort(
    (a, b) => Number(b.todayDone) - Number(a.todayDone) || at(a) - at(b) || cmp(a.owner, b.owner),
  );
  return {
    n: today,
    quarry,
    tomorrow,
    friends: sorted.map((x) =>
      x.todayKill !== undefined ? { owner: x.owner, kill: x.todayKill } : { owner: x.owner },
    ),
    bagged: friends.filter((x) => x.todayDone).length,
    total: friends.length,
  };
}

/** Per target: friends who had it as quarry (per day they played) and how many bagged it, for MP06's "done %". */
export function targetDone(
  plan: Readonly<Record<number, HuntPick>>,
  kills: readonly HuntKill[],
  hunters: Readonly<Record<number, readonly HuntFriend[]>>,
): Record<string, { had: number; bagged: number }> {
  const out: Record<string, { had: number; bagged: number }> = {};
  for (const [n, pickOfDay] of Object.entries(plan)) {
    const day = Number(n);
    for (const f of FACTIONS) {
      const key = pickOfDay[f];
      if (key === undefined) continue;
      const who = (hunters[day] ?? []).filter((x) => huntedBy(x).includes(f));
      if (who.length === 0) continue;
      const s = (out[key] ??= { had: 0, bagged: 0 });
      s.had += who.length;
      s.bagged += who.filter((x) =>
        kills.some((k) => k.owner === x.owner && k.day === day && k.quarry && k.target?.key === key),
      ).length;
    }
  }
  return out;
}
