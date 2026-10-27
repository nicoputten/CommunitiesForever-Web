"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { mayAdmin, roleOf } from "@/core/access";
import {
  authorizeUrl,
  DISCORD_CALLBACK_PATH,
  LINK_SECONDS,
  linkCookie,
  type Notice,
  pkceChallenge,
  randomCode,
  settingChange,
} from "@/core/discord";
import { adminBattleTag, loadAccessList } from "@/server/access";
import { auth } from "@/server/auth";
import { getDb, type Db } from "@/server/db";
import { discordApp, setTimeZone, unlinkDiscord, updateBotSettings } from "@/server/discord";
import { LINK_COOKIE } from "@/server/discordLink";

// The Discord page's actions (WEB-39). Each checks the caller again (CLAUDE.md rule 6): anyone on the list for their
// own link and time zone, the admin for the bot's settings. Server actions carry Next.js's Origin check, so none of
// these can be triggered from another site.

async function as<T>(need: "friend" | "admin", action: (db: Db, battleTag: string) => T): Promise<T> {
  const battleTag = (await auth())?.user?.name ?? undefined;
  const db = getDb();
  const list = loadAccessList(db, adminBattleTag());
  const ok = need === "admin" ? mayAdmin(battleTag, list) : roleOf(battleTag, list) !== undefined;
  if (battleTag === undefined || !ok) throw new Error(need === "admin" ? "Only the admin may do this." : "Sign in.");
  const result = action(db, battleTag);
  revalidatePath("/discord");
  return result;
}

const to = (notice: Notice) => `/discord?notice=${notice}`;

/**
 * "Link Discord": a fresh state and PKCE verifier in a short-lived httpOnly cookie for the callback only, then off to
 * Discord's consent page (`identify` only). The callback checks both and links to the session's BattleTag.
 */
export async function linkAction(): Promise<void> {
  await as("friend", () => undefined);
  const app = discordApp();
  if (app === undefined) redirect(to("failed"));
  const state = randomCode(randomBytes(32));
  const verifier = randomCode(randomBytes(32));
  (await cookies()).set(LINK_COOKIE, linkCookie(state, verifier), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.AUTH_URL?.startsWith("https://") ?? false,
    path: DISCORD_CALLBACK_PATH,
    maxAge: LINK_SECONDS,
  });
  const challenge = pkceChallenge(createHash("sha256").update(verifier).digest());
  redirect(authorizeUrl({ clientId: app.clientId, redirectUri: app.redirectUri, state, challenge }));
}

export async function unlinkAction(): Promise<void> {
  await as("friend", (db, battleTag) => unlinkDiscord(db, battleTag));
  redirect(to("unlinked"));
}

/** "Your time zone": the one picked on the page. */
export async function timeZoneAction(form: FormData): Promise<void> {
  const tz = String(form.get("timeZone") ?? "");
  const saved = await as("friend", (db, battleTag) => setTimeZone(db, battleTag, tz, "picked", nowSeconds()));
  if (saved) redirect(to("time-zone"));
}

/** Sent once by the browser after signing in, while no time zone is stored (src/components/shell/TimeZoneSync.tsx). */
export async function browserTimeZoneAction(timeZone: string): Promise<void> {
  const battleTag = (await auth())?.user?.name ?? undefined;
  const db = getDb();
  if (battleTag === undefined || roleOf(battleTag, loadAccessList(db, adminBattleTag())) === undefined) return;
  setTimeZone(db, battleTag, String(timeZone), "browser", nowSeconds());
}

/** One setting of the bot (a switch, a pick, the recap time or the reminder time); invalid values change nothing. */
export async function botSettingAction(form: FormData): Promise<void> {
  const change = settingChange(String(form.get("field") ?? ""), String(form.get("value") ?? ""));
  await as("admin", (db, by) => {
    if (change !== undefined) updateBotSettings(db, change, by, nowSeconds());
  });
}
