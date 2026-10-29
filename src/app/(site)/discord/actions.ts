"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { battleTagName, isOwner, mayAdmin, roleOf } from "@/core/access";
import {
  authorizeUrl,
  DISCORD_CALLBACK_PATH,
  LINK_SECONDS,
  linkCookie,
  type Notice,
  pkceChallenge,
  randomCode,
  settingChange,
  settingChangeText,
} from "@/core/discord";
import { adminBattleTag, loadAccessList } from "@/server/access";
import { logChange } from "@/server/admins";
import { testImages } from "@/core/cards/samples";
import { auth } from "@/server/auth";
import { getDb, type Db } from "@/server/db";
import { createBotToken, enqueueBotEvent, revokeBotToken } from "@/server/bot";
import {
  discordApp,
  setTimeZone,
  TIME_ZONES,
  undoDoomsdayReset,
  unlinkDiscord,
  updateBotSettings,
} from "@/server/discord";
import { LINK_COOKIE } from "@/server/discordLink";
import { loadGuild } from "@/server/guild";
import { sendTestRunPost } from "@/server/runs";

// The Discord page's actions (WEB-39). Each checks the caller again (CLAUDE.md rule 6): anyone on the list for their
// own link and time zone, the owner and admins for the bot's settings and test posts, the owner alone for the bot
// token (WEB-64). Admin changes go in the admin changes log. Server actions carry Next.js's Origin check, so none of
// these can be triggered from another site.

/**
 * Runs `action` for the caller: any friend, the owner and admins (WEB-64), or the owner only (the bot token). An admin
 * whose role was removed lands back here with a note; an owner-only action by an admin is refused with one.
 */
async function as<T>(need: "friend" | "admin" | "owner", action: (db: Db, battleTag: string) => T): Promise<T> {
  const battleTag = (await auth())?.user?.name ?? undefined;
  const db = getDb();
  const list = loadAccessList(db, adminBattleTag());
  if (battleTag === undefined || roleOf(battleTag, list) === undefined) throw new Error("Sign in.");
  if (need !== "friend" && !mayAdmin(battleTag, list)) redirect(to("admin-removed"));
  if (need === "owner" && !isOwner(battleTag, list)) redirect(to("owner-only"));
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

/**
 * One setting of the bot (a switch, a pick, the recap time, the reminder time, the Doomsday reset or the realm time
 * zone); invalid values change nothing.
 */
export async function botSettingAction(form: FormData): Promise<void> {
  const field = String(form.get("field") ?? "");
  const change = settingChange(field, String(form.get("value") ?? ""), new Set(TIME_ZONES));
  await as("admin", (db, by) => {
    if (change === undefined) return;
    const now = nowSeconds();
    updateBotSettings(db, change, by, now);
    const guild = loadGuild(db);
    const name = (id: string) => [...guild.channels, ...guild.roles].find((i) => i.id === id)?.name ?? id;
    logChange(db, by, "discordSetting", now, undefined, settingChangeText(field, change, name));
  });
}

// --- the bot token and test post (WEB-39 on WEB-38's token) ----------------------------------------------------------

/** What the token card shows after "Create token": the token, once. It lives only in the form's state. */
export interface BotTokenState {
  token?: string;
}

/** Makes the bot token (the one before stops working) and hands it to the card once. */
export async function createBotTokenAction(): Promise<BotTokenState> {
  const token = await as("owner", (db, by) => {
    const now = nowSeconds();
    const made = createBotToken(db, by, now);
    logChange(db, by, "botToken", now, undefined, "made a new bot token");
    return made;
  });
  return { token };
}

export async function revokeBotTokenAction(): Promise<void> {
  await as("owner", (db, by) => {
    const now = nowSeconds();
    revokeBotToken(db, now);
    logChange(db, by, "botToken", now, undefined, "revoked the bot token");
  });
  redirect(to("bot-revoked"));
}

/** "Send a test run post" (WEB-40): a made-up `runCreated` marked as a test, never stored as a run. */
export async function testRunPostAction(): Promise<void> {
  await as("admin", (db, battleTag) => {
    const now = nowSeconds();
    sendTestRunPost(db, battleTagName(battleTag), now);
    logChange(db, battleTag, "testPost", now, undefined, "a test run post");
  });
  redirect(to("test-run-sent"));
}

/** The test posts of the Discord page's boxes (docs/BOT-API.md `test`, WEB-58): the bot posts a sample of the kind. */
const TEST_KINDS = ["posts", "feats", "recap", "doomsday"] as const;
const TEST_NAMES: Record<(typeof TEST_KINDS)[number], string> = {
  posts: "a test post",
  feats: "a test feat",
  recap: "a test recap",
  doomsday: "a test board",
};

/** "Send a test …": a `test` event of the form's `kind` (default `posts`), posted in that kind's channel. */
export async function testPostAction(form?: FormData): Promise<void> {
  const asked = String(form?.get("kind") ?? "posts");
  const kind = TEST_KINDS.find((k) => k === asked) ?? "posts";
  await as("admin", (db, by) => {
    const now = nowSeconds();
    // WEB-68: the test images, so a test post looks like the real one (an older bot ignores them).
    const images = testImages(kind);
    enqueueBotEvent(db, "test", { kind, ...(images !== undefined ? { images } : {}) }, now);
    logChange(db, by, "testPost", now, undefined, TEST_NAMES[kind]);
  });
  redirect(to("test-sent"));
}

/** Undo for a Doomsday reset change that waits for the next reset (WEB-58). */
export async function undoResetAction(): Promise<void> {
  await as("admin", (db, by) => {
    const now = nowSeconds();
    undoDoomsdayReset(db, by, now);
    logChange(db, by, "discordSetting", now, undefined, "took back the Doomsday reset change");
  });
}
