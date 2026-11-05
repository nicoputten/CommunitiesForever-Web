import type { Dataset } from "./model";
import { stripEscapes } from "./sanitize";

// Access rules (docs/ARCHITECTURE.md "Access", WEB-06). Battle.net only tells us the BattleTag, so who belongs to the
// group comes from the uploaded data: the owner and the admins they appoint (WEB-64), members (BattleTags with a
// character on the owner's roster, WEB-85) and the guest list. The role "admin" covers the owner and the admins;
// `isOwner` tells the owner apart for what only the owner may do (the launch cut-off, the bot token, appointing admins,
// others' uploader devices).

export type Role = "admin" | "member" | "guest";

export interface Guest {
  mayUpload: boolean;
}

/** Everything the rules need, each set keyed by battleTagKey(). */
export interface AccessList {
  /** ADMIN_BATTLETAG, the owner; undefined when not configured (then nobody is admin). */
  admin: string | undefined;
  /** The admins the owner appointed (WEB-64); absent from lists made before it. */
  admins?: ReadonlySet<string>;
  members: ReadonlySet<string>;
  guests: ReadonlyMap<string, Guest>;
  blocked: ReadonlySet<string>;
}

/**
 * The key a BattleTag is compared and stored by. Battle.net treats BattleTags case-insensitively, and the admin types
 * guest BattleTags by hand, so the case of the name part does not matter.
 */
export function battleTagKey(battleTag: string): string {
  return battleTag.trim().toLowerCase();
}

/** Name#digits; the name part may hold any letters (Battle.net allows accented ones). */
const BATTLE_TAG = /^[^\s#|]{1,32}#\d{1,10}$/u;

/** A string that looks like a BattleTag; used before showing one that came from a cookie (WEB-17). */
export function isBattleTag(value: string | undefined): value is string {
  return value !== undefined && BATTLE_TAG.test(value);
}

/** The name part of a BattleTag ("Vestras#2201" → "Vestras"): how the site names the admin (WEB-17). */
export function battleTagName(battleTag: string): string {
  const name = battleTag.trim().split("#")[0];
  return name === undefined || name === "" ? battleTag.trim() : name;
}

export function sameBattleTag(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && b !== undefined && battleTagKey(a) === battleTagKey(b);
}

/** The BattleTag's role; undefined when not on the list or blocked. The owner and admins can never be blocked. */
export function roleOf(battleTag: string | undefined, list: AccessList): Role | undefined {
  if (battleTag === undefined || battleTag.trim() === "") return undefined;
  if (sameBattleTag(battleTag, list.admin)) return "admin";
  const key = battleTagKey(battleTag);
  if (list.admins?.has(key) === true) return "admin";
  if (list.blocked.has(key)) return undefined;
  if (list.members.has(key)) return "member";
  if (list.guests.has(key)) return "guest";
  return undefined;
}

export function maySignIn(battleTag: string | undefined, list: AccessList): boolean {
  return roleOf(battleTag, list) !== undefined;
}

/** Admin and members; guests only with "may upload". */
export function mayUpload(battleTag: string | undefined, list: AccessList): boolean {
  const role = roleOf(battleTag, list);
  if (role === "admin" || role === "member") return true;
  return role === "guest" && list.guests.get(battleTagKey(battleTag!))?.mayUpload === true;
}

/** The owner and the admins (WEB-64): the everyday running of the group. */
export function mayAdmin(battleTag: string | undefined, list: AccessList): boolean {
  return roleOf(battleTag, list) === "admin";
}

/** The owner (ADMIN_BATTLETAG) only: never demoted, blocked or removed through the site (WEB-64). */
export function isOwner(battleTag: string | undefined, list: AccessList): boolean {
  return sameBattleTag(battleTag, list.admin);
}

/** An appointed admin (not the owner). */
export function isAppointedAdmin(battleTag: string | undefined, list: AccessList): boolean {
  return battleTag !== undefined && !isOwner(battleTag, list) && list.admins?.has(battleTagKey(battleTag)) === true;
}

/** Nobody can block the owner or an admin: an admin has to be removed as admin first (WEB-64). */
export function mayBlock(battleTag: string, list: AccessList): boolean {
  return !isOwner(battleTag, list) && !isAppointedAdmin(battleTag, list);
}

/**
 * Why a readable file is not taken. The upload screen (WEB-19) shows each. "No community yet" with `next`: the admin
 * has uploaded before (a community switch or a fresh start since), so friends wait for the admin's next upload (WEB-83).
 * "Other community" with `none`: the file has no community at all (no `settings.clubId`: none picked in the addon, as
 * at launch when no community could be made), the admin's file too (WEB-84).
 */
export type FileRejection =
  | { code: "not-your-file"; owner?: string }
  | { code: "other-community"; none?: true }
  | { code: "no-community-yet"; next?: true };

/** The BattleTag a file belongs to: its `self.battleTag`. */
export function fileOwner(data: Dataset): string | undefined {
  return data.uploader !== undefined ? data.people[data.uploader]?.battleTag : undefined;
}

/**
 * Whether a readable file from `uploader` is accepted (the uploader may upload; checked before).
 * It must be their own file (`self.battleTag`) and of the site's community (`settings.clubId`). `community` is that of
 * the admin's uploads since the launch cut-off; undefined before the admin's first one, when only the admin can upload
 * and the admin's file sets it. After that the admin is held to it too (WEB-74): one file from another community (a
 * retail test) must not move the site or make its people members. Moving to a new community is "Switch community"
 * (WEB-83, keeps everything) or "Start fresh" (WEB-62, hides what came before), then the admin's upload.
 * `adminUploaded`: the admin has an accepted upload before this one, so a file waiting for the community waits for
 * the admin's next upload, not the first (WEB-83).
 * A file without a community (`settings.clubId`) is never taken, the admin's neither (WEB-84): its characters stay off
 * the site and out of Doomsday until the addon has a community or guild picked. The addon keeps tracking meanwhile, so
 * the first file with the community brings that day's progress along.
 */
export function checkFile(
  uploader: string,
  data: Dataset,
  community: string | undefined,
  admin: string | undefined,
  adminUploaded = false,
): FileRejection | undefined {
  const owner = fileOwner(data);
  if (!sameBattleTag(owner, uploader))
    return owner !== undefined ? { code: "not-your-file", owner } : { code: "not-your-file" };
  if (data.community.id === undefined) return { code: "other-community", none: true };
  if (community === undefined) {
    if (sameBattleTag(uploader, admin)) return undefined;
    return adminUploaded ? { code: "no-community-yet", next: true } : { code: "no-community-yet" };
  }
  if (data.community.id !== community) return { code: "other-community" };
  return undefined;
}

export function rejectionText(r: FileRejection): string {
  switch (r.code) {
    case "not-your-file":
      return r.owner !== undefined
        ? `Not your file: it belongs to ${r.owner}. Sign in as ${r.owner} to upload it.`
        : "Not your file: it names no BattleTag.";
    case "other-community":
      return r.none === true
        ? "This file has no community: pick the community or guild in the addon, then upload again."
        : "This file is for another community.";
    case "no-community-yet":
      return r.next === true
        ? "The admin has not uploaded from the new community yet; upload again after that."
        : "The admin has not uploaded yet; until then only the admin can upload.";
  }
}

/** Every BattleTag a file names: `self`, `people` and `presence`. Members before the first roster (WEB-85). */
export function battleTagsOf(data: Dataset): string[] {
  const seen = new Map<string, string>();
  const add = (tag: string | undefined) => {
    if (tag === undefined) return;
    const clean = stripEscapes(tag).trim();
    if (clean !== "" && clean.includes("#") && !seen.has(battleTagKey(clean))) seen.set(battleTagKey(clean), clean);
  };
  for (const p of Object.values(data.people)) add(p.battleTag);
  for (const l of Object.values(data.presence)) add(l.battleTag);
  return [...seen.values()];
}
