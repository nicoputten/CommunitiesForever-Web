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
