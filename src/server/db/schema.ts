import { blob, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { UploadSummary } from "@/core/diff";
import type { FeatFields, FeatKind } from "@/core/doomsday/feats";
import type { GoalRecord } from "@/core/doomsday/record";
import type { FeedDay } from "@/core/feed";
import type { Recap, RecapChar } from "@/core/recap/types";
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

// Discord (WEB-39): links, time zones and the bot's settings. The bot token is WEB-38's (`bot_tokens`).

/** One Discord account per BattleTag and one BattleTag per Discord account. Never shown to others but the admin. */
export const discordLinks = sqliteTable(
  "discord_links",
  {
    /** battleTagKey() of the owner. */
    key: text("key").primaryKey(),
    battleTag: text("battle_tag").notNull(),
    /** The Discord user id (a snowflake, as text). */
    discordId: text("discord_id").notNull(),
    /** The Discord username at linking time, for the admin's linked-friends list. */
    discordName: text("discord_name").notNull(),
    /** Unix seconds. */
    linkedAt: integer("linked_at").notNull(),
  },
  (t) => [uniqueIndex("discord_links_discord_id_unique").on(t.discordId)],
);

/** Per-user settings. `time_zone` is an IANA name; null until the browser sent one or the user picked one. */
export const userPrefs = sqliteTable("user_prefs", {
  key: text("key").primaryKey(),
  battleTag: text("battle_tag").notNull(),
  timeZone: text("time_zone"),
  /** How the time zone was set: from the browser at sign-in, or picked on the Discord page. */
  timeZoneFrom: text("time_zone_from", { enum: ["browser", "picked"] }),
  /** Unix seconds. */
  updatedAt: integer("updated_at").notNull(),
});

/** One row (id 1): what the bot posts and where (Discord page, admin). Missing row: the defaults (src/core/discord.ts). */
export const botSettings = sqliteTable("bot_settings", {
  id: integer("id").primaryKey(),
  milestones: integer("milestones", { mode: "boolean" }).notNull(),
  runs: integer("runs", { mode: "boolean" }).notNull(),
  recap: integer("recap", { mode: "boolean" }).notNull(),
  /** Discord channel and role ids (snowflakes, as text); null until picked. */
  postsChannel: text("posts_channel"),
  recapChannel: text("recap_channel"),
  runsChannel: text("runs_channel"),
  mentionRole: text("mention_role"),
  /** 0 Sunday … 6 Saturday, and "HH:MM", in the admin's time zone (WEB-41). */
  recapDay: integer("recap_day").notNull(),
  recapTime: text("recap_time").notNull(),
  reminders: integer("reminders", { mode: "boolean" }).notNull(),
  /** 15, 30, 60 or 120; also the in-game toast's time. */
  reminderMinutes: integer("reminder_minutes").notNull(),
  askNow: integer("ask_now", { mode: "boolean" }).notNull(),
  markDone: integer("mark_done", { mode: "boolean" }).notNull(),
  /** Doomsday (WEB-58); defaults for rows from before it. */
  doomsdayBoard: integer("doomsday_board", { mode: "boolean" }).notNull().default(false),
  doomsdayLadder: integer("doomsday_ladder", { mode: "boolean" }).notNull().default(false),
  doomsdayChannel: text("doomsday_channel"),
  /** Feats; null: the default (posts) channel. */
  featsChannel: text("feats_channel"),
  /** Seconds after realm midnight. */
  doomsdayReset: integer("doomsday_reset").notNull().default(68400),
  doomsdayResetPrevious: integer("doomsday_reset_previous"),
  doomsdayResetChangedAt: integer("doomsday_reset_changed_at"),
  realmTimeZone: text("realm_time_zone").notNull().default("Europe/Paris"),
  /** Unix seconds and the admin's BattleTag. */
  updatedAt: integer("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});

// Planned runs (WEB-40). Not derived: they live on the site, not in the uploads.

/** A planned dungeon run. Times are Unix seconds (UTC). Deleting cancels it (kept for Discord and history). */
export const runs = sqliteTable("runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** A RUNNABLE_DUNGEONS id ("sm-armory"). */
  dungeonId: text("dungeon_id").notNull(),
  startsAt: integer("starts_at").notNull(),
  note: text("note"),
  /** The organiser's BattleTag. */
  organiser: text("organiser").notNull(),
  source: text("source", { enum: ["website", "discord", "game"] }).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  cancelledAt: integer("cancelled_at"),
  /** BattleTag of who deleted it (the organiser or the admin). */
  cancelledBy: text("cancelled_by"),
  /** When the bot's reminder and "starting now" events were written, so each is written once. */
  remindedAt: integer("reminded_at"),
  startingAt: integer("starting_at"),
  /** WEB-43: "Ran it" (from an upload's run log) or "didn't happen" (none within 4 hours of the start). */
  outcome: text("outcome", { enum: ["done", "didntHappen"] }),
  outcomeAt: integer("outcome_at"),
  /** Ran it: signed-up characters seen in the run, of those who said I'm in. */
  came: integer("came"),
  signedUp: integer("signed_up"),
  /** WEB-51: an ask ("who's up right now") is a run that starts when it is made and is open for 10 minutes. */
  kind: text("kind", { enum: ["run", "ask"] })
    .notNull()
    .default("run"),
  /** WEB-51: when an ask stops taking answers (made at + 10 minutes). */
  expiresAt: integer("expires_at"),
  /** WEB-51: when the bot's `askExpired` event was written, so it is written once. */
  expiredAt: integer("expired_at"),
});

/** One answer per friend per run; replaced when they answer again. */
export const runAnswers = sqliteTable(
  "run_answers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id),
    /** battleTagKey() of the friend. */
    key: text("key").notNull(),
    battleTag: text("battle_tag").notNull(),
    guid: text("guid"),
    /** `reserve` (WEB-47): I'm in on a full role. */
    answer: text("answer", { enum: ["in", "maybe", "cant", "reserve"] }).notNull(),
    role: text("role", { enum: ["tank", "healer", "damage"] }).notNull(),
    source: text("source", { enum: ["website", "discord", "game"] }).notNull(),
    answeredAt: integer("answered_at").notNull(),
    /** WEB-40's "Maybe, first in line"; since WEB-47 a reserve answer instead (0011 turned them into reserve). */
    waitlisted: integer("waitlisted", { mode: "boolean" }).notNull(),
    movedUp: integer("moved_up", { mode: "boolean" }).notNull(),
  },
  (t) => [uniqueIndex("run_answers_run_key_unique").on(t.runId, t.key)],
);

// The bot's Discord server (WEB-46, docs/BOT-API.md "Guild"): the channels and roles it last reported, for the Discord
// page's dropdowns. Not derived. Items gone from the latest report are kept as `present = false` while a setting
// still names them, so the page can say "(removed: # old-name)".

export const guildItems = sqliteTable(
  "guild_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["channel", "role"] }).notNull(),
    /** The Discord id (a snowflake, as text). */
    discordId: text("discord_id").notNull(),
    /** As the bot reported it: untrusted text, rendered as text only. */
    name: text("name").notNull(),
    /** Order in the latest report (Discord's own order). */
    position: integer("position").notNull(),
    present: integer("present", { mode: "boolean" }).notNull(),
  },
  (t) => [uniqueIndex("guild_items_kind_discord_id_unique").on(t.kind, t.discordId)],
);

/** One row (id 1): when the bot last reported its server. No row: it never has. */
export const guildReports = sqliteTable("guild_reports", {
  id: integer("id").primaryKey(),
  /** Unix seconds. */
  reportedAt: integer("reported_at").notNull(),
});

// History for the weekly recap (WEB-41, src/server/history.ts). Derived from the stored uploads: written with every
// accepted upload, rebuilt by rebuild(). The addon keeps only the last 7 days; these keep every day the site saw.

/** The addon's activity feed (CF-22) per realm day per character; the copy with the latest activity wins. */
export const feedDays = sqliteTable(
  "feed_days",
  {
    /** Realm day: days since 1970-01-01. */
    day: integer("day").notNull(),
    guid: text("guid").notNull(),
    /** Person key of the feed's owner. */
    owner: text("owner").notNull(),
    /** Unix seconds of the last activity that day, when known. */
    at: integer("at"),
    /** The upload it came from. */
    sourceUpload: integer("source_upload").notNull(),
    data: text("data", { mode: "json" }).$type<FeedDay>().notNull(),
  },
  (t) => [uniqueIndex("feed_days_day_guid_unique").on(t.day, t.guid)],
);

/**
 * Doomsday goals as each friend's addon recorded them (addon CF-56, WEB-55): per person, Doomsday day or week; the
 * copy with the newer `at` wins; on an equal one the stored copy stays.
 */
export const doomsdayGoals = sqliteTable(
  "doomsday_goals",
  {
    /** Person key of the goals' owner. */
    owner: text("owner").notNull(),
    /** `day` or `week`. */
    period: text("period").$type<"day" | "week">().notNull(),
    /** Doomsday day or week number (docs/DOOMSDAY.md "Schedule"). */
    n: integer("n").notNull(),
    /** When the addon last changed it, when known. */
    at: integer("at"),
    sourceUpload: integer("source_upload").notNull(),
    data: text("data", { mode: "json" }).$type<GoalRecord>().notNull(),
  },
  (t) => [uniqueIndex("doomsday_goals_owner_period_n_unique").on(t.owner, t.period, t.n)],
);

/** Per person: the streak, best, pool version and reset from the goals with the newest `at` seen (WEB-55). */
export const doomsdayStatus = sqliteTable("doomsday_status", {
  owner: text("owner").primaryKey(),
  streak: integer("streak"),
  best: integer("best"),
  pool: integer("pool"),
  reset: integer("reset"),
  /** The newest `at` of the goals it came with. */
  at: integer("at"),
  sourceUpload: integer("source_upload").notNull(),
});

/**
 * Every character's feats (WEB-56, src/server/feats.ts), derived from the uploads in order and rebuilt with them: one
 * row per character and key ("honorKills:100"). `alreadyHad`: held from the data's first arrival, never posted.
 */
export const feats = sqliteTable(
  "feats",
  {
    guid: text("guid").notNull(),
    key: text("key").notNull(),
    kind: text("kind").$type<FeatKind>().notNull(),
    /** Person key of the character's owner at the time. */
    owner: text("owner").notNull(),
    /** The upload that brought it, and when it was accepted (Unix seconds). */
    uploadId: integer("upload_id").notNull(),
    at: integer("at").notNull(),
    alreadyHad: integer("already_had", { mode: "boolean" }).notNull(),
    firstInGroup: integer("first_in_group", { mode: "boolean" }).notNull(),
    fields: text("fields", { mode: "json" }).$type<FeatFields>().notNull(),
  },
  (t) => [uniqueIndex("feats_guid_key_unique").on(t.guid, t.key)],
);

/**
 * Doomsday's bot posts (WEB-58, src/server/doomsdayPosts.ts): the board of each Doomsday day and the ladder of each
 * week, once. Not derived: a rebuild never posts again.
 */
export const doomsdayPosts = sqliteTable(
  "doomsday_posts",
  {
    kind: text("kind").$type<"board" | "ladder">().notNull(),
    /** The Doomsday day (board) or week (ladder). */
    n: integer("n").notNull(),
    /** The doomsdayBoard or doomsdayLadder event. */
    eventId: integer("event_id").notNull(),
    /** The board as last sent (canonical JSON), so an upload that changes nothing sends no update. */
    lastData: text("last_data"),
    createdAt: integer("created_at").notNull(),
    /** When the final update went out. */
    finalAt: integer("final_at"),
  },
  (t) => [primaryKey({ columns: [t.kind, t.n] })],
);

/** Every sighting of every upload (the `locations` table keeps only the newest per character). */
export const sightings = sqliteTable(
  "sightings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guid: text("guid").notNull(),
    zone: text("zone").notNull(),
    seenAt: integer("seen_at").notNull(),
    sourceUpload: integer("source_upload").notNull(),
  },
  (t) => [uniqueIndex("sightings_guid_seen_at_unique").on(t.guid, t.seenAt)],
);

/**
 * What the game sent (WEB-43, the addon's `pending`: plans, answers, asks, pings), by the item's id, so a file
 * uploaded twice changes nothing. Not derived: a rebuild doesn't apply them again. Their ids go back to the game as
 * `received` (GET /api/uploader/v1/runs), and the addon then forgets them.
 */
export const gameItems = sqliteTable("game_items", {
  id: text("id").primaryKey(),
  /** The uploader's BattleTag: the player who did it. */
  battleTag: text("battle_tag").notNull(),
  kind: text("kind", { enum: ["plan", "answer", "ask", "ping", "askAnswer"] }).notNull(),
  /** When it happened in game, and when the site got it (Unix seconds). */
  at: integer("at").notNull(),
  receivedAt: integer("received_at").notNull(),
  uploadId: integer("upload_id").notNull(),
  /** What the site did with it: "applied" or why not ("expired", "time_passed", "unknown_run", …). */
  result: text("result").notNull(),
  /** The run it made or answered. */
  runId: integer("run_id"),
});

/**
 * WEB-53: who carried a friend's ask in their file (addon CF-51), one row per carrier, also after the ask was made:
 * for the audit, and so every carrier gets the id back in `received` and the game forgets it.
 */
export const gameItemCarriers = sqliteTable(
  "game_item_carriers",
  {
    id: text("id").notNull(),
    /** The carrier's BattleTag (the uploader of the file). */
    battleTag: text("battle_tag").notNull(),
    uploadId: integer("upload_id").notNull(),
    receivedAt: integer("received_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.battleTag] })],
);

// The weekly recap (WEB-41c, src/server/recap.ts): computed once at the recap moment and stored, so a re-run never
// changes what was posted. Not derived: a rebuild of the uploads leaves it alone.

export const recaps = sqliteTable("recaps", {
  /** 1 for the first recap after launch. */
  week: integer("week").primaryKey(),
  /** Unix seconds, `[start, end)`. */
  start: integer("start").notNull(),
  end: integer("end").notNull(),
  computedAt: integer("computed_at").notNull(),
  /** The recap as posted (cards, phrasings, facts) and what later recaps need (`past`, `cycles`). */
  data: text("data", { mode: "json" }).$type<Recap>().notNull(),
  /** The characters at `end`: the next week's start. */
  snapshot: text("snapshot", { mode: "json" }).$type<Record<string, RecapChar>>().notNull(),
});

/** One row (id 1): when the site started keeping recaps; the first recap is the first moment after it. */
export const recapStart = sqliteTable("recap_start", {
  id: integer("id").primaryKey(),
  startedAt: integer("started_at").notNull(),
});
