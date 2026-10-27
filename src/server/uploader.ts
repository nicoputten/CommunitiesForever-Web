import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { battleTagKey, mayUpload } from "@/core/access";
import {
  formatToken,
  MAX_TOKENS,
  normalizeUserCode,
  PAIRING_SECONDS,
  RateLimiter,
  TOKEN_BYTES,
  userCode,
} from "@/core/uploader";
import { adminBattleTag, loadAccessList } from "./access";
import type { Db } from "./db";
import { uploaderPairings, uploaderTokens } from "./db/schema";
import { UploadForbiddenError } from "./uploads";

// The uploader's pairings and tokens (WEB-33, docs/UPLOADER-API.md). A token is made only when the app collects an
// approved pairing (or by hand on the uploader page, WEB-34), shown once and stored only as its SHA-256.

/** At most this many pairings wait for approval at once, so open pairing starts can't fill the database. */
export const MAX_PENDING = 50;

/** Rate limits (decided with Nico, WEB-33). In memory: the site is one container. */
export const limits = {
  /** Pairing starts per IP. */
  start: new RateLimiter(10, 10 * 60),
  /** Polls per pairing. */
  poll: new RateLimiter(1, 1),
  /** Uploads per token. */
  upload: new RateLimiter(60, 60 * 60),
};

export class TooManyTokensError extends Error {
  constructor() {
    super(`At most ${MAX_TOKENS} uploaders per person.`);
    this.name = "TooManyTokensError";
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// --- pairing ------------------------------------------------------------------------------------------------------

export interface PairingStart {
  pairingId: string;
  userCode: string;
  expiresAt: number;
}

/** Starts a pairing; undefined when too many are waiting. Expired pairings are cleaned up first. */
export function startPairing(
  db: Db,
  deviceName: string,
  appVersion: string | undefined,
  now: number,
): PairingStart | undefined {
  return db.transaction((tx) => {
    tx.delete(uploaderPairings).where(lt(uploaderPairings.expiresAt, now)).run();
    const pending = tx
      .select({ n: sql<number>`count(*)` })
      .from(uploaderPairings)
      .where(eq(uploaderPairings.status, "pending"))
      .get();
    if ((pending?.n ?? 0) >= MAX_PENDING) return undefined;
    let code: string | undefined;
    while (code === undefined || tx.select().from(uploaderPairings).where(eq(uploaderPairings.userCode, code)).get()) {
      code = userCode(randomBytes(32));
    }
    const start = {
      pairingId: randomBytes(16).toString("base64url"),
      userCode: code,
      expiresAt: now + PAIRING_SECONDS,
    };
    tx.insert(uploaderPairings)
      .values({
        id: start.pairingId,
        userCode: code,
        deviceName,
        appVersion: appVersion ?? null,
        createdAt: now,
        expiresAt: start.expiresAt,
        status: "pending",
      })
      .run();
    return start;
  });
}

export interface PendingPairing {
  userCode: string;
  deviceName: string;
  appVersion?: string;
  expiresAt: number;
}

/** A pairing waiting for approval by its code as typed or linked; undefined for a wrong, used or expired code. */
export function findPairing(db: Db, code: string, now: number): PendingPairing | undefined {
  const userCode = normalizeUserCode(code);
  if (userCode === undefined) return undefined;
  const row = db.select().from(uploaderPairings).where(eq(uploaderPairings.userCode, userCode)).get();
  if (row === undefined || row.status !== "pending" || row.expiresAt <= now) return undefined;
  const found: PendingPairing = { userCode: row.userCode, deviceName: row.deviceName, expiresAt: row.expiresAt };
  if (row.appVersion !== null) found.appVersion = row.appVersion;
  return found;
}

/**
 * Allows or denies a waiting pairing (the uploader page, WEB-34). Only someone who may upload can allow; at most
 * MAX_TOKENS active uploaders per person, the same device name not counted (pairing it again replaces it).
 * False for a wrong, used or expired code.
 */
export function decidePairing(
  db: Db,
  code: string,
  battleTag: string,
  allow: boolean,
  now: number,
  admin = adminBattleTag(),
): boolean {
  if (allow && !mayUpload(battleTag, loadAccessList(db, admin))) throw new UploadForbiddenError(battleTag);
  const found = findPairing(db, code, now);
  if (found === undefined) return false;
  if (allow) {
    const active = activeTokens(db, battleTag).filter((t) => t.deviceName !== found.deviceName);
    if (active.length >= MAX_TOKENS) throw new TooManyTokensError();
  }
  return (
    db
      .update(uploaderPairings)
      .set({ status: allow ? "approved" : "denied", decidedBy: battleTag })
      .where(and(eq(uploaderPairings.userCode, found.userCode), eq(uploaderPairings.status, "pending")))
      .run().changes > 0
  );
}

export type PairingPoll =
  | { status: "pending" }
  | { status: "approved"; token: string; battleTag: string }
  | { status: "denied" }
  | { status: "expired" };

/**
 * The app's poll. An approved pairing is collected once: the token is made now, so it is never stored in plain text.
 * After that, and for an unknown id, the answer is "expired". Someone who lost upload rights since allowing gets
 * "denied".
 */
export function pollPairing(db: Db, pairingId: string, now: number, admin = adminBattleTag()): PairingPoll {
  return db.transaction((tx) => {
    const row = tx.select().from(uploaderPairings).where(eq(uploaderPairings.id, pairingId)).get();
    if (row === undefined || row.status === "claimed" || row.expiresAt <= now) return { status: "expired" };
    if (row.status === "pending") return { status: "pending" };
    if (row.status === "denied" || row.decidedBy === null) return { status: "denied" };
    if (!mayUpload(row.decidedBy, loadAccessList(tx as unknown as Db, admin))) {
      tx.update(uploaderPairings).set({ status: "denied" }).where(eq(uploaderPairings.id, row.id)).run();
      return { status: "denied" };
    }
    const made = createToken(tx as unknown as Db, row.decidedBy, row.deviceName, row.appVersion, "pairing", now);
    tx.update(uploaderPairings)
      .set({ status: "claimed", tokenId: made.id })
      .where(eq(uploaderPairings.id, row.id))
      .run();
    return { status: "approved", token: made.token, battleTag: row.decidedBy };
  });
}

// --- tokens -------------------------------------------------------------------------------------------------------

export interface Device {
  id: number;
  battleTag: string;
  deviceName: string;
  appVersion?: string;
  madeBy: "pairing" | "manual";
  createdAt: number;
  lastUsedAt?: number;
  lastUploadAt?: number;
  revokedAt?: number;
}

type TokenRow = typeof uploaderTokens.$inferSelect;

function device(row: TokenRow): Device {
  const d: Device = {
    id: row.id,
    battleTag: row.battleTag,
    deviceName: row.deviceName,
    madeBy: row.madeBy,
    createdAt: row.createdAt,
  };
  if (row.appVersion !== null) d.appVersion = row.appVersion;
  if (row.lastUsedAt !== null) d.lastUsedAt = row.lastUsedAt;
  if (row.lastUploadAt !== null) d.lastUploadAt = row.lastUploadAt;
  if (row.revokedAt !== null) d.revokedAt = row.revokedAt;
  return d;
}

/**
 * Makes a token for a device and returns it once. An active token of the same person and device name is revoked:
 * one token per device.
 */
export function createToken(
  db: Db,
  battleTag: string,
  deviceName: string,
  appVersion: string | null,
  madeBy: "pairing" | "manual",
  now: number,
): { id: number; token: string } {
  const key = battleTagKey(battleTag);
  db.update(uploaderTokens)
    .set({ revokedAt: now })
    .where(
      and(eq(uploaderTokens.key, key), eq(uploaderTokens.deviceName, deviceName), isNull(uploaderTokens.revokedAt)),
    )
    .run();
  if (activeTokens(db, battleTag).length >= MAX_TOKENS) throw new TooManyTokensError();
  const token = formatToken(randomBytes(TOKEN_BYTES));
  const { id } = db
    .insert(uploaderTokens)
    .values({ key, battleTag, deviceName, appVersion, tokenHash: hashToken(token), madeBy, createdAt: now })
    .returning({ id: uploaderTokens.id })
    .get();
  return { id, token };
}

/** A person's active uploaders, newest first. */
export function activeTokens(db: Db, battleTag: string): Device[] {
  return db
    .select()
    .from(uploaderTokens)
    .where(and(eq(uploaderTokens.key, battleTagKey(battleTag)), isNull(uploaderTokens.revokedAt)))
    .orderBy(desc(uploaderTokens.id))
    .all()
    .map(device);
}

/** The active device a token belongs to, or undefined (unknown or revoked). */
export function tokenDevice(db: Db, token: string): Device | undefined {
  const row = db
    .select()
    .from(uploaderTokens)
    .where(and(eq(uploaderTokens.tokenHash, hashToken(token)), isNull(uploaderTokens.revokedAt)))
    .get();
  return row === undefined ? undefined : device(row);
}

/** Notes a token's use: when, the app version, and for an upload when it last uploaded. */
export function touchToken(db: Db, id: number, now: number, appVersion?: string, uploaded = false): void {
  db.update(uploaderTokens)
    .set({
      lastUsedAt: now,
      ...(appVersion !== undefined ? { appVersion } : {}),
      ...(uploaded ? { lastUploadAt: now } : {}),
    })
    .where(eq(uploaderTokens.id, id))
    .run();
}

/** Revokes one of a person's tokens; true when it was active. */
export function revokeToken(db: Db, battleTag: string, id: number, now: number): boolean {
  return (
    db
      .update(uploaderTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(uploaderTokens.id, id),
          eq(uploaderTokens.key, battleTagKey(battleTag)),
          isNull(uploaderTokens.revokedAt),
        ),
      )
      .run().changes > 0
  );
}
