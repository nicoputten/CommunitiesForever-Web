import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { battleTagKey, mayBlock, sameBattleTag, type AccessList, type Role, roleOf } from "@/core/access";
import type { Db } from "./db";
import { admins, blocks, guests, lastSeen, members, uploaderTokens } from "./db/schema";

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
    admins: new Set(
      db
        .select({ key: admins.key })
        .from(admins)
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
  if (!/^[^\s#]{1,32}#\d{1,10}$/u.test(tag)) throw new AccessError("That's not a BattleTag (Name#1234).");
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

/**
 * Adds a new guest from the admin page's form (WEB-18): refuses the admin, a member and someone already on the list,
 * each with the message the form shows. Changing "may upload" of a listed guest goes through putGuest.
 */
export function addGuest(
  db: Db,
  battleTag: string,
  mayUpload: boolean,
  by: string,
  now = Math.floor(Date.now() / 1000),
  admin = adminBattleTag(),
): GuestEntry {
  const tag = cleanTag(battleTag);
  if (sameBattleTag(tag, admin)) throw new AccessError("That's you, the admin.");
  // The message names the BattleTag as stored, not as typed.
  const key = battleTagKey(tag);
  const member = db.select({ battleTag: members.battleTag }).from(members).where(eq(members.key, key)).get();
  if (member !== undefined) throw new AccessError(`${member.battleTag} is already a member.`);
  const guest = db.select({ battleTag: guests.battleTag }).from(guests).where(eq(guests.key, key)).get();
  if (guest !== undefined) throw new AccessError(`${guest.battleTag} is already on the guest list.`);
  return putGuest(db, tag, mayUpload, by, now);
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
  if (!mayBlock(tag, loadAccessList(db, admin))) {
    throw new AccessError(
      sameBattleTag(tag, admin)
        ? "The owner can't be blocked."
        : `Admins and the owner can't be blocked. Remove ${tag.split("#")[0]} as admin first.`,
    );
  }
  db.insert(blocks)
    .values({ key: battleTagKey(tag), battleTag: tag, blockedAt: now, blockedBy: by })
    .onConflictDoNothing()
    .run();
  // A block also ends every uploader token (WEB-33): unblocking needs pairing again.
  db.update(uploaderTokens)
    .set({ revokedAt: now })
    .where(and(eq(uploaderTokens.key, battleTagKey(tag)), isNull(uploaderTokens.revokedAt)))
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

// --- last seen -----------------------------------------------------------------------------------------------

/** How often a BattleTag's "last seen" is written: every 5 minutes, so the admin page can say "online" (WEB-64). */
export const LAST_SEEN_EVERY = 5 * 60;

/** Notes that a signed-in BattleTag opened the site (src/proxy.ts); writes only when the stored time is 5 minutes old. */
export function touchLastSeen(db: Db, battleTag: string, now = Math.floor(Date.now() / 1000)): void {
  db.insert(lastSeen)
    .values({ key: battleTagKey(battleTag), battleTag, seenAt: now })
    .onConflictDoUpdate({
      target: lastSeen.key,
      set: { battleTag, seenAt: now },
      setWhere: lte(lastSeen.seenAt, now - LAST_SEEN_EVERY),
    })
    .run();
}

/** Last seen (Unix seconds) by battleTagKey(). */
export function listLastSeen(db: Db): Map<string, number> {
  return new Map(
    db
      .select({ key: lastSeen.key, seenAt: lastSeen.seenAt })
      .from(lastSeen)
      .all()
      .map((r) => [r.key, r.seenAt]),
  );
}
