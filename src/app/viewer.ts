import type { Viewer } from "@/components/shell/viewer";
import { battleTagKey, isOwner, mayAdmin, mayUpload, roleOf } from "@/core/access";
import { adminBattleTag, loadAccessList } from "@/server/access";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db";
import { displayNames } from "@/server/uploads";

// The signed-in user as the shell shows them: BattleTag from the session, role read from the database per request
// (WEB-06), so a block or guest list change shows at once.

/** Undefined without a session or for someone not on the list (src/proxy.ts sends them away before a page renders). */
export async function getViewer(): Promise<Viewer | undefined> {
  const battleTag = (await auth())?.user?.name ?? undefined;
  if (battleTag === undefined) return undefined;
  const db = getDb();
  const list = loadAccessList(db, adminBattleTag());
  const role = roleOf(battleTag, list);
  if (role === undefined) return undefined;
  // Before a friend's first upload there is no display name yet: the part before the "#".
  const displayName = displayNames(db).get(battleTagKey(battleTag)) ?? battleTag.split("#")[0]!;
  return { battleTag, displayName, role, mayUpload: mayUpload(battleTag, list), owner: isOwner(battleTag, list) };
}

/** The admin guard for admin-only pages (/dev/components). */
export async function isAdmin(): Promise<boolean> {
  const battleTag = (await auth())?.user?.name ?? undefined;
  return battleTag !== undefined && mayAdmin(battleTag, loadAccessList(getDb(), adminBattleTag()));
}
