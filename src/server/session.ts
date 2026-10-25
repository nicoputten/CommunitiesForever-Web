import { getToken } from "next-auth/jwt";
import { mayAdmin, mayUpload, type Role, roleOf } from "@/core/access";
import { adminBattleTag, loadAccessList } from "./access";
import { getDb, type Db } from "./db";

// Who is asking (WEB-06): the BattleTag from the session cookie, and their role from the database, per request.
// Used by src/proxy.ts for every route and by route handlers that need more than a session (CLAUDE.md rule 6).

/** Auth.js cookie names: `__Secure-` over HTTPS (behind nginx), plain on http://localhost. */
const COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

/** The signed-in BattleTag from a request's session cookie; undefined without a valid session. */
export async function sessionBattleTag(
  req: Request,
  secret: string | undefined = process.env.AUTH_SECRET,
): Promise<string | undefined> {
  if (!secret) return undefined;
  for (const cookieName of COOKIES) {
    const token = await getToken({ req, secret, cookieName, secureCookie: cookieName.startsWith("__Secure-") });
    if (typeof token?.battleTag === "string") return token.battleTag;
  }
  return undefined;
}

export type Need = "member" | "upload" | "admin";

export interface Caller {
  db: Db;
  battleTag: string;
  role: Role;
}

/** Plain text, never echoing input (CLAUDE.md rule 2). */
function deny(status: 401 | 403, message: string): Response {
  return Response.json({ error: message }, { status });
}

/**
 * The caller, or the response to send instead: 401 without a session, 403 for someone not on the list (or blocked)
 * or without the permission the route needs.
 */
export async function guard(req: Request, need: Need = "member"): Promise<Caller | Response> {
  const battleTag = await sessionBattleTag(req);
  if (battleTag === undefined) return deny(401, "Sign in first.");
  const db = getDb();
  const list = loadAccessList(db, adminBattleTag());
  const role = roleOf(battleTag, list);
  if (role === undefined) return deny(403, "You're not on the list.");
  if (need === "upload" && !mayUpload(battleTag, list)) return deny(403, "You may not upload.");
  if (need === "admin" && !mayAdmin(battleTag, list)) return deny(403, "Only the admin may do this.");
  return { db, battleTag, role };
}
