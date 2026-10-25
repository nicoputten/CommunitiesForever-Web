import type { Dataset } from "./model";
import { stripEscapes } from "./sanitize";

// Access rules (docs/ARCHITECTURE.md "Access", WEB-06). Battle.net only tells us the BattleTag, so who belongs to the
// group comes from the uploaded data: the admin, members (BattleTags in accepted uploads) and the guest list.

export type Role = "admin" | "member" | "guest";

export interface Guest {
  mayUpload: boolean;
}

/** Everything the rules need, each set keyed by battleTagKey(). */
export interface AccessList {
  /** ADMIN_BATTLETAG; undefined when not configured (then nobody is admin). */
  admin: string | undefined;
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

export function sameBattleTag(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && b !== undefined && battleTagKey(a) === battleTagKey(b);
}

/** The BattleTag's role; undefined when not on the list or blocked. The admin can never be blocked. */
export function roleOf(battleTag: string | undefined, list: AccessList): Role | undefined {
  if (battleTag === undefined || battleTag.trim() === "") return undefined;
  if (sameBattleTag(battleTag, list.admin)) return "admin";
  const key = battleTagKey(battleTag);
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

export function mayAdmin(battleTag: string | undefined, list: AccessList): boolean {
  return roleOf(battleTag, list) === "admin";
}

export function mayBlock(battleTag: string, list: AccessList): boolean {
  return !sameBattleTag(battleTag, list.admin);
}

/** Why a readable file is not taken. The upload screen (WEB-19) shows each. */
export type FileRejection =
  { code: "not-your-file"; owner?: string } | { code: "other-community" } | { code: "no-community-yet" };

/** The BattleTag a file belongs to: its `self.battleTag`. */
export function fileOwner(data: Dataset): string | undefined {
  return data.uploader !== undefined ? data.people[data.uploader]?.battleTag : undefined;
}

/**
 * Whether a readable file from `uploader` is accepted (the uploader may upload; checked before).
 * It must be their own file (`self.battleTag`) and, unless the admin uploads, of the admin's community
 * (`settings.clubId`). `community` is that of the admin's uploads; undefined before the admin's first upload, when
 * only the admin can upload.
 */
export function checkFile(
  uploader: string,
  data: Dataset,
  community: string | undefined,
  admin: string | undefined,
): FileRejection | undefined {
  const owner = fileOwner(data);
  if (!sameBattleTag(owner, uploader))
    return owner !== undefined ? { code: "not-your-file", owner } : { code: "not-your-file" };
  if (sameBattleTag(uploader, admin)) return undefined;
  if (community === undefined) return { code: "no-community-yet" };
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
      return "This file is for another community.";
    case "no-community-yet":
      return "The admin has not uploaded yet; until then only the admin can upload.";
  }
}

/** Every BattleTag a file names: `self`, `people` and `presence`. These become members when the file is accepted. */
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
