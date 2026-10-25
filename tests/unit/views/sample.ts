import { parseLua } from "@/core/lua";
import type { Dataset } from "@/core/model";
import { normalize } from "@/core/normalize";

// The design prompt's invented group (docs/DESIGN-PROMPT.md "Data you can design with"), as an upload by Nico:
// what the boards show, so the view models can be checked against them. Times are relative to NOW.

export const NOW = 1_800_000_000;
export const H = 3600;
export const D = 24 * H;

interface Char {
  guid: string;
  name: string;
  classFile: string;
  raceID: number;
  faction: string;
  level: number;
  ilvl?: number;
  role: string;
  talents: [string, number][];
  mainTree: number;
  /** [skill line, rank, max] */
  professions: [number, number, number][];
  played: number;
  seen?: [string, number];
}

const lua = (value: unknown): string => {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `{ ${value.map(lua).join(", ")} }`;
  const entries = Object.entries(value as object).filter(([, v]) => v !== undefined);
  return `{ ${entries.map(([k, v]) => `[${/^\d+$/.test(k) ? k : JSON.stringify(k)}] = ${lua(v)}`).join(", ")} }`;
};

const char = (c: Char) => ({
  guid: c.guid,
  name: c.name,
  classFile: c.classFile,
  raceID: c.raceID,
  faction: c.faction,
  level: c.level,
  ilvl: c.ilvl,
  role: c.role,
  realm: "Forever PvP",
  talents: c.talents.map(([name, points]) => ({ name, points })),
  mainTree: c.mainTree,
  professions: Object.fromEntries(c.professions.map(([id, rank, max]) => [id, { rank, max }])),
  lastPlayed: NOW - c.played,
  updatedAt: NOW - c.played,
});

export const VES: Char = {
  guid: "Player-1-VES",
  name: "Ves Doombringer",
  classFile: "WARLOCK",
  raceID: 5,
  faction: "Horde",
  level: 39,
  ilvl: 34,
  role: "dps",
  talents: [
    ["Affliction", 10],
    ["Demonology", 0],
    ["Destruction", 20],
  ],
  mainTree: 3,
  professions: [
    [197, 187, 225],
    [333, 160, 225],
    [185, 75, 150],
  ],
  played: 2 * H,
  seen: ["Stranglethorn Vale", 2 * H],
};

const NICO: Char[] = [
  VES,
  {
    guid: "Player-1-GROM",
    name: "Grom Ashfeller",
    classFile: "WARRIOR",
    raceID: 2,
    faction: "Horde",
    level: 24,
    ilvl: 21,
    role: "tank",
    talents: [
      ["Arms", 5],
      ["Fury", 0],
      ["Protection", 10],
    ],
    mainTree: 3,
    professions: [
      [186, 142, 150],
      [164, 120, 150],
    ],
    played: 3 * D,
    seen: ["The Barrens", 3 * D],
  },
  {
    guid: "Player-1-SELA",
    name: "Sela Moonbrook",
    classFile: "DRUID",
    raceID: 4,
    faction: "Alliance",
    level: 12,
    role: "heal",
    talents: [
      ["Balance", 0],
      ["Feral Combat", 0],
      ["Restoration", 3],
    ],
    mainTree: 3,
    professions: [[182, 61, 75]],
    played: 14 * D,
  },
];

const BOB: Char[] = [
  {
    guid: "Player-1-BOB",
    name: "Bob Example",
    classFile: "ROGUE",
    raceID: 8,
    faction: "Horde",
    level: 41,
    ilvl: 36,
    role: "dps",
    talents: [
      ["Assassination", 4],
      ["Combat", 28],
      ["Subtlety", 0],
    ],
    mainTree: 2,
    professions: [
      [393, 210, 225],
      [165, 201, 225],
    ],
    played: 5 * H,
    seen: ["The Deadmines", 5 * H],
  },
  {
    guid: "Player-1-TOK",
    name: "Tok Ironhide",
    classFile: "SHAMAN",
    raceID: 6,
    faction: "Horde",
    level: 33,
    ilvl: 29,
    role: "heal",
    talents: [
      ["Elemental", 0],
      ["Enhancement", 5],
      ["Restoration", 19],
    ],
    mainTree: 3,
    professions: [
      [171, 160, 225],
      [182, 175, 225],
      [129, 225, 225],
    ],
    played: 23 * H,
    seen: ["Hillsbrad Foothills", 23 * H],
  },
];

const MIRA: Char[] = [
  {
    guid: "Player-1-MIRA",
    name: "Mira Sunstrider",
    classFile: "MAGE",
    raceID: 5,
    faction: "Horde",
    level: 60,
    ilvl: 58,
    role: "dps",
    talents: [
      ["Arcane", 10],
      ["Fire", 0],
      ["Frost", 41],
    ],
    mainTree: 3,
    professions: [
      [197, 300, 300],
      [333, 285, 300],
      [356, 240, 300],
    ],
    played: 2 * D,
    seen: ["Orgrimmar", 2 * D],
  },
  {
    guid: "Player-1-KEL",
    name: "Kel Dawnhammer",
    classFile: "PALADIN",
    raceID: 1,
    faction: "Alliance",
    level: 18,
    ilvl: 16,
    role: "tank",
    talents: [
      ["Holy", 0],
      ["Protection", 9],
      ["Retribution", 0],
    ],
    mainTree: 2,
    professions: [
      [186, 88, 150],
      [202, 70, 150],
    ],
    played: 7 * D,
    seen: ["Westfall", 7 * D],
  },
];

const JORRIT: Char[] = [
  {
    guid: "Player-1-RUK",
    name: "Ruk Bloodhoof",
    classFile: "HUNTER",
    raceID: 6,
    faction: "Horde",
    level: 27,
    ilvl: 24,
    role: "dps",
    talents: [
      ["Beast Mastery", 18],
      ["Marksmanship", 0],
      ["Survival", 0],
    ],
    mainTree: 1,
    professions: [
      [393, 150, 150],
      [186, 131, 150],
    ],
    played: 9 * D,
    seen: ["Stonetalon Mountains", 9 * D],
  },
];

const FEMKE: Char[] = [
  {
    guid: "Player-1-LIA",
    name: "Lia Thornwhisper",
    classFile: "PRIEST",
    raceID: 8,
    faction: "Horde",
    level: 37,
    ilvl: 32,
    role: "heal",
    talents: [
      ["Discipline", 21],
      ["Holy", 7],
      ["Shadow", 0],
    ],
    mainTree: 1,
    professions: [
      [197, 205, 225],
      [185, 150, 225],
    ],
    played: 1 * H,
    seen: ["Stranglethorn Vale", 1 * H],
  },
  {
    guid: "Player-1-ZUL",
    name: "Zul Kazrek",
    classFile: "WARLOCK",
    raceID: 2,
    faction: "Horde",
    level: 15,
    ilvl: 12,
    role: "dps",
    talents: [
      ["Affliction", 6],
      ["Demonology", 0],
      ["Destruction", 0],
    ],
    mainTree: 1,
    professions: [],
    played: 4 * D,
    seen: ["Durotar", 4 * D],
  },
];

const chars = (list: Char[]) => Object.fromEntries(list.map((c) => [c.guid, char(c)]));
const ALL = [...NICO, ...BOB, ...MIRA, ...JORRIT, ...FEMKE];

/** The global table as Lua, with optional changes (for before/after tests). */
export function sampleLua(): string {
  const global = {
    schemaVersion: 1,
    settings: { clubId: 40000001, clubName: "Thursday Raiders" },
    self: { battleTag: "Nico#2201", displayName: "Nico", version: NOW, chars: chars(NICO) },
    people: {
      "Bob#2002": { version: NOW - 5 * H, receivedAt: NOW - 5 * H, chars: chars(BOB) },
      "Mira#1188": { version: NOW - 2 * D, receivedAt: NOW - D, via: "Bob#2002", chars: chars(MIRA) },
      "Jorrit#4410": { version: NOW - 9 * D, receivedAt: NOW - 8 * D, via: "Mira#1188", chars: chars(JORRIT) },
      "Femke#3307": { version: NOW - H, receivedAt: NOW - H, chars: chars(FEMKE) },
    },
    // Sanne is in the group without the addon: only her Battle.net presence is known, never sighted.
    presence: { "Player-1-SANNE": { battleTag: "Sanne#5150", lastSeen: NOW - 3 * H } },
    locations: Object.fromEntries(
      ALL.filter((c) => c.seen !== undefined).map((c) => [c.guid, { zone: c.seen![0], seenAt: NOW - c.seen![1] }]),
    ),
  };
  return `return ${lua(global)}`;
}

export function sample(): Dataset {
  return normalize(parseLua(sampleLua()));
}
