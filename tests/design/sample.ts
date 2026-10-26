// The design checks' sample data (WEB-30): the invented friends of docs/DESIGN-PROMPT.md ("Sample data"), never real
// people, written as the SavedVariables `global` table the addon writes (docs/SOURCE-DATA.md) with times relative to
// a fixed "now". tests/design/seed.setup.ts uploads it through the real upload route as the admin, Nico.
// The community is called Doombringers, the name on the boards (docs/DESIGN.md §1).

/** The design server's "now" (FIXED_NOW): 2026-11-19 20:00 UTC, a Thursday evening. */
export const NOW = 1795118400;

export const ADMIN = "Nico#2201";

const H = 3600;
const D = 24 * H;
const REALM = "Forever PvP";

// Talent tree names of Vanilla (the game client's talent tabs, English), in the client's order.
const TREES: Record<string, [string, string, string]> = {
  WARRIOR: ["Arms", "Fury", "Protection"],
  PALADIN: ["Holy", "Protection", "Retribution"],
  HUNTER: ["Beast Mastery", "Marksmanship", "Survival"],
  ROGUE: ["Assassination", "Combat", "Subtlety"],
  PRIEST: ["Discipline", "Holy", "Shadow"],
  SHAMAN: ["Elemental", "Enhancement", "Restoration"],
  MAGE: ["Arcane", "Fire", "Frost"],
  WARLOCK: ["Affliction", "Demonology", "Destruction"],
  DRUID: ["Balance", "Feral Combat", "Restoration"],
};

// skillLineIDs of src/core/gamedata/professions.ts.
const SKILL: Record<string, number> = {
  Alchemy: 171,
  Blacksmithing: 164,
  Enchanting: 333,
  Engineering: 202,
  Herbalism: 182,
  Leatherworking: 165,
  Mining: 186,
  Skinning: 393,
  Tailoring: 197,
  Cooking: 185,
  "First Aid": 129,
  Fishing: 356,
};

// raceIDs of src/core/gamedata/races.ts.
const RACE = { Human: 1, Orc: 2, "Night Elf": 4, Undead: 5, Tauren: 6, Troll: 8 } as const;

interface Sample {
  guid: string;
  name: string;
  classFile: keyof typeof TREES;
  race: keyof typeof RACE;
  faction: "Horde" | "Alliance";
  level: number;
  ilvl?: number;
  role: "tank" | "heal" | "dps";
  talents: [number, number, number];
  professions: [string, number, number][];
  /** Seconds before NOW. */
  lastPlayed: number;
  /** Zone and seconds before NOW; none for a character never seen. */
  seen?: [string, number];
  /** Made this many seconds before NOW: missing from earlier sample files (a new character). */
  made?: number;
}

const NICO: Sample[] = [
  {
    guid: "Player-1-0000A001",
    name: "Ves Doombringer",
    classFile: "WARLOCK",
    race: "Undead",
    faction: "Horde",
    level: 39,
    ilvl: 34,
    role: "dps",
    talents: [10, 0, 20],
    professions: [
      ["Tailoring", 187, 225],
      ["Enchanting", 160, 225],
      ["Cooking", 75, 150],
    ],
    lastPlayed: 2 * H,
    seen: ["Stranglethorn Vale", 2 * H],
  },
  {
    guid: "Player-1-0000A002",
    name: "Grom Ashfeller",
    classFile: "WARRIOR",
    race: "Orc",
    faction: "Horde",
    level: 24,
    ilvl: 21,
    role: "tank",
    talents: [5, 0, 10],
    professions: [
      ["Mining", 142, 150],
      ["Blacksmithing", 120, 150],
    ],
    lastPlayed: 3 * D,
    seen: ["The Barrens", 3 * D],
  },
  {
    guid: "Player-1-0000A003",
    name: "Sela Moonbrook",
    classFile: "DRUID",
    race: "Night Elf",
    faction: "Alliance",
    level: 12,
    role: "heal",
    talents: [0, 0, 3],
    professions: [["Herbalism", 61, 75]],
    lastPlayed: 14 * D,
  },
];

const FRIENDS: { battleTag: string; displayName: string; receivedAgo: number; via?: string; chars: Sample[] }[] = [
  {
    battleTag: "Bob#2002",
    displayName: "Bob",
    receivedAgo: 5 * H,
    chars: [
      {
        guid: "Player-1-0000B001",
        name: "Bob Example",
        classFile: "ROGUE",
        race: "Troll",
        faction: "Horde",
        level: 41,
        ilvl: 36,
        role: "dps",
        talents: [4, 28, 0],
        professions: [
          ["Skinning", 210, 225],
          ["Leatherworking", 201, 225],
        ],
        lastPlayed: 5 * H,
        seen: ["The Deadmines", 5 * H],
      },
      {
        guid: "Player-1-0000B002",
        name: "Tok Ironhide",
        classFile: "SHAMAN",
        race: "Tauren",
        faction: "Horde",
        level: 33,
        ilvl: 29,
        role: "heal",
        talents: [0, 5, 19],
        professions: [
          ["Alchemy", 160, 225],
          ["Herbalism", 175, 225],
          ["First Aid", 225, 225],
        ],
        lastPlayed: 1 * D,
        seen: ["Hillsbrad Foothills", 1 * D],
        made: 1.5 * D,
      },
    ],
  },
  {
    battleTag: "Mira#1188",
    displayName: "Mira",
    receivedAgo: 2 * D,
    via: "Bob#2002",
    chars: [
      {
        guid: "Player-1-0000C001",
        name: "Mira Sunstrider",
        classFile: "MAGE",
        race: "Undead",
        faction: "Horde",
        level: 60,
        ilvl: 58,
        role: "dps",
        talents: [10, 0, 41],
        professions: [
          ["Tailoring", 300, 300],
          ["Enchanting", 285, 300],
          ["Fishing", 240, 300],
        ],
        lastPlayed: 2 * D,
        seen: ["Orgrimmar", 2 * D],
      },
      {
        guid: "Player-1-0000C002",
        name: "Kel Dawnhammer",
        classFile: "PALADIN",
        race: "Human",
        faction: "Alliance",
        level: 18,
        ilvl: 16,
        role: "tank",
        talents: [0, 9, 0],
        professions: [
          ["Mining", 88, 150],
          ["Engineering", 70, 150],
        ],
        lastPlayed: 7 * D,
        seen: ["Westfall", 7 * D],
      },
    ],
  },
  {
    battleTag: "Jorrit#4410",
    displayName: "Jorrit",
    receivedAgo: 9 * D,
    via: "Mira#1188",
    chars: [
      {
        guid: "Player-1-0000D001",
        name: "Ruk Bloodhoof",
        classFile: "HUNTER",
        race: "Tauren",
        faction: "Horde",
        level: 27,
        ilvl: 24,
        role: "dps",
        talents: [18, 0, 0],
        professions: [
          ["Skinning", 150, 150],
          ["Mining", 131, 150],
        ],
        lastPlayed: 9 * D,
        seen: ["Stonetalon Mountains", 9 * D],
      },
    ],
  },
  {
    battleTag: "Femke#3307",
    displayName: "Femke",
    receivedAgo: 1 * H,
    chars: [
      {
        guid: "Player-1-0000E001",
        name: "Lia Thornwhisper",
        classFile: "PRIEST",
        race: "Troll",
        faction: "Horde",
        level: 37,
        ilvl: 32,
        role: "heal",
        talents: [21, 7, 0],
        professions: [
          ["Tailoring", 205, 225],
          ["Cooking", 150, 225],
        ],
        lastPlayed: 1 * H,
        seen: ["Stranglethorn Vale", 1 * H],
      },
      {
        guid: "Player-1-0000E002",
        name: "Zul Kazrek",
        classFile: "WARLOCK",
        race: "Orc",
        faction: "Horde",
        level: 15,
        ilvl: 12,
        role: "dps",
        talents: [6, 0, 0],
        professions: [],
        lastPlayed: 4 * D,
        seen: ["Durotar", 4 * D],
      },
    ],
  },
];

type Lua = string | number | boolean | Lua[] | { [key: string]: Lua };

/** A Lua table literal in the game's style: every key bracketed, numeric keys as numbers. */
function lua(value: Lua, indent = ""): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value !== "object") return String(value);
  const inner = indent + "  ";
  const items = Array.isArray(value)
    ? value.map((v) => `${inner}${lua(v, inner)},`)
    : Object.entries(value).map(([k, v]) => `${inner}[${/^\d+$/.test(k) ? k : JSON.stringify(k)}] = ${lua(v, inner)},`);
  return items.length === 0 ? "{}" : `{\n${items.join("\n")}\n${indent}}`;
}

function char(c: Sample, now: number): Lua {
  const trees = TREES[c.classFile]!;
  const most = c.talents.indexOf(Math.max(...c.talents));
  return {
    classFile: c.classFile,
    faction: c.faction,
    guid: c.guid,
    ...(c.ilvl !== undefined && { ilvl: c.ilvl }),
    lastPlayed: now - c.lastPlayed,
    level: c.level,
    mainTree: most + 1,
    name: c.name,
    professions: Object.fromEntries(c.professions.map(([name, rank, max]) => [SKILL[name]!, { max, name, rank }])),
    raceID: RACE[c.race],
    realm: REALM,
    role: c.role,
    talents: trees.map((name, i) => ({ name, points: c.talents[i]! })),
    updatedAt: now - c.lastPlayed,
  };
}

/** Days of sample files: day 3 is the design sample; days 1 and 2 are the same group one and two days earlier. */
export type SampleDay = 1 | 2 | 3;

/**
 * A character as a file written `ago` seconds before "now" saw it (WEB-21 sample files): not there before it was
 * made; one level, a few skill points and an item level lower for every day boundary it has been played across
 * since, last played and seen a few hours before that file.
 */
function asOf(c: Sample, ago: number): Sample | undefined {
  if (ago === 0) return c;
  if (c.made !== undefined && c.made <= ago) return undefined;
  let steps = 0;
  for (let k = D; k <= ago; k += D) if (c.lastPlayed < k) steps++;
  if (steps === 0) return c;
  const before = ago + 3 * H;
  const most = c.talents.indexOf(Math.max(...c.talents));
  return {
    ...c,
    level: Math.max(1, c.level - steps),
    ...(c.ilvl !== undefined && { ilvl: Math.max(1, c.ilvl - steps) }),
    talents: c.talents.map((t, i) => (i === most ? Math.max(0, t - steps) : t)) as Sample["talents"],
    professions: c.professions.map(([name, rank, max]) => [name, Math.max(1, rank - 6 * steps), max]),
    lastPlayed: before,
    ...(c.seen !== undefined && { seen: [c.seen[0], before] }),
  };
}

export interface SampleOptions {
  /** The uploader's BattleTag (`self.battleTag`); the admin by default. */
  self?: string;
  /** Unix seconds every time is relative to; the design checks' NOW by default. */
  now?: number;
  /** Which of the consecutive days' files; 3 (the design sample) by default. */
  day?: SampleDay;
}

/** The sample as the SavedVariables file the game writes. */
export function sampleSavedVariables({ self = ADMIN, now = NOW, day = 3 }: SampleOptions = {}): string {
  const ago = (3 - day) * D;
  const later = (t: number) => (ago === 0 ? t : Math.max(t, ago + H));
  const mine = NICO.map((c) => asOf(c, ago)).filter((c) => c !== undefined);
  const friends = FRIENDS.map((f) => ({ ...f, chars: f.chars.map((c) => asOf(c, ago)).filter((c) => c !== undefined) }));
  const all = [...mine, ...friends.flatMap((f) => f.chars)];
  const locations: Record<string, Lua> = {};
  for (const c of all) if (c.seen !== undefined) locations[c.guid] = { seenAt: now - c.seen[1], zone: c.seen[0] };
  const presence: Record<string, Lua> = {};
  for (const f of friends) for (const c of f.chars) presence[c.guid] = { battleTag: f.battleTag, lastSeen: now - c.lastPlayed };
  // Sanne is in the community but doesn't run the addon: one character seen online, no record.
  presence["Player-1-0000F001"] = { battleTag: "Sanne#5150", lastSeen: now - later(3 * D) };

  const global: Lua = {
    locations,
    people: Object.fromEntries(
      friends.map((f) => [
        f.battleTag,
        {
          chars: Object.fromEntries(f.chars.map((c) => [c.guid, char(c, now)])),
          displayName: f.displayName,
          receivedAt: now - later(f.receivedAgo),
          ...(f.via !== undefined && { via: f.via }),
          version: now - later(f.receivedAgo),
        },
      ]),
    ),
    presence,
    schemaVersion: 1,
    self: {
      battleTag: self,
      chars: Object.fromEntries(mine.map((c) => [c.guid, char(c, now)])),
      displayName: "Nico",
      version: now - ago - H,
    },
    settings: { clubId: "40000001", clubName: "Doombringers" },
  };
  return `
CommunitiesForeverDB = {
  ["global"] = ${lua(global, "  ")},
}
`;
}
