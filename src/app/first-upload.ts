import { battleTagName } from "@/core/access";
import { adminBattleTag } from "@/server/access";
import { getViewer } from "./viewer";

// Before the first upload (WEB-29): what the empty screens say to whom.

export interface FirstUpload {
  /** Only the owner can upload before the owner's first upload (WEB-19: "no community yet"; WEB-64). */
  canUpload: boolean;
  /** Who everyone else waits for: the name part of the admin's BattleTag. */
  adminName: string;
}

export async function getFirstUpload(): Promise<FirstUpload> {
  const viewer = await getViewer();
  const admin = adminBattleTag();
  return { canUpload: viewer?.owner === true, adminName: admin === undefined ? "The admin" : battleTagName(admin) };
}
