import { timingSafeEqual } from "node:crypto";
import { type Notice, parseLinkCookie } from "@/core/discord";
import type { Db } from "./db";
import { type DiscordApp, fetchDiscordUser, linkDiscord } from "./discord";

// The Discord link callback (WEB-39): Discord sends the browser back with `code` and `state`. The route
// (src/app/api/discord/callback/route.ts) needs a session like every route (src/proxy.ts); this decides the rest.

/** The state cookie set by "Link Discord" (src/app/(site)/discord/actions.ts), sent only to the callback. */
export const LINK_COOKIE = "cf-discord-link";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface CallbackInput {
  db: Db;
  app: DiscordApp | undefined;
  /** The session's BattleTag: the link is always made for whoever is signed in. */
  battleTag: string;
  params: URLSearchParams;
  cookie: string | undefined;
  now: number;
  fetcher?: typeof fetch;
}

/** Links the session's BattleTag to the Discord account that came back, or says why not. */
export async function discordCallback({ db, app, battleTag, params, cookie, now, fetcher }: CallbackInput) {
  const started = parseLinkCookie(cookie);
  const state = params.get("state") ?? "";
  // A callback without our cookie or with another state was not started here, in this browser, just now.
  if (started === undefined || !same(state, started.state)) return "expired" satisfies Notice;
  // The person said no on Discord's page (RFC 6749 §4.1.2.1).
  if (params.has("error")) return "cancelled" satisfies Notice;
  const code = params.get("code");
  if (app === undefined || code === null || code === "") return "failed" satisfies Notice;
  let user;
  try {
    user = await fetchDiscordUser(app, code, started.verifier, fetcher);
  } catch (e) {
    console.warn(`discord link: ${e instanceof Error ? e.message : "failed"}`);
    return "failed" satisfies Notice;
  }
  return linkDiscord(db, battleTag, user, now) ? ("linked" satisfies Notice) : ("taken" satisfies Notice);
}
