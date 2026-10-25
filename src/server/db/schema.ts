import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { UploadSummary } from "@/core/diff";
import type { Character, Dataset, Person } from "@/core/model";

// CLAUDE.md rule 5: every change here gets a new migration (`npm run db:generate -- --name <what>`); files in
// drizzle/ that were released are never edited. docs/ARCHITECTURE.md "Storage".

/** Raw uploads: the source of truth. Everything below them is derived and rebuilt by rebuild(). */
export const uploads = sqliteTable("uploads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Unix seconds. */
  uploadedAt: integer("uploaded_at").notNull(),
  /** BattleTag of the admin who uploaded. */
  uploadedBy: text("uploaded_by").notNull(),
  /** Hex SHA-256 of the raw bytes; the same file again is a no-op. */
  sha256: text("sha256").notNull().unique(),
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
});

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
