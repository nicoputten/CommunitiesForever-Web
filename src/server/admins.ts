import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { battleTagKey, isOwner, maySignIn, sameBattleTag } from "@/core/access";
import type { LogAction, LogInput } from "@/core/views/admin";
import { AccessError, adminBattleTag, loadAccessList } from "./access";
import type { Db } from "./db";
import { adminLog, admins, lastSeen, uploaderTokens } from "./db/schema";

// Co-admins (WEB-64): the owner (ADMIN_BATTLETAG) appoints and removes admins; the admin changes log; the owner's view
// of every friend's uploader devices. Each owner-only function checks the caller again (rule 6): the pages hide the
// controls, the server refuses them.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The newest admin changes kept (Nico, 2026-10-29). */
export const LOG_KEEP = 500;

export type { LogAction };
export type LogEntry = LogInput;

/** Adds a line to the admin changes log and trims it to the newest LOG_KEEP. */
export function logChange(
  db: Db | Tx,
  by: string,
  action: LogAction,
  now: number,
  target?: string,
  detail?: string,
): void {
  db.insert(adminLog)
    .values({ at: now, by, action, target: target ?? null, detail: detail ?? null })
    .run();
  const cut = db.select({ id: adminLog.id }).from(adminLog).orderBy(desc(adminLog.id)).limit(1).offset(LOG_KEEP).get();
  if (cut !== undefined)
    db.delete(adminLog)
      .where(lt(adminLog.id, cut.id + 1))
      .run();
}

/** The newest log lines, newest first. */
export function listLog(db: Db, limit = 50): LogEntry[] {
  return db
    .select()
    .from(adminLog)
    .orderBy(desc(adminLog.id))
    .limit(limit)
    .all()
    .map((r) => ({
      id: r.id,
      at: r.at,
      by: r.by,
      action: r.action as LogAction,
      ...(r.target !== null ? { target: r.target } : {}),
      ...(r.detail !== null ? { detail: r.detail } : {}),
    }));
}

export interface AdminEntry {
  battleTag: string;
  addedBy: string;
  addedAt: number;
}

export function listAdmins(db: Db): AdminEntry[] {
  return db
    .select({ battleTag: admins.battleTag, addedBy: admins.addedBy, addedAt: admins.addedAt })
    .from(admins)
    .all();
}

/** Throws unless `by` is the owner (WEB-64): the server refuses owner-only actions to admins (403 in the API). */
export function requireOwner(db: Db | Tx, by: string, owner = adminBattleTag()): void {
  if (!isOwner(by, loadAccessList(db, owner))) throw new OwnerOnlyError();
}

export class OwnerOnlyError extends AccessError {
  constructor() {
    super("Only the owner can do this. Nothing was changed.");
    this.name = "OwnerOnlyError";
  }
}

/**
 * The owner makes a friend an admin: someone who may sign in and has signed in, not the owner, not already an admin.
 */
export function appointAdmin(db: Db, battleTag: string, by: string, now: number, owner = adminBattleTag()): void {
  db.transaction((tx) => {
    requireOwner(tx, by, owner);
    const list = loadAccessList(tx, owner);
    if (sameBattleTag(battleTag, owner)) throw new AccessError("The owner is set on the server.");
    if (!maySignIn(battleTag, list)) throw new AccessError(`${battleTag} can't sign in, so can't be an admin.`);
    const key = battleTagKey(battleTag);
    if (tx.select().from(lastSeen).where(eq(lastSeen.key, key)).get() === undefined) {
      throw new AccessError("Friends can be made admin after their first sign-in.");
    }
    if (list.admins?.has(key) === true) return;
    tx.insert(admins).values({ key, battleTag: battleTag.trim(), addedBy: by, addedAt: now }).run();
    logChange(tx, by, "adminAppointed", now, battleTag.trim());
  });
}

/** The owner removes an admin; it takes effect at their next request (roles are read per request). */
export function removeAdmin(db: Db, battleTag: string, by: string, now: number, owner = adminBattleTag()): void {
  db.transaction((tx) => {
    requireOwner(tx, by, owner);
    const removed = tx
      .delete(admins)
      .where(eq(admins.key, battleTagKey(battleTag)))
      .run().changes;
    if (removed > 0) logChange(tx, by, "adminRemoved", now, battleTag.trim());
  });
}

export interface DeviceLine {
  id: number;
  battleTag: string;
  deviceName: string;
  lastUploadAt?: number;
  lastUsedAt?: number;
}

/** Every friend's active uploader devices (the owner's admin page box). */
export function allDevices(db: Db): DeviceLine[] {
  return db
    .select()
    .from(uploaderTokens)
    .where(isNull(uploaderTokens.revokedAt))
    .all()
    .map((t) => ({
      id: t.id,
      battleTag: t.battleTag,
      deviceName: t.deviceName,
      ...(t.lastUploadAt !== null ? { lastUploadAt: t.lastUploadAt } : {}),
      ...(t.lastUsedAt !== null ? { lastUsedAt: t.lastUsedAt } : {}),
    }))
    .sort((a, b) => (b.lastUploadAt ?? 0) - (a.lastUploadAt ?? 0) || a.deviceName.localeCompare(b.deviceName));
}

/** The owner revokes any friend's uploader device. */
export function revokeAnyDevice(db: Db, id: number, by: string, now: number, owner = adminBattleTag()): boolean {
  return db.transaction((tx) => {
    requireOwner(tx, by, owner);
    const t = tx
      .select()
      .from(uploaderTokens)
      .where(and(eq(uploaderTokens.id, id), isNull(uploaderTokens.revokedAt)))
      .get();
    if (t === undefined) return false;
    tx.update(uploaderTokens).set({ revokedAt: now }).where(eq(uploaderTokens.id, id)).run();
    logChange(tx, by, "deviceRevoked", now, t.deviceName, t.battleTag);
    return true;
  });
}
