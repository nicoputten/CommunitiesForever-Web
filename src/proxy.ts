import { NextResponse, type NextRequest } from "next/server";
import { nowSeconds } from "@/app/clock";
import { currentRole, touchLastSeen } from "@/server/access";
import { getDb } from "@/server/db";
import { sessionBattleTag } from "@/server/session";

// Every page and API route needs a session (CLAUDE.md rule 6, WEB-06), except sign-in, Auth.js's own routes (the
// callback among them), the "not on the list" page a refused sign-in lands on, the health check (WEB-07, which
// tells only ok and the version) and the uploader and bot APIs, which check their own tokens instead (WEB-33,
// WEB-38). The role is read from the database on every request, so a block takes effect at once. Upload and admin
// routes check their permission again (src/server/session.ts guard).

const PUBLIC = ["/signin", "/not-on-list", "/api/health"];

/**
 * The tab icons and the web app manifest (WEB-36): browsers fetch them on the sign-in page too, and the manifest
 * without cookies. Only the site name is in them, which sign-in shows anyway. `/favicon.ico` skips the proxy (matcher).
 */
export const ICONS = [
  "/icon.svg",
  "/apple-icon.png",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];

/** The uploader API checks its own Bearer token (WEB-33, src/server/session.ts tokenGuard); pairing is open. */
export const UPLOADER_API = "/api/uploader/v1/";

/** The Discord bot's API checks its own Bearer token (WEB-38, src/server/session.ts botGuard). */
export const BOT_API = "/api/bot/v1/";

export function isPublic(pathname: string): boolean {
  return (
    PUBLIC.includes(pathname) ||
    ICONS.includes(pathname) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith(UPLOADER_API) ||
    pathname.startsWith(BOT_API)
  );
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();
  const api = pathname.startsWith("/api/");

  const battleTag = await sessionBattleTag(req);
  if (battleTag === undefined) {
    if (api) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const url = new URL("/signin", req.url);
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }
  if (currentRole(getDb(), battleTag) === undefined) {
    if (api) return NextResponse.json({ error: "You're not on the list." }, { status: 403 });
    return NextResponse.redirect(new URL("/not-on-list", req.url));
  }
  // "Last seen" for the admin page (WEB-18), at most one write an hour per BattleTag.
  touchLastSeen(getDb(), battleTag, nowSeconds());
  return NextResponse.next();
}

export const config = {
  // Static build output needs no session; everything else goes through the proxy.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
