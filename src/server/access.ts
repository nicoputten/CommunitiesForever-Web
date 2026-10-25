import { asc, eq } from "drizzle-orm";
import { battleTagKey, mayBlock, type AccessList, type Role, roleOf } from "@/core/access";
import type { Db } from "./db";
import { blocks, guests, members } from "./db/schema";

// The access list from the database (WEB-06): members (derived from uploads, src/server/uploads.ts), the guest list
// and blocks (both kept by the admin page, WEB-18). The rules themselves are in src/core/access.ts.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** ADMIN_BATTLETAG (.env.example). */
export function adminBattleTag(env: Record<string, string | undefined> = process.env): string | undefined {
  const tag = env.ADMIN_BATTLETAG?.trim();
  return tag ? tag : undefined;
}

export function loadAccessList(db: Db | Tx, admin: string | undefined = adminBattleTag()): AccessList {
  return {
    admin,
    members: new Set(
      db
        .select({ key: members.key })
        .from(members)
        .all()
        .map((r) => r.key),
    ),
    guests: new Map(
      db
        .select({ key: guests.key, mayUpload: guests.mayUpload })
        .from(guests)
        .all()
        .map((r) => [r.key, { mayUpload: r.mayUpload }]),
    ),
    blocked: new Set(
      db
        .select({ key: blocks.key })
        .from(blocks)
        .all()
        .map((r) => r.key),
    ),
  };
}

/** The signed-in BattleTag's role, read from the database on every request so a block takes effect at once. */
export function currentRole(db: Db, battleTag: string | undefined, admin = adminBattleTag()): Role | undefined {
  return roleOf(battleTag, loadAccessList(db, admin));
}

export class AccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessError";
  }
}

function cleanTag(battleTag: string): string {
  const tag = battleTag.trim();
  // Name#digits; the name part may hold any letters (Battle.net allows accented ones).
  if (!/^[^\s#]{1,32}#\d{1,10}$/u.test(tag)) throw new AccessError(`"${battleTag}" is not a BattleTag (Name#1234).`);
  return tag;
}

// --- members -------------------------------------------------------------------------------------------------

export interface Member {
  battleTag: string;
  firstUpload: number;
  blocked: boolean;
}

export function listMembers(db: Db): Member[] {
  const blocked = new Set(
    db
      .select({ key: blocks.key })
      .from(blocks)
      .all()
      .map((r) => r.key),
  );
  return db
    .select()
    .from(members)
    .orderBy(asc(members.key))
    .all()
    .map((m) => ({ battleTag: m.battleTag, firstUpload: m.firstUpload, blocked: blocked.has(m.key) }));
}

// --- guest list ----------------------------------------------------------------------------------------------

export interface GuestEntry {
  battleTag: string;
  mayUpload: boolean;
  addedAt: number;
  addedBy: string;
}

export function listGuests(db: Db): GuestEntry[] {
  return db
    .select({
      battleTag: guests.battleTag,
      mayUpload: guests.mayUpload,
      addedAt: guests.addedAt,
      addedBy: guests.addedBy,
    })
    .from(guests)
    .orderBy(asc(guests.key))
    .all();
}

/** Adds a guest, or changes "may upload" of one already on the list (keeping when and by whom they were added). */
export function putGuest(
  db: Db,
  battleTag: string,
  mayUpload: boolean,
  by: string,
  now = Math.floor(Date.now() / 1000),
): GuestEntry {
  const tag = cleanTag(battleTag);
  return db
    .insert(guests)
    .values({ key: battleTagKey(tag), battleTag: tag, mayUpload, addedAt: now, addedBy: by })
    .onConflictDoUpdate({ target: guests.key, set: { mayUpload } })
    .returning({
      battleTag: guests.battleTag,
      mayUpload: guests.mayUpload,
      addedAt: guests.addedAt,
      addedBy: guests.addedBy,
    })
    .get();
}

/** Removes a guest; true when they were on the list. */
export function removeGuest(db: Db, battleTag: string): boolean {
  return (
    db
      .delete(guests)
      .where(eq(guests.key, battleTagKey(battleTag)))
      .run().changes > 0
  );
}

// --- blocks --------------------------------------------------------------------------------------------------

export interface Block {
  battleTag: string;
  blockedAt: number;
  blockedBy: string;
}

export function listBlocks(db: Db): Block[] {
  return db
    .select({ battleTag: blocks.battleTag, blockedAt: blocks.blockedAt, blockedBy: blocks.blockedBy })
    .from(blocks)
    .orderBy(asc(blocks.key))
    .all();
}

/** Blocks a BattleTag (member or guest): it can no longer sign in. The admin can't be blocked. */
export function block(
  db: Db,
  battleTag: string,
  by: string,
  now = Math.floor(Date.now() / 1000),
  admin = adminBattleTag(),
): Block {
  const tag = cleanTag(battleTag);
  if (!mayBlock(tag, loadAccessList(db, admin))) throw new AccessError("The admin can't be blocked.");
  db.insert(blocks)
    .values({ key: battleTagKey(tag), battleTag: tag, blockedAt: now, blockedBy: by })
    .onConflictDoNothing()
    .run();
  return db
    .select({ battleTag: blocks.battleTag, blockedAt: blocks.blockedAt, blockedBy: blocks.blockedBy })
    .from(blocks)
    .where(eq(blocks.key, battleTagKey(tag)))
    .get()!;
}

/** Lifts a block; true when the BattleTag was blocked. */
export function unblock(db: Db, battleTag: string): boolean {
  return (
    db
      .delete(blocks)
      .where(eq(blocks.key, battleTagKey(battleTag)))
      .run().changes > 0
  );
}
