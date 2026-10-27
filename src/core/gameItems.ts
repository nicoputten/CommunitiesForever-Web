import type { LuaChunk } from "./lua";
import { field, findGlobal, list, num, str, table, type Table } from "./normalize";

// What the player did in game that has to reach the site (WEB-43, addon CF-47/CF-48 "pending"; addon
// src/core/Pending.lua and its sample tests/fixtures/pending.lua): runs planned, answers given, asks to post on
// Discord and Discord pings. The game saves them in `global.pending` (schema 2) until the site's runs list them
// under `received` (WEB-44). Untrusted like the rest of the file: wrong items are left out, text loses WoW escapes.

export type GameRole = "tank" | "heal" | "dps";

interface ItemBase {
  /** Unique per player ("k3f9c0a7e21b-1793120000-1"): a file uploaded twice changes nothing. */
  id: string;
  /** When it happened in game (Unix seconds). */
  at: number;
}

interface Who {
  /** The player's character. */
  guid?: string;
  name?: string;
  role?: GameRole;
}

export type GameItem =
  | (ItemBase & Who & { kind: "plan"; dungeon: string; startsAt: number; note?: string })
  | (ItemBase & Who & { kind: "answer"; run: string; answer: "in" | "maybe" | "cant" })
  | (ItemBase & Who & { kind: "ask"; dungeon: string; note?: string })
  | (ItemBase & { kind: "ping"; run: string; battleTag?: string; guid?: string; name?: string });

/** The addon's caps (Pending.MAX_ITEMS, MAX_NOTE). */
export const MAX_GAME_ITEMS = 100;
export const MAX_GAME_NOTE = 200;
/** An ask is posted only within 10 minutes of being made in game (Pending.ASK_EXPIRE; story WEB-43). */
export const ASK_EXPIRE_SECONDS = 10 * 60;

const ID = /^[\w\-:.]{1,64}$/;
const ROLES = new Set<GameRole>(["tank", "heal", "dps"]);
const ANSWERS = new Set(["in", "maybe", "cant"]);

function text(t: Table, key: string, max: number): string | undefined {
  const value = str(t, key)
    ?.replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return value === undefined || value === "" ? undefined : Array.from(value).slice(0, max).join("");
}

function token(t: Table, key: string): string | undefined {
  const value = str(t, key);
  return value !== undefined && ID.test(value) ? value : undefined;
}

function time(t: Table, key: string): number | undefined {
  const value = num(t, key);
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : undefined;
}

function who(t: Table): Who {
  const w: Who = {};
  const guid = token(t, "guid");
  const name = text(t, "name", 48);
  const role = str(t, "role");
  if (guid !== undefined) w.guid = guid;
  if (name !== undefined) w.name = name;
  if (role !== undefined && ROLES.has(role as GameRole)) w.role = role as GameRole;
  return w;
}

function item(t: Table): GameItem | undefined {
  const id = token(t, "id");
  const at = time(t, "at");
  if (id === undefined || at === undefined) return undefined;
  const note = text(t, "note", MAX_GAME_NOTE);
  switch (str(t, "kind")) {
    case "plan": {
      const dungeon = token(t, "dungeon");
      const startsAt = time(t, "startsAt");
      if (dungeon === undefined || startsAt === undefined) return undefined;
      return { id, at, kind: "plan", dungeon, startsAt, ...who(t), ...(note === undefined ? {} : { note }) };
    }
    case "answer": {
      const run = token(t, "run");
      const answer = str(t, "answer");
      if (run === undefined || answer === undefined || !ANSWERS.has(answer)) return undefined;
      return { id, at, kind: "answer", run, answer: answer as "in" | "maybe" | "cant", ...who(t) };
    }
    case "ask": {
      const dungeon = token(t, "dungeon");
      if (dungeon === undefined) return undefined;
      return { id, at, kind: "ask", dungeon, ...who(t), ...(note === undefined ? {} : { note }) };
    }
    case "ping": {
      const run = token(t, "run");
      if (run === undefined) return undefined;
      const ping: GameItem = { id, at, kind: "ping", run };
      const battleTag = text(t, "battleTag", 48);
      const guid = token(t, "guid");
      const name = text(t, "name", 48);
      if (battleTag !== undefined) ping.battleTag = battleTag;
      if (guid !== undefined) ping.guid = guid;
      if (name !== undefined) ping.name = name;
      return ping;
    }
    default:
      return undefined;
  }
}

/** The file's pending items, in order, at most MAX_GAME_ITEMS; none for a file without them (schema 1). */
export function readGameItems(chunk: LuaChunk): GameItem[] {
  const global = findGlobal(chunk);
  const out: GameItem[] = [];
  const seen = new Set<string>();
  for (const value of list(table(field(global, "pending"))).slice(0, MAX_GAME_ITEMS)) {
    const t = table(value);
    const read = t === undefined ? undefined : item(t);
    if (read === undefined || seen.has(read.id)) continue;
    seen.add(read.id);
    out.push(read);
  }
  return out;
}

/** "r-102" → 102: a run of this site; undefined for anything else. */
export function siteRunId(run: string): number | undefined {
  const m = /^r-(\d{1,15})$/.exec(run);
  return m === null ? undefined : Number(m[1]);
}
