import { battleTagKey, battleTagName, sameBattleTag } from "../access";
import { timeAgo } from "./age";

// The admin page (WEB-18, no board; layout decided with Nico): members from the data, the guest list, blocks, and when
// each BattleTag was last seen on the site. Co-admins (WEB-64, boards `admin-coadmins`, `admin-as-admin`): the Admins
// box, owner and admin badges, the admin changes log and the owner's uploader devices. Times are Unix seconds; "now"
// is an argument.

/** Seen within this long: "● online" (Nico, 2026-10-29). */
export const ONLINE_SEEN_SECONDS = 10 * 60;

/** What kind of admin change a log line is (src/server/admins.ts writes them). */
export type LogAction =
  | "adminAppointed"
  | "adminRemoved"
  | "blocked"
  | "unblocked"
  | "guestAdded"
  | "guestChanged"
  | "guestRemoved"
  | "discordSetting"
  | "runDeleted"
  | "testPost"
  | "cutoff"
  | "cutoffUndone"
  | "botToken"
  | "deviceRevoked";

/** The changes only the owner can make: their log lines carry the crown. */
const OWNER_ACTIONS: ReadonlySet<LogAction> = new Set([
  "adminAppointed",
  "adminRemoved",
  "cutoff",
  "cutoffUndone",
  "botToken",
  "deviceRevoked",
]);

export interface LogInput {
  id: number;
  at: number;
  by: string;
  action: LogAction;
  target?: string;
  detail?: string;
}

export interface AdminInput {
  /** ADMIN_BATTLETAG: the owner. */
  admin: string | undefined;
  /** The admins the owner appointed (WEB-64). */
  admins?: readonly { battleTag: string; addedBy: string; addedAt: number }[];
  /** The admin changes log, newest first. */
  log?: readonly LogInput[];
  /** Every friend's active uploader devices (shown to the owner only). */
  devices?: readonly { id: number; battleTag: string; deviceName: string; lastUploadAt?: number }[];
  members: readonly {
    battleTag: string;
    blocked: boolean;
    /** The first accepted upload that named the BattleTag. */
    firstUpload?: { id: number; uploadedAt: number; uploadedBy: string };
  }[];
  guests: readonly { battleTag: string; mayUpload: boolean; addedAt: number; addedBy: string }[];
  blocks: readonly { battleTag: string; blockedAt: number; blockedBy: string }[];
  /** Display names by battleTagKey(), from the merged data. */
  names: ReadonlyMap<string, string>;
  /** Last seen on the site by battleTagKey(). */
  lastSeen: ReadonlyMap<string, number>;
}

/** The owner, an appointed admin, or neither. */
export type Rank = "owner" | "admin" | undefined;

export interface MemberLine {
  battleTag: string;
  /** Display name from the data, else the BattleTag's name part. */
  name: string;
  rank: Rank;
  blocked: boolean;
  /** "Added by Bob's upload" and the upload; undefined for the admin before their first upload. */
  added?: { text: string; uploadId: number; at: number };
  seen: string;
}

export interface GuestLine {
  battleTag: string;
  mayUpload: boolean;
  blocked: boolean;
  /** "Added by Nico". */
  added: string;
  addedAt: number;
  seen: string;
}

export interface BlockLine {
  battleTag: string;
  name: string;
  /** "Blocked by Nico". */
  blocked: string;
  blockedAt: number;
}

/** A friend in the Admins box: everyone who has signed in and isn't blocked, the owner first. */
export interface AdminRow {
  battleTag: string;
  name: string;
  rank: Rank;
  guest: boolean;
  seen: string;
  online: boolean;
  /** "Set on the server", "Member", "Guest, added by Bob"; an admin's line is `since`. */
  line?: string;
  /** An admin: since when and made by whom ("Admin since 12 Oct, made by Ada"). */
  since?: { at: number; by: string };
}

/** One piece of a log line: plain text, or a name or value in bold. */
export interface LogPart {
  text: string;
  strong?: boolean;
}

export interface LogLine {
  id: number;
  at: number;
  /** Who did it, by display name; the owner's line gets the gold disc. */
  who: string;
  byOwner: boolean;
  /** What they did, after the name: "made", "Bob", "an admin". */
  parts: LogPart[];
  /** A change only the owner can make: the crown and "owner". */
  ownerOnly: boolean;
}

export interface DeviceRow {
  id: number;
  deviceName: string;
  /** Whose device, by display name. */
  name: string;
  battleTag: string;
  lastUploadAt?: number;
}

export interface AdminView {
  members: MemberLine[];
  guests: GuestLine[];
  blocks: BlockLine[];
  admins: AdminRow[];
  /** "1 owner · 2 admins", "1 owner". */
  adminCount: string;
  log: LogLine[];
  devices: DeviceRow[];
  /** The owner's display name, for "Owner: Ada". */
  ownerName?: string;
}

/** "1 owner · 2 admins"; "1 owner" before anyone is appointed. */
export function adminCountText(admins: number): string {
  return admins === 0 ? "1 owner" : `1 owner · ${admins} ${admins === 1 ? "admin" : "admins"}`;
}

/** What a log line says after the name (board `admin-coadmins`, "Admin changes"). */
export function logParts(entry: LogInput, nameOf: (battleTag: string) => string): LogPart[] {
  const t = (text: string): LogPart => ({ text });
  const b = (text: string): LogPart => ({ text, strong: true });
  const target = entry.target ?? "";
  switch (entry.action) {
    case "adminAppointed":
      return [t("made "), b(nameOf(target)), t(" an admin")];
    case "adminRemoved":
      return [t("removed "), b(nameOf(target)), t(" as admin")];
    case "blocked":
      return [t("blocked "), b(target)];
    case "unblocked":
      return [t("unblocked "), b(target)];
    case "guestAdded":
      return [t("added guest "), b(target)];
    case "guestChanged":
      return entry.detail === "may upload"
        ? [t("let guest "), b(target), t(" upload")]
        : [t("stopped guest "), b(target), t(" from uploading")];
    case "guestRemoved":
      return [t("removed guest "), b(target)];
    case "runDeleted":
      return [t("deleted "), b(`${possessive(nameOf(target))}`), t(" run "), b(entry.detail ?? "")];
    case "testPost":
      return [t(`sent ${entry.detail ?? "a test post"}`)];
    case "cutoff":
      return [t("started fresh from launch")];
    case "cutoffUndone":
      return [t("undid the fresh start")];
    case "deviceRevoked":
      return [
        t("revoked uploader "),
        b(target),
        ...(entry.detail !== undefined ? [t(` of ${nameOf(entry.detail)}`)] : []),
      ];
    case "discordSetting":
    case "botToken":
      return [t(entry.detail ?? "changed a Discord setting")];
  }
}

/** "Last seen 2 h ago", "Last seen yesterday"; "Not seen yet" before their first visit since WEB-18. */
export function seenText(at: number | undefined, now: number): string {
  return at === undefined ? "Not seen yet" : `Last seen ${timeAgo(at, now)}`;
}

/** "Bob's", "Jens's": the possessive of a name, for "Added by Bob's upload". */
export function possessive(name: string): string {
  return `${name}'s`;
}

export function adminView(input: AdminInput, now: number): AdminView {
  const nameOf = (tag: string) => input.names.get(battleTagKey(tag)) ?? battleTagName(tag);
  const seen = (tag: string) => seenText(input.lastSeen.get(battleTagKey(tag)), now);
  const blocked = new Set(input.blocks.map((b) => battleTagKey(b.battleTag)));
  const appointed = new Map((input.admins ?? []).map((a) => [battleTagKey(a.battleTag), a]));
  const rankOf = (tag: string): Rank =>
    sameBattleTag(tag, input.admin) ? "owner" : appointed.has(battleTagKey(tag)) ? "admin" : undefined;

  const members: MemberLine[] = input.members.map((m) => ({
    battleTag: m.battleTag,
    name: nameOf(m.battleTag),
    rank: rankOf(m.battleTag),
    // The owner and admins are never blocked (src/core/access.ts), whatever the table says.
    blocked: m.blocked && rankOf(m.battleTag) === undefined,
    added:
      m.firstUpload === undefined
        ? undefined
        : {
            text: `Added by ${possessive(nameOf(m.firstUpload.uploadedBy))} upload`,
            uploadId: m.firstUpload.id,
            at: m.firstUpload.uploadedAt,
          },
    seen: seen(m.battleTag),
  }));
  // The owner is listed even before their first upload names them.
  if (input.admin !== undefined && !members.some((m) => m.rank === "owner")) {
    members.push({
      battleTag: input.admin,
      name: nameOf(input.admin),
      rank: "owner",
      blocked: false,
      seen: seen(input.admin),
    });
  }
  const order = (r: Rank) => (r === "owner" ? 2 : r === "admin" ? 1 : 0);
  members.sort(
    (a, b) =>
      order(b.rank) - order(a.rank) ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
      battleTagKey(a.battleTag).localeCompare(battleTagKey(b.battleTag)),
  );

  const guests: GuestLine[] = [...input.guests]
    .sort((a, b) => battleTagKey(a.battleTag).localeCompare(battleTagKey(b.battleTag)))
    .map((g) => ({
      battleTag: g.battleTag,
      mayUpload: g.mayUpload,
      blocked: blocked.has(battleTagKey(g.battleTag)),
      added: `Added by ${nameOf(g.addedBy)}`,
      addedAt: g.addedAt,
      seen: seen(g.battleTag),
    }));

  const blocks: BlockLine[] = [...input.blocks]
    .sort((a, b) => b.blockedAt - a.blockedAt || battleTagKey(a.battleTag).localeCompare(battleTagKey(b.battleTag)))
    .map((b) => ({
      battleTag: b.battleTag,
      name: nameOf(b.battleTag),
      blocked: `Blocked by ${nameOf(b.blockedBy)}`,
      blockedAt: b.blockedAt,
    }));

  // The Admins box: the owner, then everyone who has signed in and isn't blocked (members, then guests).
  const online = (tag: string) => {
    const at = input.lastSeen.get(battleTagKey(tag));
    return at !== undefined && now - at <= ONLINE_SEEN_SECONDS;
  };
  const row = (tag: string, guest: boolean, line?: string): AdminRow => {
    const rank = rankOf(tag);
    const a = appointed.get(battleTagKey(tag));
    return {
      battleTag: tag,
      name: nameOf(tag),
      rank,
      guest,
      seen: seen(tag),
      online: online(tag),
      ...(rank === "owner"
        ? { line: "Set on the server" }
        : rank === "admin" && a !== undefined
          ? { since: { at: a.addedAt, by: nameOf(a.addedBy) } }
          : line !== undefined
            ? { line }
            : {}),
    };
  };
  const signedIn = (tag: string) => input.lastSeen.has(battleTagKey(tag)) && !blocked.has(battleTagKey(tag));
  const admins: AdminRow[] = [
    ...members
      .filter((m) => m.rank !== undefined || signedIn(m.battleTag))
      .map((m) => row(m.battleTag, false, "Member")),
    ...input.guests
      .filter((g) => signedIn(g.battleTag) && !members.some((m) => sameBattleTag(m.battleTag, g.battleTag)))
      .map((g) => row(g.battleTag, true, `Guest, added by ${nameOf(g.addedBy)}`)),
  ];
  const ownerTag = input.admin;

  const log: LogLine[] = (input.log ?? []).map((e) => ({
    id: e.id,
    at: e.at,
    who: nameOf(e.by),
    byOwner: sameBattleTag(e.by, ownerTag),
    parts: logParts(e, nameOf),
    ownerOnly: OWNER_ACTIONS.has(e.action),
  }));

  const devices: DeviceRow[] = (input.devices ?? []).map((d) => ({
    id: d.id,
    deviceName: d.deviceName,
    name: nameOf(d.battleTag),
    battleTag: d.battleTag,
    ...(d.lastUploadAt !== undefined ? { lastUploadAt: d.lastUploadAt } : {}),
  }));

  return {
    members,
    guests,
    blocks,
    admins,
    adminCount: adminCountText(admins.filter((a) => a.rank === "admin").length),
    log,
    devices,
    ...(ownerTag !== undefined ? { ownerName: nameOf(ownerTag) } : {}),
  };
}

/** Why an action came back refused (`?refused=` on the admin page, WEB-64); undefined for anything else. */
export function refusedText(refused: string | undefined, who: string | undefined): string | undefined {
  switch (refused) {
    case "owner-only":
      return "Only the owner can do this. Nothing was changed.";
    case "cant-block":
      return who === undefined || who === ""
        ? "Admins and the owner can't be blocked."
        : `Admins and the owner can't be blocked. Remove ${who} as admin first.`;
    case "not-signed-in-yet":
      return "Friends can be made admin after their first sign-in.";
    case "cant-sign-in":
      return "Only friends who may sign in can be made admin.";
    default:
      return undefined;
  }
}
