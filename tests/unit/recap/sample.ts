import type { FeedDay } from "@/core/feed";
import type { History, RecapChar, Week, WeekSighting } from "@/core/recap/types";

// WEB-41: sample weeks for the recap tests. RICH meets every card's threshold (week 10, so the season cards too);
// EMPTY meets none. Made-up names only (CLAUDE.md rule 7).

const DAY = 86400;
/** Sunday 1 Nov 2026 12:00 UTC: the end of week 10. */
export const END = 1793534400;
export const START = END - 7 * DAY;
/** Realm day of the week's Monday. */
const D = Math.floor(START / DAY) + 1;

const char = (c: Partial<RecapChar> & Pick<RecapChar, "guid" | "owner" | "name">): RecapChar => ({
  professions: [],
  quests: [],
  ...c,
});

const SHARED = ["q1", "q2", "q3", "q4", "q5", "q6"];

const before: Record<string, RecapChar> = {
  ada1: char({
    guid: "ada1",
    owner: "ada",
    name: "Ada Example",
    classFile: "MAGE",
    race: "Undead",
    faction: "Horde",
    level: 50,
    ilvl: 40,
    professions: [
      { name: "Tailoring", rank: 160, max: 225 },
      { name: "Enchanting", rank: 100, max: 150 },
    ],
    spec: "Frost",
    role: "dps",
  }),
  bob1: char({
    guid: "bob1",
    owner: "bob",
    name: "Bob Example",
    classFile: "ROGUE",
    race: "Undead",
    faction: "Horde",
    level: 30,
    ilvl: 25,
    professions: [
      { name: "Alchemy", rank: 140, max: 150 },
      { name: "Herbalism", rank: 150, max: 150 },
    ],
    spec: "Combat",
    role: "dps",
  }),
  cid1: char({
    guid: "cid1",
    owner: "cid",
    name: "Cid Example",
    classFile: "WARLOCK",
    race: "Orc",
    faction: "Horde",
    level: 28,
    spec: "Affliction",
    role: "tank",
    quests: [...SHARED, "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10"],
  }),
  cid2: char({
    guid: "cid2",
    owner: "cid",
    name: "Cid Second",
    classFile: "WARLOCK",
    race: "Orc",
    faction: "Horde",
    level: 8,
    spec: "Affliction",
  }),
  dee1: char({
    guid: "dee1",
    owner: "dee",
    name: "Dee Example",
    classFile: "PALADIN",
    race: "Human",
    faction: "Alliance",
    level: 33,
    professions: [{ name: "Tailoring", rank: 165, max: 225 }],
    spec: "Holy",
    role: "heal",
    quests: [...SHARED],
  }),
};

const after: Record<string, RecapChar> = {
  ada1: {
    ...before.ada1!,
    level: 60,
    ilvl: 48,
    professions: [
      { name: "Tailoring", rank: 180, max: 225 },
      { name: "Enchanting", rank: 100, max: 150 },
    ],
  },
  ada2: char({
    guid: "ada2",
    owner: "ada",
    name: "Ada Second",
    classFile: "PRIEST",
    race: "Troll",
    faction: "Horde",
    level: 12,
  }),
  bob1: {
    ...before.bob1!,
    level: 36,
    professions: [
      { name: "Alchemy", rank: 150, max: 150 },
      { name: "Herbalism", rank: 150, max: 150 },
    ],
  },
  cid1: { ...before.cid1!, level: 31, quests: [...before.cid1!.quests, "c11", "c12", "c13", "c14"] },
  cid2: { ...before.cid2! },
  dee1: { ...before.dee1!, level: 35, professions: [{ name: "Tailoring", rank: 172, max: 225 }] },
};

const day = (n: number, guid: string, owner: string, entry: Partial<FeedDay> = {}) => ({
  day: D + n,
  guid,
  owner,
  entry: { quests: {}, ranks: {}, learned: [], runs: [], at: START + (n + 1) * DAY, ...entry },
});

const seen = (guid: string, zone: string, n: number): WeekSighting => ({ guid, zone, seenAt: START + n * DAY + 3600 });

export const RICH: Week = {
  number: 10,
  start: START,
  end: END,
  siteName: "Doombringers",
  friends: [
    { key: "ada", name: "Ada", shares: true },
    { key: "bob", name: "Bob", shares: true },
    { key: "cid", name: "Cid", shares: true },
    { key: "dee", name: "Dee", shares: true },
  ],
  before,
  after,
  days: [
    day(0, "ada1", "ada", {
      quests: { "Stranglethorn Vale": 4 },
      runs: [{ name: "The Deadmines", kind: "party", with: ["bob1"] }],
    }),
    day(1, "ada1", "ada", {
      quests: { "Stranglethorn Vale": 3 },
      runs: [{ name: "The Deadmines", kind: "party", with: ["bob1"] }],
    }),
    day(2, "ada1", "ada"),
    day(3, "ada1", "ada"),
    day(1, "ada2", "ada"),
    day(1, "bob1", "bob"),
    day(1, "cid1", "cid"),
  ],
  sightings: [
    seen("ada1", "Stranglethorn Vale", 1),
    seen("ada1", "Orgrimmar", 2),
    seen("ada1", "Un'Goro Crater", 3),
    seen("bob1", "Stranglethorn Vale", 2),
    seen("dee1", "Elwynn Forest", 1),
    seen("dee1", "Elwynn Forest", 2),
    seen("dee1", "Elwynn Forest", 4),
  ],
  zonesBefore: ["Durotar", "The Barrens", "Stranglethorn Vale", "Orgrimmar", "Elwynn Forest"],
  totalZones: 39,
  lastSeen: {
    ada1: seen("ada1", "Un'Goro Crater", 3),
    bob1: seen("bob1", "Stranglethorn Vale", 2),
    dee1: seen("dee1", "Elwynn Forest", 4),
    cid2: { guid: "cid2", zone: "Durotar", seenAt: END - 20 * DAY },
  },
  monthAgo: [seen("ada1", "Durotar", -27), seen("bob1", "The Barrens", -27)],
  lastActiveBefore: { dee: START - 20 * DAY, ada: START - DAY },
};

export const EMPTY: Week = {
  number: 3,
  start: START,
  end: END,
  siteName: "Doombringers",
  friends: [],
  before: {},
  after: {},
  days: [],
  sightings: [],
  zonesBefore: [],
  totalZones: 39,
  lastSeen: {},
  monthAgo: [],
  lastActiveBefore: {},
};

/** Weeks 1 to 9: week 1 has the totals, week 6 a prediction (checked in week 10). */
export const HISTORY: History = {
  weeks: Array.from({ length: 9 }, (_, i) => {
    const number = i + 1;
    return {
      number,
      cards: [],
      values: {},
      levelsByFriend: { ada: 3, bob: 1 },
      ...(number === 1 ? { totals: { characters: 3, levelSum: 40, at60: 0 } } : {}),
      ...(number === 6 ? { prediction: { guid: "bob1", name: "Bob Example", level: 25, weeks: 7 } } : {}),
    };
  }),
  cycles: {},
};

export const NO_HISTORY: History = { weeks: [], cycles: {} };
