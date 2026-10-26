import { cookies } from "next/headers";
import { battleTagName, isBattleTag } from "@/core/access";
import { adminBattleTag } from "./access";

// The BattleTag of a refused sign-in, for the "not on the list" page only (WEB-17). Auth.js refuses the sign-in
// without a session, so the page would not know who came back from Battle.net. The cookie is text to show, nothing
// more: access is decided by the session and the database (src/proxy.ts), so a changed cookie only changes what its
// own browser shows. It is checked as a BattleTag and rendered as text.

const COOKIE = "cf-refused";
const MINUTES = 10;

/** In the Auth.js signIn callback, when it refuses `battleTag`. */
export async function rememberRefused(battleTag: string): Promise<void> {
  if (!isBattleTag(battleTag)) return;
  (await cookies()).set(COOKIE, battleTag, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.AUTH_URL?.startsWith("https://") ?? false,
    path: "/",
    maxAge: MINUTES * 60,
  });
}

export async function refusedBattleTag(): Promise<string | undefined> {
  const value = (await cookies()).get(COOKIE)?.value;
  return isBattleTag(value) ? value : undefined;
}

/** In a server action: sign out or try another account. */
export async function forgetRefused(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** How the pages name the admin ("Send Vestras your BattleTag"); undefined without ADMIN_BATTLETAG. */
export function adminName(): string | undefined {
  const tag = adminBattleTag();
  return tag === undefined ? undefined : battleTagName(tag);
}
