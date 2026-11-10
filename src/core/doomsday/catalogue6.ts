import type { Goal } from "./rules";

// Pool version 6 (WEB-108, addon CF-118): the 50 PvP dailies of Mission pool v2 and the Duel slot's pool. Source: the
// pool-6 contract (CF-118 / WEB-108 / WEB-109 / WEB-110, 2026-11-10) and its list of the 50 new PvP dailies; the
// addon's src/core/Doomsday.lua (CF-118) is the catalogue's source of truth, and this file follows it.
//
// Short names: at most 10 characters (WEB-66, the bot's images); the list's longer ones are cut until CF-118 names them.
// Ids are never reused or renamed. A condition the catalogue already had (an id without `since`, never drawn) is that
// id, joining the pool from version 6 with the list's text, short name and points (REUSED); the rest are new (NEW).
// Payback is the existing p.revenge and "Stay flagged 30 min without dying" the existing p.flagHour: both are in the
// pool already. `check`: needs a test on Forever first; in the pool, but Off until the owner switches it on.

/** The pool version these join. */
export const POOL6 = 6;

/** Existing catalogue ids that join the pool from version 6, with the new list's fields. */
export const REUSED: Readonly<Record<string, Partial<Goal>>> = {
  "p.double": { since: 6, points: 5, text: "Kill 2 enemies within 30 sec", short: "Double" },
  "p.fairFight": { since: 6, points: 3, text: "Kill an enemy of your own level", short: "Fair fight" },
  "p.mirror": { since: 6, points: 3, text: "Kill an enemy of your own class", short: "Mirror" },
  "p.races3": { since: 6, points: 5, text: "Kill 3 different enemy races", short: "3 races" },
  "p.contested": { since: 6, points: 3, text: "Get an HK in a contested zone", short: "Contested" },
  // The Duel slot's pool: a kind of its own from version 6.
  "p.duelWin": { since: 6, slot: "duel", category: "duels", points: 3, text: "Win a duel", short: "Duel win" },
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

/** The new missions, in the list's order. Skirmish unless `slot` says Duel. */
const LIST: readonly New[] = [
  // Kills
  kill("p.hk3", 3, "Win 3 honorable kills", "3 HKs", "kills"),
  kill("p.hk10", 5, "Win 10 honorable kills", "10 HKs", "kills"),
  kill("p.upLevel", 3, "Kill an enemy above your level", "Up a level", "kills"),
  kill("p.giant", 5, "Kill an enemy 5 or more levels above you", "Giant", "kills"),
  kill("p.classes3", 5, "Kill 3 different enemy classes", "3 classes", "kills"),
  kill("p.healerDown", 3, "Kill an enemy healer class", "Healer KO", "kills"),
  kill("p.clean5", 5, "Win 5 honorable kills without dying", "Clean 5", "kills"),
  kill("p.closeCall", 5, "Kill an enemy while under 20% health", "Close call", "kills", true),
  // Hunt-like
  kill("p.closeEnough", 3, "Kill an enemy of today's quarry race", "Near miss", "huntLike"),
  kill("p.halfHunt", 3, "Kill an enemy of today's quarry class", "Half hunt", "huntLike"),
  kill("p.rareQuarry", 5, "Kill an enemy of a rare race and class (Everloot census)", "Rare prey", "huntLike"),
  // Duels (the Duel slot)
  {
    id: "p.duelFriends",
    slot: "duel",
    category: "duels",
    points: 3,
    text: "First duel with each friend",
    short: "Duels",
    needs: "duel",
  },
  { id: "p.duel3", slot: "duel", category: "duels", points: 5, text: "Win 3 duels", short: "3 duels", needs: "duel" },
  { id: "p.spar", slot: "duel", category: "duels", points: 1, text: "Duel a friend", short: "Spar", needs: "duel" },
  {
    id: "p.underdog",
    slot: "duel",
    category: "duels",
    points: 5,
    text: "Win a duel against a higher level",
    short: "Underdog",
    needs: "duel",
  },
  {
    id: "p.styles3",
    slot: "duel",
    category: "duels",
    points: 5,
    text: "Duel 3 different classes",
    short: "3 styles",
    needs: "duel",
  },
  {
    id: "p.cityDuel",
    slot: "duel",
    category: "duels",
    points: 3,
    text: "Win a duel in a capital city",
    short: "City duel",
    needs: "duel",
  },
  {
    id: "p.bothWays",
    slot: "duel",
    category: "duels",
    points: 5,
    text: "Win a duel and get an HK on the same day",
    short: "Both ways",
    needs: "duel",
  },
  // Territory
  kill("p.deepStrike", 5, "Get an HK in an enemy zone", "Deep raid", "territory"),
  kill("p.roamer", 5, "Get HKs in 3 different zones", "Roamer", "territory"),
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
  kill("p.warParty", 5, "Get an HK in a group of 3 friends", "War party", "together"),
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
  kill("p.avenger", 5, "Kill the enemy who killed a friend", "Avenger", "together"),
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
