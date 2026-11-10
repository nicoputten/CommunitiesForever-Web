import type { Goal } from "./rules";

// Pool version 6 (WEB-108, addon CF-118): the 50 PvP dailies of Mission pool v2 and the Duel slot's pool. Source: the
// pool-6 contract (CF-118 / WEB-108 / WEB-109 / WEB-110, 2026-11-10, "Decisions 2026-11-10") and its list of the 50
// new PvP dailies; the addon's src/core/Doomsday.lua (CF-118) is the catalogue's source of truth, and this file
// follows it.
//
// Ids are never reused for another meaning. A condition the catalogue already had is that id (REUSED): it joins the
// pool from version 6 with its current text and points (pool 4/5 scoring unchanged). Payback (p.revenge), Clean 5
// (p.untouchable) and Untouchable (p.flagHour) are in the pool already. A different condition is a new id (NEW_GOALS).
// Short names: at most 10 characters (WEB-66, the bot's images); the list's longer ones are cut until CF-118 names
// them. `check`: needs a test on Forever first; in the pool, but Off until the owner switches it on.

/** The pool version these join. */
export const POOL6 = 6;

/** Existing catalogue ids that join the pool from version 6 (their own text and points). */
export const REUSED: Readonly<Record<string, Partial<Goal>>> = {
  "p.kills10": { since: 6 }, // 10 HKs
  "p.punchUp5": { since: 6 }, // Giant
  "p.variety": { since: 6 }, // 3 classes
  "p.fairFight": { since: 6 },
  "p.mirror": { since: 6 },
  "p.races3": { since: 6 },
  "p.enemyLand": { since: 6 }, // Deep strike
  "p.zones3": { since: 6 }, // Roamer
  "p.trioKills": { since: 6 }, // War party
  "p.avenge": { since: 6, check: true }, // Avenger: a friend's killer isn't synced
  // The Duel slot's pool: a kind of its own from version 6.
  "p.duelWin": { since: 6, slot: "duel" },
  "p.duelUp": { since: 6, slot: "duel" }, // Underdog
};

type New = Omit<Goal, "slot" | "since"> & { slot?: Goal["slot"] };

const kill = (id: string, points: number, text: string, short: string, category: string, check = false): New => ({
  id,
  category,
  points,
  text,
  short,
  needs: "kill",
  ...(check ? { check: true } : {}),
});
const duel = (id: string, points: number, text: string, short: string): New => ({
  id,
  slot: "duel",
  category: "duels",
  points,
  text,
  short,
  needs: "duel",
});

/** The new missions, in the list's order. Skirmish unless `slot` says Duel. */
const LIST: readonly New[] = [
  // Kills
  kill("p.hk3", 3, "Win 3 honorable kills", "3 HKs", "kills"),
  kill("p.upLevel", 3, "Kill an enemy above your level", "Up a level", "kills"),
  kill("p.healerDown", 3, "Kill an enemy healer class", "Healer KO", "kills"),
  kill("p.double30", 5, "Kill 2 enemies within 30 sec", "Double 30", "kills"),
  kill("p.closeCall", 5, "Kill an enemy while under 20% health", "Close call", "kills", true),
  // Hunt-like
  kill("p.closeEnough", 3, "Kill an enemy of today's quarry race", "Near miss", "huntLike"),
  kill("p.halfHunt", 3, "Kill an enemy of today's quarry class", "Half hunt", "huntLike"),
  kill("p.rareQuarry", 5, "Kill an enemy of a rare race and class (Everloot census)", "Rare prey", "huntLike"),
  // Duels (the Duel slot); "First duel with each friend" scores its per-pair duel points, not goal points.
  duel("p.duelFirst", 0, "First duel with each friend", "1st duels"),
  duel("p.duel3", 5, "Win 3 duels", "3 duels"),
  duel("p.spar", 1, "Duel a friend", "Spar"),
  duel("p.styles3", 5, "Duel 3 different classes", "3 styles"),
  duel("p.cityDuel", 3, "Win a duel in a capital city", "City duel"),
  duel("p.bothWays", 5, "Win a duel and get an HK on the same day", "Both ways"),
  // Territory
  kill("p.contestedHk", 3, "Get an HK in a contested zone", "Contest HK", "territory"),
  kill("p.zoneDay", 3, "Get an HK in the zone of the day", "Day zone", "territory"),
  { id: "p.tourist", category: "territory", points: 5, text: "Enter an enemy capital", short: "Tourist" },
  { id: "p.raidParty", category: "territory", points: 3, text: "Visit an enemy town", short: "Raid party" },
  kill("p.guardDown", 3, "Kill an enemy guard", "Guard down", "territory", true),
  kill("p.townRaid", 5, "Kill 5 enemy faction NPCs", "Town raid", "territory", true),
  // Flagged
  {
    id: "p.flag60",
    category: "flagged",
    points: 5,
    text: "Stay flagged for 1 hour",
    short: "Flagged 60",
    needs: "flag",
  },
  {
    id: "p.boldQuest",
    category: "flagged",
    points: 3,
    text: "Quest flagged in a contested zone for 20 min",
    short: "Bold quest",
    needs: "flag",
  },
  {
    id: "p.holdout",
    category: "flagged",
    points: 3,
    text: "Stay flagged 10 min in the zone of the day",
    short: "Holdout",
    needs: "flag",
  },
  // Together
  kill("p.duoKill", 3, "Get an HK while grouped with a friend", "Duo kill", "together"),
  {
    id: "p.patrol",
    category: "together",
    points: 5,
    text: "Stay grouped and flagged with 2 friends for 20 min",
    short: "Patrol",
    needs: "flag",
  },
  kill("p.sharedGlory", 5, "Everyone in your group gets an HK", "All glory", "together"),
  kill("p.assist", 3, "Get an HK where a friend lands the killing blow", "Assist", "together", true),
  kill("p.guardian", 5, "Kill an enemy who is attacking a friend", "Guardian", "together", true),
  // Survive
  kill("p.selfDefense", 3, "Kill an enemy who attacked you first", "Defended", "survive", true),
  kill("p.narrowEscape", 3, "Survive a fight below 10% health", "Escape", "survive", true),
  kill("p.outnumbered", 5, "Win a fight against 2 enemies", "Two on one", "survive", true),
  // Timing
  kill("p.earlyBlood", 3, "Get an HK before 12:00", "Early HK", "timing"),
  kill("p.midnightRaid", 3, "Get an HK after midnight", "Late HK", "timing"),
  kill("p.youngBlood", 3, "Get an HK on an alt below level 30", "Young HK", "timing"),
  kill("p.hotStart", 3, "Get an HK within 10 min of logging in", "Hot start", "timing"),
  kill("p.twoBlades", 5, "Get HKs on 2 characters", "Two blades", "timing"),
];

/** The new goals of pool version 6, as catalogue entries. */
export const NEW_GOALS: readonly Goal[] = LIST.map((g) => ({ ...g, slot: g.slot ?? "skirmish", since: POOL6 }));

/**
 * The groups of the 50 PvP dailies on the Mission pool page (MP07), by id, the reused ones included. Payback, Clean 5
 * and Untouchable were in the pool before; they are listed under their group too.
 */
export const PVP_GROUP: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [
      [
        "Kills",
        [
          "p.hk3",
          "p.kills10",
          "p.upLevel",
          "p.punchUp5",
          "p.fairFight",
          "p.mirror",
          "p.variety",
          "p.races3",
          "p.healerDown",
          "p.double30",
          "p.untouchable",
          "p.closeCall",
        ],
      ],
      ["Hunt-like", ["p.closeEnough", "p.halfHunt", "p.rareQuarry", "p.revenge"]],
      ["Duels", ["p.duelFirst", "p.duelWin", "p.duel3", "p.spar", "p.duelUp", "p.styles3", "p.cityDuel", "p.bothWays"]],
      [
        "Territory",
        [
          "p.contestedHk",
          "p.enemyLand",
          "p.zones3",
          "p.zoneDay",
          "p.tourist",
          "p.raidParty",
          "p.guardDown",
          "p.townRaid",
        ],
      ],
      ["Flagged", ["p.flag60", "p.boldQuest", "p.flagHour", "p.holdout"]],
      ["Together", ["p.duoKill", "p.trioKills", "p.patrol", "p.sharedGlory", "p.assist", "p.guardian", "p.avenge"]],
      ["Survive", ["p.selfDefense", "p.narrowEscape", "p.outnumbered"]],
      ["Timing", ["p.earlyBlood", "p.midnightRaid", "p.youngBlood", "p.hotStart", "p.twoBlades"]],
    ].flatMap(([group, ids]) => (ids as string[]).map((id) => [id, group as string])),
  ),
};

/**
 * The daily PvE themes (CF-118 `theme`): the draw takes the 3 PvE dailies from 3 different themes. Mapped from the
 * catalogue's categories until CF-118's own tags land (the addon's tag per mission wins).
 */
export const THEME_OF_CATEGORY: Readonly<Record<string, string>> = {
  quests: "questing",
  loot: "loot",
  economy: "loot",
  social: "social",
  crafts: "professions",
  cooking: "professions",
  fishing: "professions",
  firstaid: "professions",
  exploration: "exploration",
  travel: "exploration",
  combat: "combat",
  levels: "combat",
  dungeons: "combat",
  play: "combat",
  care: "combat",
};
