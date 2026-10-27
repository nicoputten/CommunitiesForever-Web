import { getToken } from "next-auth/jwt";
import { mayAdmin, mayUpload, type Role, roleOf } from "@/core/access";
import { bearerToken } from "@/core/uploader";
import { adminBattleTag, loadAccessList } from "./access";
import { getDb, type Db } from "./db";
import { type Device, tokenDevice } from "./uploader";

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

// --- the uploader app (WEB-33, docs/UPLOADER-API.md) --------------------------------------------------------------

/**
 * An uploader API error, OAuth style (RFC 6749 §5.2): `{ error: <code>, error_description: <text for logs> }`, never
 * cached.
 */
export function apiError(status: number, error: string, description: string, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("Cache-Control", "no-store");
  return Response.json({ error, error_description: description }, { status, headers: h });
}

export interface TokenCaller extends Caller {
  device: Device;
}

/**
 * The caller of an uploader API route by its Bearer token (RFC 6750), or the response to send instead: 401 with a
 * `WWW-Authenticate` challenge without a token, and `invalid_token` for an unknown or revoked one; 403
 * `may_not_upload` for someone who may not upload (the same check as guard(req, "upload"), per request). Session
 * cookies are not accepted here, and tokens nowhere else.
 */
export function tokenGuard(req: Request): TokenCaller | Response {
  const header = req.headers.get("authorization");
  if (header === null || !/^Bearer\s/i.test(header)) {
    return apiError(401, "invalid_request", "A Bearer token is required.", {
      "WWW-Authenticate": 'Bearer realm="uploader"',
    });
  }
  const token = bearerToken(header);
  const db = getDb();
  const device = token === undefined ? undefined : tokenDevice(db, token);
  if (device === undefined) {
    return apiError(401, "invalid_token", "Unknown or revoked token.", {
      "WWW-Authenticate": 'Bearer realm="uploader", error="invalid_token"',
    });
  }
  const list = loadAccessList(db, adminBattleTag());
  const role = roleOf(device.battleTag, list);
  if (role === undefined || !mayUpload(device.battleTag, list)) {
    return apiError(403, "may_not_upload", "This user may not upload.");
  }
  return { db, battleTag: device.battleTag, role, device };
}
