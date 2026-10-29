import { MAX_LEVEL } from "../gamedata/levels";
import { PROFESSIONS } from "../gamedata/professions";
import type { FeedDay } from "../feed";
import type { Character, Dataset } from "../model";
import { ordinal } from "../names";

// Feats (WEB-56; the addon repo's docs/DOOMSDAY.md "Feats"): one-time achievements per character, posted once as
// "Feat unlocked", no points. Every milestone (src/core/bot.ts) is one, and these kinds join them. Pure: the server
// gives the data after an upload, the feats every character already holds and the counts it keeps; this says which
// feats are new. Held feats are keyed per character by kind and step ("honorKills:100", "pvpRank:7").
//
// Decided with Nico (2026-10-28):
// - What a character already had when its data first arrives (a friend just updated the addon, a new character, the
//   site's first upload) is held silently as "already had": no post, never First in the group.
// - Duel wins and deaths count from the character's lifetime counters (`pvp.duelsWon`, `pvp.deaths`), the feed's
//   entries when it has none.

export type FeatKind =
  | "level"
  | "maxLevel"
  | "professionCap"
  | "newCharacter"
  | "honorKills"
  | "pvpRank"
  | "duelWins"
  | "bgFirstWin"
  | "deaths100"
  | "firstEpic"
  | "mount"
  | "epicMount"
  | "firstCatch"
  | "jackOfAllTrades"
  | "notableItem";

/** The watch-list feats (addon CF-53's `notable`). */
export type Notable =
  "arcaniteReaper" | "arcaniteTransmute" | "mooncloth" | "devilsaur" | "extravaganzaJoined" | "extravaganzaWon";

/** The fields a feat adds to its milestone (docs/BOT-API.md "Feats"). */
export interface FeatFields {
  kills?: number;
  rank?: number;
  rankName?: string;
  title?: string;
  wins?: number;
  battleground?: string;
  deaths?: number;
  item?: { id?: number; name?: string; slot?: string; level?: number };
  riding?: number;
  level?: number;
  place?: number;
  professions?: string[];
  notable?: Notable;
}

/** A feat the site holds for a character. */
export interface HeldFeat {
  guid: string;
  key: string;
  kind: FeatKind;
  /** Held from the data's first arrival: never posted, never First in the group. */
  alreadyHad: boolean;
  firstInGroup: boolean;
  fields: FeatFields;
}

// --- the catalogue -------------------------------------------------------------------------------------------

/** Lifetime honorable kills that are feats (WEB-56). */
export const HONOR_KILL_STEPS = [1, 100, 1000, 5000, 10000] as const;
/** Duel wins that are feats (WEB-56). */
export const DUEL_WIN_STEPS = [10, 50, 100] as const;
export const DEATHS_FEAT = 100;
/** Riding skill ranks (CF-53): a mount at 75, an epic mount at 150. */
export const RIDING_MOUNT = 75;
export const RIDING_EPIC = 150;
/** From this rank on every new highest rank gets a card image (WEB-56). */
export const RANK_CARD_FROM = 6;

/** Battlegrounds with a first-win feat, by the name the feed's runs carry (CF-23). */
export const BATTLEGROUNDS = ["Warsong Gulch", "Arathi Basin", "Alterac Valley"] as const;

const COOKING = 185;
const FIRST_AID = 129;
const FISHING = 356;
const MAX_SKILL = 300;

/** Flavour titles on a profession cap at 300 (WEB-56). */
export const CAP_TITLES: Readonly<Record<number, string>> = {
  [COOKING]: "Head Chef",
  [FIRST_AID]: "Field Medic",
  [FISHING]: "Fish Whisperer",
};

/**
 * PvP ranks: the official name per faction and our title, the same for both factions (the addon repo's
 * docs/DOOMSDAY.md "PvP rank titles", decided with Nico 2026-10-28; official names: warcraft.wiki.gg "Honor system
 * (pre-2.0)"). Index = rank number.
 */
export const PVP_RANKS: readonly { horde: string; alliance: string; title: string }[] = [
  { horde: "", alliance: "", title: "Conscientious Objector" },
  { horde: "Scout", alliance: "Private", title: "Fresh Meat" },
  { horde: "Grunt", alliance: "Corporal", title: "Accidental Flagger" },
  { horde: "Sergeant", alliance: "Sergeant", title: "Lowbie Botherer" },
  { horde: "Senior Sergeant", alliance: "Master Sergeant", title: "Corpse Camper" },
  { horde: "First Sergeant", alliance: "Sergeant Major", title: "Spirit Healer's Pen Pal" },
  { horde: "Stone Guard", alliance: "Knight", title: "Mailbox Menace" },
  { horde: "Blood Guard", alliance: "Knight-Lieutenant", title: "Flag Hugger" },
  { horde: "Legionnaire", alliance: "Knight-Captain", title: "Honor Goblin" },
  { horde: "Centurion", alliance: "Knight-Champion", title: "Queue Dweller" },
  { horde: "Champion", alliance: "Lieutenant Commander", title: "Crossroads Landlord" },
  { horde: "Lieutenant General", alliance: "Commander", title: "Hillsbrad Housing Crisis" },
  { horde: "General", alliance: "Marshal", title: "Last Seen Questing at Launch" },
  { horde: "Warlord", alliance: "Field Marshal", title: "Sleep Is for the Dishonorable" },
  { horde: "High Warlord", alliance: "Grand Marshal", title: "Grass: Untouched" },
];
export const MAX_PVP_RANK = PVP_RANKS.length - 1;

/**
 * The addon's watch list (CF-53) by item id. Ids checked on Wowhead Classic (wowhead.com/classic/item=<id>,
 * 2026-10-28): 12784 Arcanite Reaper, 12360 Arcanite Bar, 14342 Mooncloth, 15063 Devilsaur Gauntlets, 15062 Devilsaur
 * Leggings, 19807 Speckled Tastyfish, 19970 Arcanite Fishing Pole, 19979 Hook of the Master Angler.
 */
export const NOTABLE_ITEMS: Readonly<Record<number, { notable: Notable; name: string }>> = {
  12784: { notable: "arcaniteReaper", name: "Arcanite Reaper" },
  12360: { notable: "arcaniteTransmute", name: "Arcanite Bar" },
  14342: { notable: "mooncloth", name: "Mooncloth" },
  15063: { notable: "devilsaur", name: "Devilsaur Gauntlets" },
  15062: { notable: "devilsaur", name: "Devilsaur Leggings" },
  19807: { notable: "extravaganzaJoined", name: "Speckled Tastyfish" },
  19970: { notable: "extravaganzaWon", name: "Arcanite Fishing Pole" },
  19979: { notable: "extravaganzaWon", name: "Hook of the Master Angler" },
};

/**
 * An equip slot's English name from the game's `INVTYPE_*` token (CF-53), as the client's GlobalStrings.lua names
 * them (warcraft.wiki.gg "ItemEquipLoc"). Unknown tokens show no slot.
 */
const SLOTS: Readonly<Record<string, string>> = {
  INVTYPE_HEAD: "Head",
  INVTYPE_NECK: "Neck",
  INVTYPE_SHOULDER: "Shoulder",
  INVTYPE_BODY: "Shirt",
  INVTYPE_CHEST: "Chest",
  INVTYPE_ROBE: "Chest",
  INVTYPE_WAIST: "Waist",
  INVTYPE_LEGS: "Legs",
  INVTYPE_FEET: "Feet",
  INVTYPE_WRIST: "Wrist",
  INVTYPE_HAND: "Hands",
  INVTYPE_FINGER: "Finger",
  INVTYPE_TRINKET: "Trinket",
  INVTYPE_CLOAK: "Back",
  INVTYPE_WEAPON: "One-Hand",
  INVTYPE_SHIELD: "Off Hand",
  INVTYPE_2HWEAPON: "Two-Hand",
  INVTYPE_WEAPONMAINHAND: "Main Hand",
  INVTYPE_WEAPONOFFHAND: "Off Hand",
  INVTYPE_HOLDABLE: "Held In Off-hand",
  INVTYPE_RANGED: "Ranged",
  INVTYPE_THROWN: "Thrown",
  INVTYPE_RANGEDRIGHT: "Ranged",
  INVTYPE_RELIC: "Relic",
  INVTYPE_TABARD: "Tabard",
};

export function slotName(token: string | undefined): string | undefined {
  return token === undefined ? undefined : SLOTS[token];
}

/** The official rank name for a character's faction; the game's own name when the addon sent it. */
export function rankName(rank: number, faction: string | undefined, fromGame?: string): string | undefined {
  if (fromGame !== undefined && fromGame !== "") return fromGame;
  const r = PVP_RANKS[rank];
  if (r === undefined || rank === 0) return undefined;
  return faction === "Alliance" ? r.alliance : r.horde;
}

// --- which feats are "first in the group" --------------------------------------------------------------------

/** The group key a feat counts for when it is First in the group, or undefined when it never is (WEB-56). */
export function groupKey(f: { kind: FeatKind; fields: FeatFields }): string | undefined {
  switch (f.kind) {
    case "honorKills":
      return "honorKills";
    case "pvpRank":
      return (f.fields.rank ?? 0) >= RANK_CARD_FROM ? "pvpRank6" : undefined;
    case "firstEpic":
    case "mount":
    case "epicMount":
    case "maxLevel":
    case "jackOfAllTrades":
      return f.kind;
    case "notableItem":
      return `notableItem:${f.fields.notable}`;
    default:
      return undefined;
  }
}

// --- detection -----------------------------------------------------------------------------------------------

/** What the server knows going into an upload. */
export interface FeatInput {
  /** The merged data before the upload; undefined for the site's first one. */
  before?: Dataset;
  after: Dataset;
  /** Feats held so far, per character: key -> fields. */
  held: Readonly<Record<string, Readonly<Record<string, FeatFields>>>>;
  /** Group keys (groupKey) held by any character so far, and how many characters hold "mount" or "epicMount". */
  groupHeld: ReadonlySet<string>;
  mounts: { mount: number; epic: number };
  /** The feed days of this upload, per character (any realm day). */
  feed: Readonly<Record<string, readonly FeedDay[]>>;
  /** From all stored feed days, per character: duels won and deaths (the fallback without lifetime counters). */
  feedCounts: Readonly<Record<string, { duelsWon: number; deaths: number }>>;
  /** The milestones (src/core/bot.ts) of this upload: level, maxLevel, professionCap and newCharacter. */
  milestones: readonly { kind: FeatKind; guid: string; key: string; fields: FeatFields }[];
}

/** A feat's key for a milestone of src/core/bot.ts. */
export function milestoneKey(m: {
  kind: "level" | "maxLevel" | "professionCap" | "newCharacter";
  level?: number;
  skillLine?: string;
  rank?: number;
}): string {
  if (m.kind === "level") return `level:${m.level}`;
  if (m.kind === "professionCap") return `professionCap:${m.skillLine}:${m.rank}`;
  return m.kind;
}

function highest(steps: readonly number[], value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  let top: number | undefined;
  for (const s of steps) if (value >= s) top = s;
  return top;
}

function heldMax(held: Readonly<Record<string, FeatFields>>, prefix: string): number {
  let max = 0;
  for (const key of Object.keys(held)) {
    if (key.startsWith(`${prefix}:`)) max = Math.max(max, Number(key.slice(prefix.length + 1)) || 0);
  }
  return max;
}

function profRank(c: Character, id: number): number {
  return c.professions[String(id)]?.rank ?? 0;
}

/** Two primary professions plus Cooking, First Aid and Fishing, all at 300. */
function jack(c: Character): string[] | undefined {
  const primaries = Object.entries(c.professions)
    .filter(([id, p]) => PROFESSIONS[Number(id)]?.kind === "primary" && (p.rank ?? 0) >= MAX_SKILL)
    .map(([id]) => PROFESSIONS[Number(id)]!.name)
    .sort();
  const secondaries = [COOKING, FIRST_AID, FISHING];
  if (primaries.length < 2 || secondaries.some((id) => profRank(c, id) < MAX_SKILL)) return undefined;
  return [...secondaries.map((id) => PROFESSIONS[id]!.name), ...primaries];
}

/**
 * The feats an upload brings, in a stable order (characters by GUID, then kind). Already-had ones are included
 * (to be held silently); posts are the others. First in the group goes to one feat per group key at most.
 */
export function detectFeats(input: FeatInput): HeldFeat[] {
  const { before, after } = input;
  const out: HeldFeat[] = [];
  const groupHeld = new Set(input.groupHeld);
  const mounts = { ...input.mounts };
  const firstUpload = before === undefined;

  const add = (guid: string, key: string, kind: FeatKind, fields: FeatFields, alreadyHad: boolean) => {
    const g = groupKey({ kind, fields });
    const firstInGroup = !alreadyHad && g !== undefined && !groupHeld.has(g);
    if (g !== undefined) groupHeld.add(g);
    out.push({ guid, key, kind, alreadyHad, firstInGroup, fields });
  };

  // The existing milestones first: they decide level 60's First in the group before a backfilled one.
  for (const m of input.milestones) {
    if (input.held[m.guid]?.[m.key] === undefined) add(m.guid, m.key, m.kind, m.fields, false);
  }
  const has = (guid: string, key: string) =>
    input.held[guid]?.[key] !== undefined || out.some((f) => f.guid === guid && f.key === key);

  const guids = Object.keys(after.characters).sort();
  for (const guid of guids) {
    const c = after.characters[guid]!;
    if (!c.hasRecord || c.owner === undefined) continue;
    const old = before?.characters[guid];
    const isNew = old === undefined || !old.hasRecord;
    const held = input.held[guid] ?? {};

    // Level 60 reached before the site saw it (a new character, the first upload): held silently.
    if ((c.level ?? 0) >= MAX_LEVEL && !has(guid, "maxLevel"))
      add(guid, "maxLevel", "maxLevel", { level: c.level }, true);

    // PvP: lifetime kills, the highest rank ever, duel wins, deaths (CF-52).
    const pvpNew = firstUpload || isNew || old?.pvp === undefined;
    const pvp = c.pvp;
    const kills = highest(HONOR_KILL_STEPS, pvp?.hk);
    if (kills !== undefined && kills > heldMax(held, "honorKills")) {
      add(guid, `honorKills:${kills}`, "honorKills", { kills }, pvpNew);
    }
    const rank = pvp?.rank;
    if (rank !== undefined && rank > 0 && rank > heldMax(held, "pvpRank")) {
      const fields: FeatFields = { rank, title: PVP_RANKS[rank]?.title };
      const name = rankName(rank, c.faction, pvp?.rankName);
      if (name !== undefined) fields.rankName = name;
      add(guid, `pvpRank:${rank}`, "pvpRank", fields, pvpNew);
    }
    const counted = input.feedCounts[guid];
    const duelsWon = pvp?.duelsWon ?? counted?.duelsWon;
    const fromCounter = pvp?.duelsWon !== undefined;
    const wins = highest(DUEL_WIN_STEPS, duelsWon);
    if (wins !== undefined && wins > heldMax(held, "duelWins")) {
      add(guid, `duelWins:${wins}`, "duelWins", { wins }, fromCounter ? pvpNew : firstUpload);
    }
    const deaths = pvp?.deaths ?? counted?.deaths;
    if (deaths !== undefined && deaths >= DEATHS_FEAT && !has(guid, "deaths100")) {
      add(guid, "deaths100", "deaths100", { deaths: DEATHS_FEAT }, pvp?.deaths !== undefined ? pvpNew : firstUpload);
    }

    // Mounts (CF-53 riding): an epic mount at once also holds the mount, which isn't posted on its own.
    const ridingNew = firstUpload || isNew || old?.riding === undefined;
    const riding = c.riding ?? 0;
    if (riding >= RIDING_EPIC && !has(guid, "epicMount")) {
      const hadMount = has(guid, "mount");
      if (!hadMount) mounts.mount += 1;
      mounts.epic += 1;
      add(guid, "epicMount", "epicMount", { riding, level: c.level, place: mounts.epic }, ridingNew);
      if (!hadMount)
        out.push({
          guid,
          key: "mount",
          kind: "mount",
          alreadyHad: true,
          firstInGroup: false,
          fields: { riding: RIDING_MOUNT, level: c.level, place: mounts.mount },
        });
    } else if (riding >= RIDING_MOUNT && riding < RIDING_EPIC && !has(guid, "mount")) {
      mounts.mount += 1;
      add(guid, "mount", "mount", { riding, level: c.level, place: mounts.mount }, ridingNew);
    }

    // Professions: the first catch and Jack of all trades, from the professions the character had before.
    const profNew = firstUpload || isNew;
    if (profRank(c, FISHING) > 1 && !has(guid, "firstCatch")) add(guid, "firstCatch", "firstCatch", {}, profNew);
    const all = jack(c);
    if (all !== undefined && !has(guid, "jackOfAllTrades")) {
      add(guid, "jackOfAllTrades", "jackOfAllTrades", { professions: all }, profNew);
    }

    // The feed of this upload (CF-23, CF-53): a battleground's first win, the first epic, watch-list items.
    for (const day of input.feed[guid] ?? []) {
      for (const run of day.runs) {
        const bg = BATTLEGROUNDS.find((b) => b === run.name);
        if (run.kind === "pvp" && run.won === true && bg !== undefined && !has(guid, `bgFirstWin:${bg}`)) {
          add(guid, `bgFirstWin:${bg}`, "bgFirstWin", { battleground: bg }, firstUpload);
        }
      }
      const epic = day.loot?.epic[0];
      if (epic !== undefined && !has(guid, "firstEpic")) {
        const item: FeatFields["item"] = {};
        if (epic.id !== undefined) item.id = epic.id;
        if (epic.name !== undefined) item.name = epic.name;
        const slot = slotName(epic.slot);
        if (slot !== undefined) item.slot = slot;
        if (epic.level !== undefined) item.level = epic.level;
        add(guid, "firstEpic", "firstEpic", { item }, firstUpload);
      }
      for (const id of Object.keys(day.notable ?? {})) {
        const n = NOTABLE_ITEMS[Number(id)];
        if (n !== undefined && !has(guid, `notableItem:${n.notable}`)) {
          add(
            guid,
            `notableItem:${n.notable}`,
            "notableItem",
            { notable: n.notable, item: { id: Number(id), name: n.name } },
            firstUpload,
          );
        }
      }
    }
  }
  return out;
}

// --- texts (WEB-56; written with Nico's go-ahead, 2026-10-28, for him to edit) ------------------------------------

/** What a feat says: a title, a line and a flavour line (the card and the feats page), and the post's one line. */
export interface FeatText {
  title: string;
  line: string;
  flavour?: string;
  text: string;
}

const thousands = (n: number) => n.toLocaleString("en-US");

const NOTABLE_TEXT: Readonly<Record<Notable, { title: string; line: string; flavour: string }>> = {
  arcaniteReaper: { title: "Arcanite Reaper", line: "Crafted at last", flavour: "Somebody pay a visit." },
  arcaniteTransmute: {
    title: "Arcanite Bar",
    line: "The first Arcanite transmute",
    flavour: "Alchemy, but make it shiny.",
  },
  mooncloth: { title: "Mooncloth", line: "The first Mooncloth", flavour: "Spun by moonlight, worn by show-offs." },
  devilsaur: { title: "Devilsaur leather", line: "Devilsaur gear crafted", flavour: "Un'Goro has one dinosaur fewer." },
  extravaganzaJoined: {
    title: "Fishing Extravaganza",
    line: "Joined the Fishing Extravaganza",
    flavour: "Sunday afternoon well spent.",
  },
  extravaganzaWon: {
    title: "Extravaganza winner",
    line: "Won the Fishing Extravaganza",
    flavour: "Booty Bay will talk about this.",
  },
};

/** The texts of a feat for a character's full name (never split, CLAUDE.md rule 3). */
export function featText(
  f: { kind: FeatKind; fields: FeatFields; skillLine?: string; profession?: string },
  name: string,
): FeatText {
  const x = f.fields;
  switch (f.kind) {
    case "level":
      return { title: `Level ${x.level}`, line: `Reached level ${x.level}`, text: `${name} reached level ${x.level}` };
    case "maxLevel":
      return {
        title: `Level ${x.level ?? MAX_LEVEL}`,
        line: "Reached the level cap",
        flavour: "The real game starts now.",
        text: `${name} reached level ${x.level ?? MAX_LEVEL}`,
      };
    case "newCharacter":
      return { title: "New character", line: "Joined the group", text: `New character: ${name}` };
    case "professionCap": {
      const p = f.profession ?? "A profession";
      const title = x.title !== undefined ? ` · ${x.title}` : "";
      return {
        title: `${p} ${x.rank ?? ""}`.trim(),
        line: `${p} at its cap${title}`,
        text: `${name}: ${p} ${x.rank ?? ""}${title}`,
      };
    }
    case "honorKills":
      if (x.kills === 1) {
        return {
          title: "First blood",
          line: "The first honorable kill",
          flavour: "It begins.",
          text: `First blood: ${name}`,
        };
      }
      return {
        title: x.kills === 10000 ? "10,000 kills" : `${thousands(x.kills ?? 0)} honorable kills`,
        line: x.kills === 10000 ? "Ten thousand. Honorably." : `${thousands(x.kills ?? 0)} honorable kills`,
        flavour: x.kills === 10000 ? "Hillsbrad will never be the same" : undefined,
        text: `${name}: ${thousands(x.kills ?? 0)} honorable kills`,
      };
    case "pvpRank": {
      const official = x.rankName ?? `Rank ${x.rank}`;
      return {
        title: official,
        line: `a.k.a. ${x.title ?? ""}`,
        flavour: x.rank === MAX_PVP_RANK ? "The summit. Please go outside." : `Rank ${x.rank}`,
        text: `${name} is now ${official}, a.k.a. ${x.title ?? ""}`,
      };
    }
    case "duelWins":
      return {
        title: `${x.wins} duel wins`,
        line: `${x.wins} duels won`,
        flavour:
          x.wins === 100
            ? "Unbothered."
            : x.wins === 50
              ? "Nobody asked for a rematch."
              : "Slapping friends, professionally.",
        text: `${name}: ${x.wins} duel wins`,
      };
    case "bgFirstWin":
      return {
        title: "First win",
        line: `First win in ${x.battleground}`,
        text: `${name}: first win in ${x.battleground}`,
      };
    case "deaths100":
      return {
        title: "A spirit healer's best friend",
        line: "100 deaths",
        flavour: "Same time next week?",
        text: `${name}: a spirit healer's best friend (100 deaths)`,
      };
    case "firstEpic": {
      const item = x.item?.name ?? "An epic item";
      const detail = [x.item?.slot, x.item?.level !== undefined ? `looted at level ${x.item.level}` : undefined]
        .filter(Boolean)
        .join(" · ");
      return { title: item, line: "First epic", flavour: detail || undefined, text: `${name}: first epic, ${item}` };
    }
    case "mount":
      return {
        title: "First mount",
        line: `The ${ordinal(x.place ?? 1)} mount in the group`,
        flavour: "Walking is for lowbies.",
        text: `${name}: first mount, the ${ordinal(x.place ?? 1)} in the group`,
      };
    case "epicMount":
      return {
        title: "Epic mount",
        line: `The ${ordinal(x.place ?? 1)} epic mount in the group`,
        flavour: "Gold spent: none of your business",
        text: `${name}: epic mount, the ${ordinal(x.place ?? 1)} in the group`,
      };
    case "firstCatch":
      return {
        title: "First catch",
        line: "Fishing past rank 1",
        flavour: "It was a boot. Probably.",
        text: `${name}: first catch`,
      };
    case "jackOfAllTrades": {
      const primaries = (x.professions ?? []).slice(3);
      return {
        title: "Jack of all trades",
        line: "Cooking, First Aid, Fishing at 300",
        flavour: primaries.length > 0 ? `plus ${primaries.join(" and ")}` : undefined,
        text: `${name}: Jack of all trades`,
      };
    }
    case "notableItem": {
      const t = NOTABLE_TEXT[x.notable ?? "arcaniteReaper"];
      return { ...t, text: `${name}: ${t.line}` };
    }
  }
}

// --- card images ---------------------------------------------------------------------------------------------

/** Whether a feat gets a card image (WEB-56, and the milestone cards of WEB-41d). */
export function hasCard(f: { kind: FeatKind; fields: FeatFields; level?: number }): boolean {
  switch (f.kind) {
    case "honorKills":
      return f.fields.kills === 10000;
    case "pvpRank":
      return (f.fields.rank ?? 0) >= RANK_CARD_FROM;
    case "firstEpic":
    case "epicMount":
    case "jackOfAllTrades":
    case "notableItem":
    case "maxLevel":
      return true;
    case "professionCap":
      return (f.fields.rank ?? 0) >= MAX_SKILL;
    case "newCharacter":
      return (f.level ?? 0) >= MAX_LEVEL;
    default:
      return false;
  }
}

/**
 * How special a feat's card is, higher first (Nico, 2026-10-28): rank 14, 10,000 kills, Jack of all trades, the
 * Extravaganza won, other watch-list items, epic mount, first epic, ranks 13 to 6, level 60, profession 300.
 */
export function cardRank(f: { kind: FeatKind; fields: FeatFields }): number {
  switch (f.kind) {
    case "pvpRank":
      return f.fields.rank === MAX_PVP_RANK ? 100 : 40 + (f.fields.rank ?? 0);
    case "honorKills":
      return 95;
    case "jackOfAllTrades":
      return 90;
    case "notableItem":
      return f.fields.notable === "extravaganzaWon" ? 85 : 80;
    case "epicMount":
      return 75;
    case "firstEpic":
      return 70;
    case "maxLevel":
    case "newCharacter":
      return 30;
    case "professionCap":
      return 20;
    default:
      return 0;
  }
}
