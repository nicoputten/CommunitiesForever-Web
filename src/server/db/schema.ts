import { blob, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { UploadSummary } from "@/core/diff";
import type { Character, Dataset, Person } from "@/core/model";

// CLAUDE.md rule 5: every change here gets a new migration (`npm run db:generate -- --name <what>`); files in
// drizzle/ that were released are never edited. docs/ARCHITECTURE.md "Storage".

/** Raw uploads: the source of truth. Everything below them is derived and rebuilt by rebuild(). */
export const uploads = sqliteTable(
  "uploads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Unix seconds. */
    uploadedAt: integer("uploaded_at").notNull(),
    /** BattleTag of who uploaded. */
    uploadedBy: text("uploaded_by").notNull(),
    /** Hex SHA-256 of the raw bytes. */
    sha256: text("sha256").notNull(),
    /** Size of the raw file in bytes. */
    size: integer("size").notNull(),
    /** The raw file, gzip. */
    raw: blob("raw", { mode: "buffer" }).notNull(),
    /** The file's schemaVersion, when it could be read. */
    schemaVersion: integer("schema_version"),
    status: text("status", { enum: ["ok", "rejected"] }).notNull(),
    /** Why the file was rejected (parse or normalize error). */
    reason: text("reason"),
    /** What this upload changed (ok uploads). */
    summary: text("summary", { mode: "json" }).$type<UploadSummary>(),
    /** The file's community (`settings.clubId`), when it could be read: the admin's uploads set the community. */
    community: text("community"),
    /** Why a readable file was not taken (WEB-06, src/core/access.ts); null for unreadable files. */
    rejection: text("rejection", { enum: ["not-your-file", "other-community", "no-community-yet"] }),
    /** Why the file could not be read (WEB-19, src/core/normalize.ts `Unreadable`); null for readable files. */
    unreadable: text("unreadable", { enum: ["not-ledger", "damaged", "newer-format"] }),
    /** The uploader token (device) that sent it (WEB-33); null for uploads from the upload page. */
    deviceId: integer("device_id"),
  },
  // The same file from the same uploader is a no-op (WEB-06: per uploader, so a file rejected as someone else's
  // does not block its owner from uploading it).
  (t) => [uniqueIndex("uploads_sha256_uploaded_by_unique").on(t.sha256, t.uploadedBy)],
);

// Derived tables: the merged Dataset (src/core/model.ts), one row per key. `data` holds the core object as JSON;
// the other columns are copies for queries.

export const people = sqliteTable("people", {
  key: text("key").primaryKey(),
  data: text("data", { mode: "json" }).$type<Person>().notNull(),
});

export const characters = sqliteTable("characters", {
  guid: text("guid").primaryKey(),
  owner: text("owner"),
  updatedAt: integer("updated_at"),
  /** The upload the current copy came from. */
  sourceUpload: integer("source_upload").references(() => uploads.id),
  /** Who relayed the owner's record to the uploader (the owner's `via`). */
  via: text("via"),
  data: text("data", { mode: "json" }).$type<Character>().notNull(),
});

export const locations = sqliteTable("locations", {
  guid: text("guid").primaryKey(),
  zone: text("zone").notNull(),
  seenAt: integer("seen_at").notNull(),
  sourceUpload: integer("source_upload").references(() => uploads.id),
});

export const presence = sqliteTable("presence", {
  guid: text("guid").primaryKey(),
  battleTag: text("battle_tag").notNull(),
  lastSeen: integer("last_seen").notNull(),
});

/** One row (id 1): the Dataset's top-level fields. */
export const meta = sqliteTable("meta", {
  id: integer("id").primaryKey(),
  data: text("data", { mode: "json" })
    .$type<Pick<Dataset, "schemaVersion" | "version" | "uploader" | "community">>()
    .notNull(),
});

// Access (WEB-06, docs/ARCHITECTURE.md "Access"). Keys are battleTagKey() (src/core/access.ts); `battle_tag` keeps the
// BattleTag as written.

/** Members: every BattleTag in an accepted upload. Derived: rebuilt with the uploads. */
export const members = sqliteTable("members", {
  key: text("key").primaryKey(),
  battleTag: text("battle_tag").notNull(),
  /** The first accepted upload that named this BattleTag. */
  firstUpload: integer("first_upload")
    .notNull()
    .references(() => uploads.id),
});

/** Blocked BattleTags (admin page). Kept apart from members, so a rebuild never lifts a block. */
export const blocks = sqliteTable("blocks", {
  key: text("key").primaryKey(),
  battleTag: text("battle_tag").notNull(),
  /** Unix seconds. */
  blockedAt: integer("blocked_at").notNull(),
  blockedBy: text("blocked_by").notNull(),
});

/** The guest list (admin page): may sign in; may upload only when ticked. */
export const guests = sqliteTable("guests", {
  key: text("key").primaryKey(),
  battleTag: text("battle_tag").notNull(),
  mayUpload: integer("may_upload", { mode: "boolean" }).notNull(),
  /** Unix seconds. */
  addedAt: integer("added_at").notNull(),
  addedBy: text("added_by").notNull(),
});

/**
 * When each signed-in BattleTag last opened the site (admin page, WEB-18). Written by src/proxy.ts at most once an
 * hour per BattleTag; sessions are JWT cookies, so there is no session table to read it from.
 */
export const lastSeen = sqliteTable("last_seen", {
  key: text("key").primaryKey(),
  battleTag: text("battle_tag").notNull(),
  /** Unix seconds. */
  seenAt: integer("seen_at").notNull(),
});

// The Windows uploader (WEB-33, docs/UPLOADER-API.md).

/** Upload tokens, one per device. Only the SHA-256 of the token is stored; a revoked token is kept for history. */
export const uploaderTokens = sqliteTable(
  "uploader_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** battleTagKey() of the owner. */
    key: text("key").notNull(),
    battleTag: text("battle_tag").notNull(),
    deviceName: text("device_name").notNull(),
    /** The app version last seen (pairing, then `X-Uploader-Version`). */
    appVersion: text("app_version"),
    /** Hex SHA-256 of the token. */
    tokenHash: text("token_hash").notNull(),
    /** How it was made: browser pairing or by hand on the uploader page. */
    madeBy: text("made_by", { enum: ["pairing", "manual"] }).notNull(),
    /** Unix seconds. */
    createdAt: integer("created_at").notNull(),
    lastUsedAt: integer("last_used_at"),
    lastUploadAt: integer("last_upload_at"),
    revokedAt: integer("revoked_at"),
  },
  (t) => [uniqueIndex("uploader_tokens_token_hash_unique").on(t.tokenHash)],
);

/** Browser pairings: short-lived; the token is made when the app collects an approved pairing. */
export const uploaderPairings = sqliteTable(
  "uploader_pairings",
  {
    /** Random, unguessable: whoever polls it collects the token. */
    id: text("id").primaryKey(),
    /** "KXRT-7QMN". */
    userCode: text("user_code").notNull(),
    deviceName: text("device_name").notNull(),
    appVersion: text("app_version"),
    /** Unix seconds. */
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    status: text("status", { enum: ["pending", "approved", "denied", "claimed"] }).notNull(),
    /** BattleTag of who allowed or denied it. */
    decidedBy: text("decided_by"),
    tokenId: integer("token_id").references(() => uploaderTokens.id),
  },
  (t) => [uniqueIndex("uploader_pairings_user_code_unique").on(t.userCode)],
);

// The Discord bot (WEB-38, docs/BOT-API.md).

/** Bot tokens: one active at a time. Only the SHA-256 of the token is stored; a revoked token is kept for history. */
export const botTokens = sqliteTable(
  "bot_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Hex SHA-256 of the token. */
    tokenHash: text("token_hash").notNull(),
    /** BattleTag of the admin who made it. */
    createdBy: text("created_by").notNull(),
    /** Unix seconds. */
    createdAt: integer("created_at").notNull(),
    lastUsedAt: integer("last_used_at"),
    revokedAt: integer("revoked_at"),
  },
  (t) => [uniqueIndex("bot_tokens_token_hash_unique").on(t.tokenHash)],
);

/**
 * What the bot posts, oldest first by id (the feed's cursor). Not derived: a rebuild of the uploads never makes or
 * removes events, so nothing is posted twice. An event is handed out until the bot acknowledges it.
 */
export const botEvents = sqliteTable("bot_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** `milestones` for now; run events follow with WEB-40 (docs/BOT-API.md). */
  type: text("type").notNull(),
  /** The event's payload as the API hands it out. */
  data: text("data", { mode: "json" }).notNull(),
  /** Unix seconds. */
  createdAt: integer("created_at").notNull(),
  /** The upload that made it (milestones). */
  uploadId: integer("upload_id"),
  /** When the bot acknowledged it, and the Discord message it posted. */
  postedAt: integer("posted_at"),
  messageId: text("message_id"),
});
