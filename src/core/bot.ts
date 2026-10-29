import type { UploadSummary } from "./diff";
import type { FeatFields, FeatKind } from "./doomsday/feats";
import { MAX_LEVEL } from "./gamedata";
import type { Dataset } from "./model";
import { base64url } from "./uploader";

// The Discord bot's API (WEB-38, docs/BOT-API.md): its token, the milestones an accepted upload makes, and the event
// feed's cursor. The site decides what is worth posting; the bot only formats and posts.

// --- token --------------------------------------------------------------------------------------------------------

/** The one bot token: `cfb_` and 32 random bytes in base64url (43 characters). Stored only as a SHA-256 hash. */
export const BOT_TOKEN_PREFIX = "cfb_";
export const BOT_TOKEN_BYTES = 32;

export function formatBotToken(bytes: Uint8Array): string {
  return BOT_TOKEN_PREFIX + base64url(bytes);
}

const BOT_TOKEN_PATTERN = new RegExp(`^${BOT_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`);

/** The token of an `Authorization: Bearer cfb_…` header; undefined for anything else (an uploader token too). */
export function botBearerToken(header: string | null | undefined): string | undefined {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  const token = match?.[1];
  return token !== undefined && BOT_TOKEN_PATTERN.test(token) ? token : undefined;
}

// --- events -------------------------------------------------------------------------------------------------------

/** A long poll holds at most this long when there is nothing new (story: about 30 s). */
export const LONG_POLL_SECONDS = 30;
/** Events not posted within 7 days are no longer handed out (decided with Nico, 2026-10-27). */
export const EVENT_TTL_SECONDS = 7 * 24 * 60 * 60;
/** At most this many events per answer; the bot asks again with the cursor for the rest. */
export const EVENTS_PER_PAGE = 50;
/** The longest Discord message id we take (snowflakes are up to 20 digits). */
export const MAX_MESSAGE_ID = 32;

/**
 * The cursor of `GET events?after=`: the id of the last event the bot was handed, as decimal text. Missing or empty
 * is 0 (from the start); undefined for anything else.
 */
export function parseCursor(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return 0;
  if (!/^\d{1,15}$/.test(value)) return undefined;
  return Number(value);
}

/** A Discord message id as the bot acknowledges it: digits only (a snowflake). */
export function parseMessageId(value: unknown): string | undefined {
  return typeof value === "string" && /^\d+$/.test(value) && value.length <= MAX_MESSAGE_ID ? value : undefined;
}

// --- milestones ---------------------------------------------------------------------------------------------------

/** Every 10 levels is a milestone (story WEB-38). */
export const LEVEL_STEP = 10;

/** Who a milestone is about: names only, never a BattleTag (they are for a Discord channel). */
export interface MilestoneCharacter {
  guid: string;
  name?: string;
  classFile?: string;
  level?: number;
  /** The owner's display name. */
  ownerName?: string;
}

/** What every milestone may carry since WEB-56 (feats, docs/BOT-API.md "Feats"): all optional within v1. */
export interface MilestoneExtras {
  /** The feat's line, finished ("First blood: Ves Doombringer"). */
  text?: string;
  /** No character in the group reached it before. */
  firstInGroup?: true;
  /** The card image id (`milestone-<event>-<n>`): every feat but a new character (WEB-66). */
  card?: string;
  /** WEB-66: the feat's short name ("Stone Guard", "First catch") and one finished sentence, for the bot's post. */
  headline?: string;
  line?: string;
}

export type Milestone = MilestoneExtras &
  /** Reached 10, 20, … 50: one milestone for the highest mark crossed (18 → 31 is "30"). */
  (
    | { kind: "level"; character: MilestoneCharacter; level: number; from: number }
    /** Reached the level cap: its own kind, never also a "level" one. */
    | { kind: "maxLevel"; character: MilestoneCharacter; level: number; from: number }
    /**
     * A profession's rank rose to the cap of its training rank (75/75, 150/150, …): raising the cap alone is not one
     * (decided with Nico, 2026-10-27). `title` at 300 for Cooking, First Aid and Fishing (WEB-56).
     */
    | {
        kind: "professionCap";
        character: MilestoneCharacter;
        skillLine: string;
        profession?: string;
        rank: number;
        title?: string;
      }
    /** A character the group didn't know before (or knew only by name). */
    | { kind: "newCharacter"; character: MilestoneCharacter }
    /** The feats of WEB-56, with their fields (src/core/doomsday/feats.ts). */
    | ({
        kind: Exclude<FeatKind, "level" | "maxLevel" | "professionCap" | "newCharacter">;
        character: MilestoneCharacter;
      } & FeatFields)
  );

/** The payload of a `milestones` event: everything one accepted upload reached. */
export interface MilestonesEvent {
  uploadId: number;
  uploadedAt: number;
  milestones: Milestone[];
  /** WEB-56: the one card image for a post of several feats (the most special one's). */
  card?: string;
}

/** The highest multiple of LEVEL_STEP in (from, to], or undefined. */
function levelMark(from: number, to: number): number | undefined {
  const mark = Math.floor(to / LEVEL_STEP) * LEVEL_STEP;
  return mark > from && mark > 0 ? mark : undefined;
}

/** Existing kinds first (WEB-38), then the feats of WEB-56; by name within a kind. */
const KIND_ORDER: Record<FeatKind, number> = {
  maxLevel: 0,
  level: 1,
  professionCap: 2,
  newCharacter: 3,
  honorKills: 4,
  pvpRank: 5,
  duelWins: 6,
  bgFirstWin: 7,
  deaths100: 8,
  firstEpic: 9,
  mount: 10,
  epicMount: 11,
  firstCatch: 12,
  jackOfAllTrades: 13,
  notableItem: 14,
};

/** Sorts milestones as the event lists them. */
export function sortMilestones(list: Milestone[]): Milestone[] {
  const name = (m: Milestone) => m.character.name ?? m.character.guid;
  return list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || name(a).localeCompare(name(b), "en"));
}

/** Who a milestone is about, as the site knows the character after the upload. */
export function milestoneCharacter(after: Dataset, guid: string): MilestoneCharacter {
  const c = after.characters[guid];
  const m: MilestoneCharacter = { guid };
  if (c === undefined) return m;
  if (c.name !== undefined) m.name = c.name;
  if (c.classFile !== undefined) m.classFile = c.classFile;
  if (c.level !== undefined) m.level = c.level;
  const owner = c.owner === undefined ? undefined : after.people[c.owner];
  if (owner !== undefined) m.ownerName = owner.displayName;
  return m;
}

/**
 * The milestones of an accepted upload, from its summary and the merged data after it: level marks, the level cap,
 * professions at their cap, new characters. A new character's levels and professions are part of it being new, not
 * milestones of their own. The caller skips the site's first upload (decided with Nico, 2026-10-27).
 */
export function milestones(summary: UploadSummary, after: Dataset): Milestone[] {
  const who = (guid: string) => milestoneCharacter(after, guid);
  const fresh = new Set(summary.newCharacters.filter((c) => c.hasRecord).map((c) => c.guid));
  const out: Milestone[] = [];
  for (const guid of fresh) out.push({ kind: "newCharacter", character: who(guid) });
  for (const up of summary.levelUps) {
    if (fresh.has(up.guid)) continue;
    if (up.to >= MAX_LEVEL && up.from < MAX_LEVEL) {
      out.push({ kind: "maxLevel", character: who(up.guid), level: up.to, from: up.from });
      continue;
    }
    const mark = levelMark(up.from, up.to);
    if (mark !== undefined) out.push({ kind: "level", character: who(up.guid), level: mark, from: up.from });
  }
  for (const gain of summary.professionGains) {
    if (fresh.has(gain.guid) || !gain.capReached) continue;
    const m: Milestone = { kind: "professionCap", character: who(gain.guid), skillLine: gain.skillLine, rank: gain.to };
    if (gain.profession !== undefined) m.profession = gain.profession;
    out.push(m);
  }
  return sortMilestones(out);
}
