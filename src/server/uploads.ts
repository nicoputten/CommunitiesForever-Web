import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { and, asc, desc, eq, gt, gte, isNotNull, isNull, sql } from "drizzle-orm";
import {
  battleTagKey,
  checkFile,
  type FileRejection,
  fileOwner,
  mayUpload,
  rejectionText,
  sameBattleTag,
} from "@/core/access";
import { diff, type UploadSummary } from "@/core/diff";
import { readGameItems, type GameItem } from "@/core/gameItems";
import { type LedgerCounts, ledgerCounts, MAX_UPLOAD_BYTES as LIMIT, type StoredUpload } from "@/core/views/upload";
import { datasetSince, feedsSince, goalsSince } from "@/core/cutoff";
import { readAllGoals, type PersonGoals } from "@/core/doomsday/record";
import { readBossKills } from "@/core/bossKills";
import { readFeeds, type PersonFeed } from "@/core/feed";
import type { BossKill } from "@/core/runProgress";
import { LuaParseError, parseLua } from "@/core/lua";
import { canonical, merge } from "@/core/merge";
import type { Character, Dataset, Person, PresenceLink, Sighting } from "@/core/model";
import { dict, linkedAids, normalize, NormalizeError, type Unreadable } from "@/core/normalize";
import {
  type Fallback,
  type KeepPerson,
  membersOf,
  onlyMembers,
  readRoster,
  type Roster,
  type RosterFile,
  rosterHoldsUploader,
  rosterPeople,
} from "@/core/members";
import { adminBattleTag, loadAccessList } from "./access";
import { logChange, requireOwner } from "./admins";
import { notifyBotEvents, recordMilestones } from "./bot";
import { updateDoomsdayBoard } from "./doomsdayPosts";
import { recordFeats } from "./feats";
import { clearRecipes, recordRecipes } from "./recipes";
import { recordRecipeFinds } from "./recipeBot";
import { applyGameItems, markRanIt, runAnswersOf } from "./gameItems";
import type { Db } from "./db";
import { clearHistory, recordBossKills, recordFeeds, recordGoals, recordSightings, relinkHistory } from "./history";
import { cutoffAt } from "./cutoff";
import {
  latestSwitch,
  listSwitches,
  removeSwitch,
  storeSwitch,
  switchedAfter,
  type CommunitySwitch,
} from "./communitySwitch";
import {
  blocks,
  characters,
  locations,
  members,
  membersBefore,
  meta,
  people,
  presence,
  uploaderTokens,
  uploads,
} from "./db/schema";

// The upload service (docs/ARCHITECTURE.md "Data flow"): raw uploads are stored first and are the source of truth;
// the derived tables hold the merge of all ok uploads and can be rebuilt from them at any time.

/** Larger files are refused and not stored (the browser checks the same limit, WEB-19). */
export const MAX_UPLOAD_BYTES = LIMIT;

export class UploadTooLargeError extends Error {
  constructor(readonly size: number) {
    super(`The file is ${size} bytes; the limit is ${MAX_UPLOAD_BYTES} bytes.`);
    this.name = "UploadTooLargeError";
  }
}

/** The uploader may not upload (WEB-06): nothing is stored. Routes answer 403. */
export class UploadForbiddenError extends Error {
  constructor(readonly user: string) {
    super(`${user} may not upload.`);
    this.name = "UploadForbiddenError";
  }
}

export interface UploadResult {
  id: number;
  /** Unix seconds; for a duplicate, when the earlier upload was. */
  uploadedAt: number;
  status: "ok" | "rejected";
  /** The same file was uploaded before by the same uploader: nothing changed, this is the earlier upload's result. */
  duplicate: boolean;
  reason?: string;
  /** Why a readable file was not taken: not the uploader's own file, or another community (WEB-06). */
  rejection?: FileRejection;
  /** Why the file could not be read at all (WEB-19). */
  unreadable?: Unreadable;
  /** The file's schemaVersion, when it has one (a newer format names it). */
  schemaVersion?: number;
  summary?: UploadSummary;
  /** Unix seconds of the uploader's accepted upload before this one ("the same data as your upload of …"). */
  previousUploadAt?: number;
  /** Characters with a record in the file, and their owners; for a readable file (the uploader app, WEB-33). */
  counts?: LedgerCounts;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Read =
  | {
      ok: true;
      data: Dataset;
      feeds: PersonFeed[];
      goals: PersonGoals[];
      /** WEB-97: the file's boss kills (records, runs in progress, live kills). */
      kills: BossKill[];
      gameItems: GameItem[];
      /** The file's roster (WEB-85), when it has one that holds the uploader (checked before the cut-off trims data). */
      roster?: RosterFile;
    }
  | { ok: false; reason: string; unreadable: Unreadable; schemaVersion?: number };

/** WEB-62: an upload read after the launch cut-off loses what dates from before it (src/core/cutoff.ts). */
function since(result: Read, cutoff: number): Read {
  if (!result.ok || cutoff === 0) return result;
  return {
    ...result,
    data: datasetSince(result.data, cutoff),
    feeds: feedsSince(result.feeds, cutoff),
    goals: goalsSince(result.goals, cutoff),
    kills: result.kills.filter((k) => k.at >= cutoff),
  };
}

function read(bytes: Uint8Array): Read {
  try {
    const chunk = parseLua(new TextDecoder().decode(bytes));
    const data = normalize(chunk);
    const roster = readRoster(chunk);
    // The feed (WEB-41) is read apart from the dataset: it is history, not part of the merged state.
    // So are the game's plans and answers (WEB-43): applied once, after the upload's transaction.
    return {
      ok: true,
      data,
      feeds: readFeeds(chunk),
      goals: readAllGoals(chunk),
      kills: readBossKills(chunk),
      gameItems: readGameItems(chunk),
      ...(roster !== undefined && rosterHoldsUploader(data, roster.guids) ? { roster } : {}),
    };
  } catch (e) {
    if (e instanceof LuaParseError) return { ok: false, reason: e.message, unreadable: "damaged" };
    if (e instanceof NormalizeError) {
      const failed: Read = { ok: false, reason: e.message, unreadable: e.code };
      if (e.schemaVersion !== undefined) failed.schemaVersion = e.schemaVersion;
      return failed;
    }
    throw e;
  }
}

/**
 * Stores an uploaded SavedVariables file and merges it into the derived tables, all in one transaction.
 * Only someone who may upload can store anything (else UploadForbiddenError). A file that does not parse or
 * normalize, is not the uploader's own or is of another community (src/core/access.ts) is stored as rejected with
 * its reason and changes nothing else. An accepted file makes members of those a roster proves (WEB-85,
 * src/core/members.ts); the data of anyone who is not a member (nor the owner, an admin or a guest) is left out.
 * The same file again from the same uploader (same SHA-256) is a no-op that returns the earlier result.
 * `deviceId`: the uploader token that sent the file (WEB-33); the checks are exactly those of the upload page.
 */
export function upload(
  db: Db,
  file: Uint8Array,
  user: string,
  now = Math.floor(Date.now() / 1000),
  admin = adminBattleTag(),
  deviceId?: number,
): UploadResult {
  if (file.byteLength > MAX_UPLOAD_BYTES) throw new UploadTooLargeError(file.byteLength);
  if (!mayUpload(user, loadAccessList(db, admin))) throw new UploadForbiddenError(user);
  const sha256 = createHash("sha256").update(file).digest("hex");
  const known = findBySha(db, sha256, user);
  if (known !== undefined && !retry(known)) return withOwner(known, file);

  const result = since(read(file), cutoffAt(db));
  let events = false;
  // WEB-85: the owner's first roster, or one that drops a GUID the proof had: every member is checked again.
  let cleanUp = false;
  const stored = db.transaction((tx): UploadResult => {
    const again = findBySha(tx, sha256, user);
    if (again !== undefined) {
      if (!retry(again)) return withOwner(again, file);
      // Same bytes, so the new row replaces the earlier attempt without losing anything.
      tx.delete(uploads).where(eq(uploads.id, again.id)).run();
    }
    const rejection = result.ok
      ? checkFile(user, result.data, adminCommunity(tx, admin), admin, adminFirstOkId(tx, admin) !== undefined)
      : undefined;
    const previous = tx
      .select({ uploadedAt: uploads.uploadedAt })
      .from(uploads)
      .where(and(eq(uploads.uploadedBy, user), eq(uploads.status, "ok")))
      .orderBy(desc(uploads.id))
      .get();
    const proofBefore = memberProof(tx, admin);

    const { id } = tx
      .insert(uploads)
      .values({
        uploadedAt: now,
        uploadedBy: user,
        sha256,
        size: file.byteLength,
        raw: gzipSync(file),
        schemaVersion: result.ok ? result.data.schemaVersion : result.schemaVersion,
        community: result.ok ? (result.data.community.id ?? null) : null,
        status: result.ok && rejection === undefined ? "ok" : "rejected",
        reason: !result.ok ? result.reason : rejection !== undefined ? rejectionText(rejection) : null,
        rejection: rejection?.code ?? null,
        unreadable: result.ok ? null : result.unreadable,
        deviceId: deviceId ?? null,
        roster: result.ok && result.roster !== undefined ? [...result.roster.guids] : null,
        rosterSeenAt: (result.ok ? result.roster?.seenAt : undefined) ?? null,
      })
      .returning({ id: uploads.id })
      .get();
    const base = { id, uploadedAt: now, duplicate: false } as const;
    if (!result.ok) {
      const failed: UploadResult = {
        ...base,
        status: "rejected",
        reason: result.reason,
        unreadable: result.unreadable,
      };
      if (result.schemaVersion !== undefined) failed.schemaVersion = result.schemaVersion;
      return failed;
    }
    const counts = ledgerCounts(result.data);
    if (rejection !== undefined) {
      return { ...base, status: "rejected", reason: rejectionText(rejection), rejection, counts };
    }

    const proof = memberProof(tx, admin);
    cleanUp = proof.owner && (!proofBefore.owner || [...(proofBefore.roster ?? [])].some((g) => !proof.roster?.has(g)));
    addMembers(tx, membersOf(result.data, proof.roster, fallbackOf(proof, id, lastUploadBefore(tx))), id);
    const before = loadState(tx);
    const merged = before === undefined ? result.data : merge(before.data, result.data);
    const { data: after, kept } = keepMembers(tx, merged, proof, admin);
    const summary = diff(before?.data, after);
    writeState(tx, after, sourcesFor(before, after, id));
    recordHistory(tx, result, after, kept, id);
    tx.update(uploads).set({ summary }).where(eq(uploads.id, id)).run();
    // Feats (WEB-56) and the Discord bot's milestones (WEB-38): none posted for the site's first upload, where
    // everything is new.
    const reached = recordFeats(tx, { id, uploadedAt: now }, before?.data, after, summary, result.feeds);
    events = recordMilestones(tx, { id, uploadedAt: now }, reached, before === undefined);
    // WEB-90: who knows which recipe; new rare finds wait for the bot (Part D).
    const recipeChanges = recordRecipes(tx, { id, uploadedAt: now }, after, true);
    // WEB-93: the bot's rare-find posts, one per character (Part D).
    if (recordRecipeFinds(tx, { id, uploadedAt: now }, recipeChanges.rare, after)) events = true;
    const ok: UploadResult = { ...base, status: "ok", summary, counts };
    if (previous !== undefined) ok.previousUploadAt = previous.uploadedAt;
    return ok;
  });
  if (events) notifyBotEvents();
  if (cleanUp) cleanUpMembers(db, user, now, admin);
  // WEB-43: the game's plans, answers, asks and pings, then which runs the run log shows. Outside the transaction:
  // each item is applied once (by its id), so an item left out by a crash is applied with the next upload.
  if (stored.status === "ok" && !stored.duplicate && result.ok) {
    const game = applyGameItems(db, stored.id, user, result.gameItems, now);
    markRanIt(db, now);
    // WEB-58: the day's Doomsday board again when the upload changed it.
    updateDoomsdayBoard(db, now);
    if (game.runAnswers > 0 && stored.summary !== undefined) {
      stored.summary = { ...stored.summary, runAnswers: game.runAnswers };
      db.update(uploads).set({ summary: stored.summary }).where(eq(uploads.id, stored.id)).run();
    }
  }
  return stored;
}

function findBySha(db: Db | Tx, sha256: string, user: string): UploadResult | undefined {
  const row = db
    .select({
      id: uploads.id,
      uploadedAt: uploads.uploadedAt,
      status: uploads.status,
      reason: uploads.reason,
      rejection: uploads.rejection,
      unreadable: uploads.unreadable,
      schemaVersion: uploads.schemaVersion,
      summary: uploads.summary,
    })
    .from(uploads)
    .where(and(eq(uploads.sha256, sha256), eq(uploads.uploadedBy, user)))
    .get();
  if (row === undefined) return undefined;
  const result: UploadResult = { id: row.id, uploadedAt: row.uploadedAt, status: row.status, duplicate: true };
  if (row.reason !== null) result.reason = row.reason;
  if (row.rejection !== null) result.rejection = { code: row.rejection };
  if (row.unreadable !== null) result.unreadable = row.unreadable;
  if (row.unreadable !== null && row.schemaVersion !== null) result.schemaVersion = row.schemaVersion;
  if (row.summary !== null) result.summary = row.summary;
  return result;
}

/**
 * What a duplicate's stored row does not hold is read again from the same bytes: the counts, and the owner of a file
 * rejected as not the uploader's.
 */
function withOwner(earlier: UploadResult, file: Uint8Array): UploadResult {
  if (earlier.unreadable !== undefined) return earlier;
  const again = read(file);
  if (!again.ok) return earlier;
  const result: UploadResult = { ...earlier, counts: ledgerCounts(again.data) };
  const owner = fileOwner(again.data);
  if (earlier.rejection?.code === "not-your-file" && owner !== undefined) {
    result.rejection = { code: "not-your-file", owner };
  }
  return result;
}

/**
 * A file rejected for the community depends on the admin's uploads, not on the file alone: the same file again is
 * checked again (the admin may have uploaded since). Every other earlier result stands.
 */
function retry(earlier: UploadResult): boolean {
  return earlier.rejection?.code === "no-community-yet" || earlier.rejection?.code === "other-community";
}

/**
 * The community of the admin's newest accepted upload since the launch cut-off and since the last community switch
 * that names one; undefined before that (WEB-74: "Start fresh" lets the admin's next upload set the community again;
 * WEB-83: so does "Switch community", without hiding anything).
 */
function adminCommunity(db: Db | Tx, admin: string | undefined): string | undefined {
  if (admin === undefined) return undefined;
  const rows = db
    .select({ uploadedBy: uploads.uploadedBy, community: uploads.community })
    .from(uploads)
    .where(
      and(
        eq(uploads.status, "ok"),
        isNotNull(uploads.community),
        gte(uploads.uploadedAt, cutoffAt(db)),
        gt(uploads.id, switchedAfter(db)),
      ),
    )
    .orderBy(desc(uploads.id))
    .all();
  return rows.find((r) => sameBattleTag(r.uploadedBy, admin))?.community ?? undefined;
}

/** The site's community for the admin page (WEB-83): its id when set, and the switch still waiting for the owner. */
export interface CommunityState {
  /** The `settings.clubId` uploads are held to; undefined while not set. */
  id?: string;
  /** Its name (`settings.clubName`) from the merged data, when that is the same community. */
  name?: string;
  /** The newest switch, while the owner hasn't uploaded since (Undo is offered only then). */
  pending?: CommunitySwitch;
}

export function communityState(db: Db | Tx, admin = adminBattleTag()): CommunityState {
  const id = adminCommunity(db, admin);
  if (id !== undefined) {
    const merged = db.select({ data: meta.data }).from(meta).where(eq(meta.id, 1)).get()?.data.community;
    return merged?.id === id && merged.name !== undefined ? { id, name: merged.name } : { id };
  }
  const last = latestSwitch(db);
  return last !== undefined ? { pending: last } : {};
}

/**
 * "Switch community" (WEB-83): from now on the community is not set, and the owner's next accepted upload sets it.
 * Nothing is rebuilt or hidden. The owner only (OwnerOnlyError for anyone else); logged in Admin changes. False when the
 * community is already not set (a stale button): nothing changes.
 */
export function switchCommunity(db: Db, by: string, now: number, admin = adminBattleTag()): boolean {
  return db.transaction((tx) => {
    requireOwner(tx, by, admin);
    if (adminCommunity(tx, admin) === undefined) return false;
    storeSwitch(tx, by, now);
    logChange(tx, by, "communitySwitched", now);
    return true;
  });
}

/**
 * Undo of a switch while the owner hasn't uploaded since (the owner only): the row goes and a rebuild reads the files
 * sent meanwhile as if it never happened (a friend's file refused as "no community yet" counts again). False when
 * there is nothing to undo.
 */
export function undoSwitchCommunity(db: Db, by: string, now: number, admin = adminBattleTag()): boolean {
  requireOwner(db, by, admin);
  const { pending } = communityState(db, admin);
  if (pending === undefined || !removeSwitch(db, pending.id)) return false;
  rebuild(db, admin);
  logChange(db, by, "communitySwitchUndone", now);
  return true;
}

// --- members (WEB-85, src/core/members.ts) ----------------------------------------------------------------------

/**
 * What proves membership now (WEB-85): the owner's newest roster, and friends' rosters that are newer than it (by
 * their `seenAt`), so a friend's upload adds who joined since and a stale list never brings back who left. Before the
 * owner's first roster: every roster so far, and `owner` false (the fallback rule still applies).
 */
export interface MemberProof {
  roster?: Roster;
  owner: boolean;
}

export function memberProof(db: Db | Tx, admin = adminBattleTag()): MemberProof {
  const rows = db
    .select({ id: uploads.id, uploadedBy: uploads.uploadedBy, seenAt: uploads.rosterSeenAt })
    .from(uploads)
    .where(and(eq(uploads.status, "ok"), isNotNull(uploads.roster)))
    .orderBy(desc(uploads.id))
    .all();
  const owner = admin !== undefined ? rows.find((r) => sameBattleTag(r.uploadedBy, admin)) : undefined;
  const ids =
    owner === undefined
      ? rows.map((r) => r.id)
      : [
          owner.id,
          ...rows
            .filter((r) => r.id !== owner.id && r.seenAt !== null && r.seenAt > (owner.seenAt ?? 0))
            .map((r) => r.id),
        ];
  const guids = new Set<string>();
  for (const id of ids) {
    const roster = db.select({ roster: uploads.roster }).from(uploads).where(eq(uploads.id, id)).get()?.roster;
    for (const guid of roster ?? []) guids.add(guid);
  }
  return guids.size > 0 ? { roster: guids, owner: owner !== undefined } : { owner: false };
}

/** Who else a file makes a member besides the proven: nobody once the owner's roster is there (src/core/members.ts). */
function fallbackOf(proof: MemberProof, uploadId: number, legacyUntil: number): Fallback {
  if (proof.owner) return "none";
  return uploadId <= legacyUntil ? "all" : "self";
}

/** The newest upload from before WEB-85 (its migration wrote it); 0 without one. */
function lastUploadBefore(db: Db | Tx): number {
  return db.select().from(membersBefore).where(eq(membersBefore.id, 1)).get()?.lastUpload ?? 0;
}

/**
 * The merged data without the people outside the group (WEB-85): kept are the owner, the admins and the guests, and
 * with a roster those with a character on it; without one every member (and people without a BattleTag), as before.
 * `kept` tells whose history (feed, Doomsday, sightings) is recorded.
 */
function keepMembers(
  tx: Tx,
  merged: Dataset,
  proof: MemberProof,
  admin: string | undefined,
): { data: Dataset; kept: { person: (key: string) => boolean; guid: (guid: string) => boolean } } {
  const list = loadAccessList(tx, admin);
  const roster = proof.owner ? proof.roster : undefined;
  const linked = roster !== undefined ? rosterPeople(merged, roster) : undefined;
  const keep: KeepPerson = (p) => {
    const tag = p.battleTag;
    if (tag !== undefined) {
      const key = battleTagKey(tag);
      if (sameBattleTag(tag, list.admin) || list.admins?.has(key) === true || list.guests.has(key)) return true;
      if (list.members.has(key)) return true;
    }
    // Once the owner's roster is there, someone without a BattleTag (known only through the community) stays when
    // proven; before it, as before WEB-85.
    return linked !== undefined ? linked.has(p.key) : tag === undefined;
  };
  const { data, dropped, droppedPeople } = onlyMembers(merged, keep, roster);
  return {
    data,
    kept: {
      person: (key) => data.people[key] !== undefined || (!droppedPeople.has(key) && roster === undefined),
      guid: (guid) => !dropped.has(guid),
    },
  };
}

/**
 * The file's feed, Doomsday goals and sightings, of the people and characters kept only. An "aid:" key the merged data
 * links to a BattleTag is recorded under the BattleTag, and history stored under it before moves over (WEB-86).
 */
function recordHistory(
  tx: Tx,
  result: Extract<Read, { ok: true }>,
  after: Dataset,
  kept: { person: (key: string) => boolean; guid: (guid: string) => boolean },
  uploadId: number,
): void {
  const links = linkedAids(after);
  const owner = (key: string) => (Object.hasOwn(after.people, key) ? key : (links.get(key) ?? key));
  recordFeeds(
    tx,
    result.feeds.map((f) => ({ ...f, owner: owner(f.owner) })).filter((f) => kept.person(f.owner)),
    uploadId,
  );
  recordGoals(
    tx,
    result.goals.map((g) => ({ ...g, owner: owner(g.owner) })).filter((g) => kept.person(g.owner)),
    uploadId,
  );
  relinkHistory(tx, links);
  recordBossKills(
    tx,
    result.kills.filter((k) => kept.guid(k.guid)),
    uploadId,
  );
  const locations = Object.fromEntries(Object.entries(result.data.locations).filter(([guid]) => kept.guid(guid)));
  recordSightings(tx, locations, uploadId);
}

/**
 * WEB-85: the owner's roster arrived for the first time or lost someone. A rebuild applies it to every upload, so
 * whoever has no character in the community stops being a member and their data, feed, Doomsday and sightings go.
 * Blocks, guests and admins stay. Each member removed is a line in Admin changes (by the owner, whose upload it was).
 */
export function cleanUpMembers(db: Db, by: string, now: number, admin = adminBattleTag()): string[] {
  const listed = () => db.select({ key: members.key, battleTag: members.battleTag }).from(members).all();
  const before = listed();
  rebuild(db, admin);
  const after = new Set(listed().map((m) => m.key));
  const blocked = new Set(
    db
      .select({ key: blocks.key })
      .from(blocks)
      .all()
      .map((b) => b.key),
  );
  const removed = before.filter((m) => !after.has(m.key) && !blocked.has(m.key)).map((m) => m.battleTag);
  for (const battleTag of removed) logChange(db, by, "memberRemoved", now, battleTag);
  return removed;
}

/** The members an accepted file makes (src/core/members.ts); the first upload that named one is kept. */
function addMembers(tx: Tx, battleTags: string[], uploadId: number): void {
  insertAll(battleTags, (slice) =>
    tx
      .insert(members)
      .values(slice.map((battleTag) => ({ key: battleTagKey(battleTag), battleTag, firstUpload: uploadId })))
      .onConflictDoNothing()
      .run(),
  );
}

/** The newest uploads, everyone's, for the upload history (WEB-19). */
export function listUploads(db: Db, limit = 20, admin = adminBattleTag()): StoredUpload[] {
  const firstOk = firstOkId(db);
  const adminFirst = adminFirstOkId(db, admin);
  return db
    .select(STORED)
    .from(uploads)
    .leftJoin(uploaderTokens, eq(uploads.deviceId, uploaderTokens.id))
    .orderBy(desc(uploads.id))
    .limit(limit)
    .all()
    .map((row) => stored(row, firstOk, adminFirst));
}

/** One person's newest uploads, from the app and manual (the uploader page's history, WEB-34). */
export interface OwnUploads {
  uploads: StoredUpload[];
  /** There are older ones than `limit`. */
  more: boolean;
  /** Device names that sent any of their uploads, revoked devices too: the history's filter chips. */
  devices: string[];
}

export function listOwnUploads(db: Db, battleTag: string, limit = 20, admin = adminBattleTag()): OwnUploads {
  const firstOk = firstOkId(db);
  const adminFirst = adminFirstOkId(db, admin);
  const own = sql`lower(${uploads.uploadedBy}) = ${battleTagKey(battleTag)}`;
  const rows = db
    .select(STORED)
    .from(uploads)
    .leftJoin(uploaderTokens, eq(uploads.deviceId, uploaderTokens.id))
    .where(own)
    .orderBy(desc(uploads.id))
    .limit(limit + 1)
    .all();
  const devices = db
    .selectDistinct({ name: uploaderTokens.deviceName })
    .from(uploads)
    .innerJoin(uploaderTokens, eq(uploads.deviceId, uploaderTokens.id))
    .where(own)
    .orderBy(asc(uploaderTokens.deviceName))
    .all()
    .map((r) => r.name);
  return {
    uploads: rows.slice(0, limit).map((row) => stored(row, firstOk, adminFirst)),
    more: rows.length > limit,
    devices,
  };
}

/** One upload for its report page; undefined when there is none. */
export function getUpload(db: Db, id: number, admin = adminBattleTag()): StoredUpload | undefined {
  const row = db
    .select(STORED)
    .from(uploads)
    .leftJoin(uploaderTokens, eq(uploads.deviceId, uploaderTokens.id))
    .where(eq(uploads.id, id))
    .get();
  return row === undefined ? undefined : stored(row, firstOkId(db), adminFirstOkId(db, admin));
}

const STORED = {
  id: uploads.id,
  uploadedAt: uploads.uploadedAt,
  uploadedBy: uploads.uploadedBy,
  status: uploads.status,
  rejection: uploads.rejection,
  unreadable: uploads.unreadable,
  schemaVersion: uploads.schemaVersion,
  summary: uploads.summary,
  community: uploads.community,
  /** The uploader app that sent it (WEB-34 "via DESKTOP-NICO"); null from the upload page. */
  device: uploaderTokens.deviceName,
};

type StoredRow = Pick<typeof uploads.$inferSelect, Exclude<keyof typeof STORED, "device">> & { device: string | null };

/** The site's first accepted upload; after the launch cut-off, the first one after it (WEB-71). */
export function firstOkId(db: Db): number | undefined {
  return db
    .select({ id: uploads.id })
    .from(uploads)
    .where(and(eq(uploads.status, "ok"), gte(uploads.uploadedAt, cutoffAt(db))))
    .orderBy(asc(uploads.id))
    .get()?.id;
}

/**
 * The admin's first accepted upload. A file refused as "no community yet" after it waited for the admin's next upload
 * (a community switch or a fresh start since), not the first (WEB-83).
 */
function adminFirstOkId(db: Db | Tx, admin: string | undefined): number | undefined {
  if (admin === undefined) return undefined;
  return db
    .select({ id: uploads.id })
    .from(uploads)
    .where(and(eq(uploads.status, "ok"), sql`lower(${uploads.uploadedBy}) = ${battleTagKey(admin)}`))
    .orderBy(asc(uploads.id))
    .get()?.id;
}

function stored(row: StoredRow, firstOk: number | undefined, adminFirst: number | undefined): StoredUpload {
  const u: StoredUpload = {
    id: row.id,
    uploadedAt: row.uploadedAt,
    uploadedBy: row.uploadedBy,
    status: row.status,
    first: row.id === firstOk,
  };
  if (row.rejection !== null) u.rejection = row.rejection;
  if (row.rejection === "no-community-yet" && adminFirst !== undefined && row.id > adminFirst) u.next = true;
  // WEB-84: a file of no community at all (none picked in the addon).
  if (row.rejection === "other-community" && row.community === null) u.none = true;
  if (row.unreadable !== null) u.unreadable = row.unreadable;
  if (row.schemaVersion !== null) u.schemaVersion = row.schemaVersion;
  if (row.summary !== null) u.summary = row.summary;
  if (row.device !== null) u.device = row.device;
  return u;
}

/** Display names by battleTagKey(), from the merged data: who the history says uploaded. */
export function displayNames(db: Db): Map<string, string> {
  const names = new Map<string, string>();
  for (const row of db.select({ data: people.data }).from(people).all()) {
    if (row.data.battleTag !== undefined) names.set(battleTagKey(row.data.battleTag), row.data.displayName);
  }
  return names;
}

export interface RebuildResult {
  ok: number;
  rejected: number;
}

/**
 * Recomputes the derived tables and members, and each upload's status, reason and summary, from all stored uploads
 * in upload order. Rejected uploads are read again too: after a site update a file with a newer schema may now be ok,
 * when it is the uploader's own and of the community. Whether the uploader may upload was checked when the file was
 * stored and is not asked again. Blocks and the guest list are not derived and stay as they are. A community switch
 * (WEB-83) only makes the community "not set" for the uploads after it: the uploads before it count as they did.
 */
export function rebuild(db: Db, admin = adminBattleTag()): RebuildResult {
  return db.transaction((tx) => {
    const ids = tx.select({ id: uploads.id }).from(uploads).orderBy(asc(uploads.id)).all();
    let state: State | undefined;
    let community: string | undefined;
    // WEB-83: whether the admin has an accepted upload yet ("no community yet" then waits for the next one).
    let adminUploaded = false;
    let launched = false;
    const counts: RebuildResult = { ok: 0, rejected: 0 };
    // WEB-85: what proves membership now decides for every upload; before the owner's roster, the fallback too.
    const proof = memberProof(tx, admin);
    const legacyUntil = lastUploadBefore(tx);
    tx.delete(members).run();
    clearHistory(tx);
    clearRecipes(tx);
    // WEB-62: uploads from before the launch cut-off count only for who may sign in (members); the rest are read
    // without what dates from before it. Their rows (status, summary) stay as they were.
    const cutoff = cutoffAt(tx);
    // WEB-83: each community switch starts the community anew for the uploads after it; nothing before it changes.
    const switches = listSwitches(tx);
    let nextSwitch = 0;
    for (const { id } of ids) {
      while ((switches[nextSwitch]?.afterUpload ?? Infinity) < id) {
        community = undefined;
        nextSwitch++;
      }
      const row = tx
        .select({ raw: uploads.raw, uploadedBy: uploads.uploadedBy, uploadedAt: uploads.uploadedAt })
        .from(uploads)
        .where(eq(uploads.id, id))
        .get();
      if (row === undefined) continue;
      const beta = row.uploadedAt < cutoff;
      // WEB-74: the cut-off starts the community anew; the admin's first upload after it sets it.
      if (!beta && !launched) {
        launched = true;
        community = undefined;
      }
      const result = beta ? read(gunzipSync(row.raw)) : since(read(gunzipSync(row.raw)), cutoff);
      if (beta) {
        if (result.ok && checkFile(row.uploadedBy, result.data, community, admin) === undefined) {
          const fileCommunity = result.data.community.id ?? null;
          if (fileCommunity !== null && sameBattleTag(row.uploadedBy, admin)) community = fileCommunity;
          if (sameBattleTag(row.uploadedBy, admin)) adminUploaded = true;
          addMembers(tx, membersOf(result.data, proof.roster, fallbackOf(proof, id, legacyUntil)), id);
        }
        continue;
      }
      if (!result.ok) {
        counts.rejected++;
        tx.update(uploads)
          .set({
            status: "rejected",
            reason: result.reason,
            rejection: null,
            unreadable: result.unreadable,
            schemaVersion: result.schemaVersion ?? null,
            community: null,
            summary: null,
          })
          .where(eq(uploads.id, id))
          .run();
        continue;
      }
      const fileCommunity = result.data.community.id ?? null;
      const rejection = checkFile(row.uploadedBy, result.data, community, admin, adminUploaded);
      if (rejection !== undefined) {
        counts.rejected++;
        tx.update(uploads)
          .set({
            status: "rejected",
            reason: rejectionText(rejection),
            rejection: rejection.code,
            unreadable: null,
            schemaVersion: result.data.schemaVersion,
            community: fileCommunity,
            summary: null,
          })
          .where(eq(uploads.id, id))
          .run();
        continue;
      }
      counts.ok++;
      if (fileCommunity !== null && sameBattleTag(row.uploadedBy, admin)) community = fileCommunity;
      if (sameBattleTag(row.uploadedBy, admin)) adminUploaded = true;
      addMembers(tx, membersOf(result.data, proof.roster, fallbackOf(proof, id, legacyUntil)), id);
      const merged = state === undefined ? result.data : merge(state.data, result.data);
      const { data: after, kept } = keepMembers(tx, merged, proof, admin);
      // The game's answers aren't applied again; the report keeps their count (WEB-43).
      const runAnswers = runAnswersOf(tx as unknown as Db, id);
      const summary: UploadSummary = { ...diff(state?.data, after), ...(runAnswers > 0 ? { runAnswers } : {}) };
      const previous = state?.data;
      state = { data: after, ...sourcesFor(state, after, id) };
      recordHistory(tx, result, after, kept, id);
      // The same feats again, never their events (WEB-56).
      recordFeats(tx, { id, uploadedAt: row.uploadedAt }, previous, after, diff(previous, after), result.feeds);
      // The same recipes again, never their rare finds (WEB-90).
      recordRecipes(tx, { id, uploadedAt: row.uploadedAt }, after, false);
      tx.update(uploads)
        .set({
          status: "ok",
          reason: null,
          rejection: null,
          unreadable: null,
          schemaVersion: result.data.schemaVersion,
          community: fileCommunity,
          summary,
        })
        .where(eq(uploads.id, id))
        .run();
    }
    clearState(tx);
    if (state !== undefined) writeState(tx, state.data, state);
    return counts;
  });
}

/**
 * WEB-84: before it, the admin's file without a community (`settings.clubId`) was taken while none was set, so a
 * database may hold accepted uploads of no community (after the launch cut-off) and their Doomsday goals. A rebuild
 * applies today's rule to them. Runs at start; true when it rebuilt. Once rebuilt nothing matches, so it runs once.
 */
export function rebuildUploadsWithoutCommunity(db: Db, admin = adminBattleTag()): boolean {
  const stale = db
    .select({ id: uploads.id })
    .from(uploads)
    .where(and(eq(uploads.status, "ok"), isNull(uploads.community), gte(uploads.uploadedAt, cutoffAt(db))))
    .get();
  if (stale === undefined) return false;
  rebuild(db, admin);
  return true;
}

// --- derived state -------------------------------------------------------------------------------------------

/** Upload each current character copy and sighting came from. */
interface Sources {
  characterSources: Map<string, number>;
  locationSources: Map<string, number>;
}

interface State extends Sources {
  data: Dataset;
}

/** A copy unchanged by this upload keeps its source; anything new or changed came from this upload. */
function sourcesFor(before: State | undefined, after: Dataset, uploadId: number): Sources {
  const characterSources = new Map<string, number>();
  for (const [guid, c] of Object.entries(after.characters)) {
    const old = before?.data.characters[guid];
    const source = before?.characterSources.get(guid);
    const same = old !== undefined && source !== undefined && canonical(old) === canonical(c);
    characterSources.set(guid, same ? source : uploadId);
  }
  const locationSources = new Map<string, number>();
  for (const [guid, s] of Object.entries(after.locations)) {
    const old = before?.data.locations[guid];
    const source = before?.locationSources.get(guid);
    const same = old !== undefined && source !== undefined && old.seenAt === s.seenAt && old.zone === s.zone;
    locationSources.set(guid, same ? source : uploadId);
  }
  return { characterSources, locationSources };
}

/** The merged state from the derived tables; undefined before the first ok upload. */
export function loadState(db: Db | Tx): State | undefined {
  const top = db.select().from(meta).where(eq(meta.id, 1)).get();
  if (top === undefined) return undefined;

  const data: Dataset = {
    ...top.data,
    community: { ...top.data.community },
    people: dict<Person>(),
    characters: dict<Character>(),
    locations: dict<Sighting>(),
    presence: dict<PresenceLink>(),
  };
  const characterSources = new Map<string, number>();
  const locationSources = new Map<string, number>();
  // Maps are rebuilt without prototype (as normalize makes them); JSON gives plain objects.
  for (const row of db.select().from(people).all()) {
    data.people[row.key] = { ...row.data, removed: Object.assign(dict<number>(), row.data.removed) };
  }
  for (const row of db.select().from(characters).all()) {
    data.characters[row.guid] = row.data;
    if (row.sourceUpload !== null) characterSources.set(row.guid, row.sourceUpload);
  }
  for (const row of db.select().from(locations).all()) {
    data.locations[row.guid] = { zone: row.zone, seenAt: row.seenAt };
    if (row.sourceUpload !== null) locationSources.set(row.guid, row.sourceUpload);
  }
  for (const row of db.select().from(presence).all()) {
    data.presence[row.guid] = { battleTag: row.battleTag, lastSeen: row.lastSeen };
  }
  return { data, characterSources, locationSources };
}

function clearState(tx: Tx): void {
  tx.delete(characters).run();
  tx.delete(locations).run();
  tx.delete(presence).run();
  tx.delete(people).run();
  tx.delete(meta).run();
}

/** SQLite limits bound variables per statement; insert in slices. */
function insertAll<T>(rows: T[], insert: (slice: T[]) => void): void {
  for (let i = 0; i < rows.length; i += 200) insert(rows.slice(i, i + 200));
}

function writeState(tx: Tx, data: Dataset, sources: Sources): void {
  clearState(tx);
  const { people: ps, characters: cs, locations: ls, presence: pr, ...top } = data;
  tx.insert(meta).values({ id: 1, data: top }).run();
  insertAll(Object.entries(ps), (slice) =>
    tx
      .insert(people)
      .values(slice.map(([key, p]) => ({ key, data: p })))
      .run(),
  );
  insertAll(Object.entries(cs), (slice) =>
    tx
      .insert(characters)
      .values(
        slice.map(([guid, c]) => ({
          guid,
          owner: c.owner ?? null,
          updatedAt: c.updatedAt ?? null,
          sourceUpload: sources.characterSources.get(guid) ?? null,
          via: (c.owner !== undefined ? ps[c.owner]?.via : undefined) ?? null,
          data: c,
        })),
      )
      .run(),
  );
  insertAll(Object.entries(ls), (slice) =>
    tx
      .insert(locations)
      .values(
        slice.map(([guid, s]) => ({
          guid,
          zone: s.zone,
          seenAt: s.seenAt,
          sourceUpload: sources.locationSources.get(guid) ?? null,
        })),
      )
      .run(),
  );
  insertAll(Object.entries(pr), (slice) =>
    tx
      .insert(presence)
      .values(slice.map(([guid, l]) => ({ guid, battleTag: l.battleTag, lastSeen: l.lastSeen })))
      .run(),
  );
}
