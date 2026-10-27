import { battleTagKey, battleTagName, sameBattleTag } from "../access";
import { timeAgo } from "./age";

// The admin page (WEB-18, no board; layout decided with Nico): members from the data, the guest list, blocks, and when
// each BattleTag was last seen on the site. Times are Unix seconds; "now" is an argument.

export interface AdminInput {
  /** ADMIN_BATTLETAG. */
  admin: string | undefined;
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

export interface MemberLine {
  battleTag: string;
  /** Display name from the data, else the BattleTag's name part. */
  name: string;
  isAdmin: boolean;
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

export interface AdminView {
  members: MemberLine[];
  guests: GuestLine[];
  blocks: BlockLine[];
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

  const members: MemberLine[] = input.members.map((m) => ({
    battleTag: m.battleTag,
    name: nameOf(m.battleTag),
    isAdmin: sameBattleTag(m.battleTag, input.admin),
    // The admin is never blocked (src/core/access.ts), whatever the table says.
    blocked: m.blocked && !sameBattleTag(m.battleTag, input.admin),
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
  // The admin is listed even before their first upload names them.
  if (input.admin !== undefined && !members.some((m) => m.isAdmin)) {
    members.push({
      battleTag: input.admin,
      name: nameOf(input.admin),
      isAdmin: true,
      blocked: false,
      seen: seen(input.admin),
    });
  }
  members.sort(
    (a, b) =>
      Number(b.isAdmin) - Number(a.isAdmin) ||
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

  return { members, guests, blocks };
}
