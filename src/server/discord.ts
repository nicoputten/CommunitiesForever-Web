import { asc, eq } from "drizzle-orm";
import { battleTagKey, sameBattleTag } from "@/core/access";
import {
  type BotSettings,
  botSettingsFrom,
  DISCORD_ME_URL,
  DISCORD_REVOKE_URL,
  DISCORD_TOKEN_URL,
  type DiscordUser,
  discordRedirectUri,
  discordUser,
  isTimeZone,
} from "@/core/discord";
import { adminBattleTag, listGuests, listMembers } from "./access";
import type { Db } from "./db";
import { botSettings, discordLinks, userPrefs } from "./db/schema";

// Discord (WEB-39): links, time zones and the bot's settings in the database, and the calls to Discord when linking.
// The rules are in src/core/discord.ts. The bot token and the bot API are WEB-38's (src/server/bot*.ts).

// --- configuration ------------------------------------------------------------------------------------------------

export interface DiscordApp {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and AUTH_URL (.env.example); undefined while any is missing. */
export function discordApp(env: Record<string, string | undefined> = process.env): DiscordApp | undefined {
  const clientId = env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = env.DISCORD_CLIENT_SECRET?.trim();
  const site = env.AUTH_URL?.trim();
  if (!clientId || !clientSecret || !site) return undefined;
  return { clientId, clientSecret, redirectUri: discordRedirectUri(site) };
}

// --- talking to Discord -------------------------------------------------------------------------------------------

export class DiscordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscordError";
  }
}

/**
 * Trades the callback's code for the Discord user: token exchange (with the PKCE verifier), `/users/@me`, then the
 * access token is revoked. Only the user's id and username leave this function; no token is stored. Logs and errors
 * never carry the code or a token.
 */
export async function fetchDiscordUser(
  app: DiscordApp,
  code: string,
  verifier: string,
  fetcher: typeof fetch = fetch,
): Promise<DiscordUser> {
  const auth = { client_id: app.clientId, client_secret: app.clientSecret };
  const tokenRes = await fetcher(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...auth,
      grant_type: "authorization_code",
      code,
      redirect_uri: app.redirectUri,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) throw new DiscordError(`token exchange failed (${tokenRes.status})`);
  const body: unknown = await tokenRes.json();
  const token = (body as { access_token?: unknown } | null)?.access_token;
  const scope = (body as { scope?: unknown } | null)?.scope;
  if (typeof token !== "string" || token === "") throw new DiscordError("no access token");
  try {
    if (typeof scope === "string" && scope.split(" ").some((s) => s !== "identify")) {
      throw new DiscordError("more than the identify scope");
    }
    const meRes = await fetcher(DISCORD_ME_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!meRes.ok) throw new DiscordError(`users/@me failed (${meRes.status})`);
    const user = discordUser(await meRes.json());
    if (user === undefined) throw new DiscordError("users/@me is not a user");
    return user;
  } finally {
    // Best effort: the token is never used again, so a failed revoke only leaves it to expire.
    await fetcher(DISCORD_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...auth, token, token_type_hint: "access_token" }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => undefined);
  }
}

// --- links --------------------------------------------------------------------------------------------------------

export interface DiscordLink {
  battleTag: string;
  discordId: string;
  discordName: string;
  linkedAt: number;
}

export function linkFor(db: Db, battleTag: string): DiscordLink | undefined {
  return db
    .select({
      battleTag: discordLinks.battleTag,
      discordId: discordLinks.discordId,
      discordName: discordLinks.discordName,
      linkedAt: discordLinks.linkedAt,
    })
    .from(discordLinks)
    .where(eq(discordLinks.key, battleTagKey(battleTag)))
    .get();
}

/** Whose Discord account this is (for the bot API, WEB-38/39b); whether they may still sign in is checked there. */
export function linkForDiscordUser(db: Db, discordId: string): DiscordLink | undefined {
  return db
    .select({
      battleTag: discordLinks.battleTag,
      discordId: discordLinks.discordId,
      discordName: discordLinks.discordName,
      linkedAt: discordLinks.linkedAt,
    })
    .from(discordLinks)
    .where(eq(discordLinks.discordId, discordId))
    .get();
}

/**
 * Links (or relinks) the BattleTag's Discord account. False when that Discord account is linked to another BattleTag:
 * it stays there until unlinked, so a link never moves without its owner.
 */
export function linkDiscord(db: Db, battleTag: string, user: DiscordUser, now: number): boolean {
  return db.transaction((tx) => {
    const other = tx
      .select({ battleTag: discordLinks.battleTag })
      .from(discordLinks)
      .where(eq(discordLinks.discordId, user.id))
      .get();
    if (other !== undefined && !sameBattleTag(other.battleTag, battleTag)) return false;
    const row = { battleTag, discordId: user.id, discordName: user.name, linkedAt: now };
    tx.insert(discordLinks)
      .values({ key: battleTagKey(battleTag), ...row })
      .onConflictDoUpdate({ target: discordLinks.key, set: row })
      .run();
    return true;
  });
}

export function unlinkDiscord(db: Db, battleTag: string): void {
  db.delete(discordLinks)
    .where(eq(discordLinks.key, battleTagKey(battleTag)))
    .run();
}

/** battleTagKey → Discord username, for the admin's linked-friends list. */
export function discordNames(db: Db): Map<string, string> {
  return new Map(
    db
      .select({ key: discordLinks.key, name: discordLinks.discordName })
      .from(discordLinks)
      .orderBy(asc(discordLinks.key))
      .all()
      .map((r) => [r.key, r.name]),
  );
}

/** Everyone who may sign in: the admin, members and guests, without the blocked ones. */
export function friendBattleTags(db: Db, admin = adminBattleTag()): string[] {
  return [
    ...(admin === undefined ? [] : [admin]),
    ...listMembers(db)
      .filter((m) => !m.blocked)
      .map((m) => m.battleTag),
    ...listGuests(db).map((g) => g.battleTag),
  ];
}

// --- time zones ---------------------------------------------------------------------------------------------------

/** The runtime's IANA time zones. */
export const TIME_ZONES: readonly string[] = Intl.supportedValuesOf("timeZone");
const KNOWN = new Set(TIME_ZONES);

/** The BattleTag's own time zone; undefined until the browser sent one or they picked one. */
export function timeZoneFor(db: Db, battleTag: string): string | undefined {
  const tz = db
    .select({ tz: userPrefs.timeZone })
    .from(userPrefs)
    .where(eq(userPrefs.key, battleTagKey(battleTag)))
    .get()?.tz;
  return isTimeZone(tz, KNOWN) ? tz : undefined;
}

/** The time zone to show and read times in: their own, else the admin's, else UTC (WEB-39). */
export function effectiveTimeZone(db: Db, battleTag: string | undefined, admin = adminBattleTag()): string {
  return (
    (battleTag === undefined ? undefined : timeZoneFor(db, battleTag)) ??
    (admin === undefined ? undefined : timeZoneFor(db, admin)) ??
    "UTC"
  );
}

/**
 * Stores a time zone. One from the browser (sent once after signing in) never replaces one already stored; one picked
 * on the Discord page always does. False for a name that isn't a time zone, or a browser one that wasn't needed.
 */
export function setTimeZone(db: Db, battleTag: string, timeZone: string, from: "browser" | "picked", now: number) {
  if (!isTimeZone(timeZone, KNOWN)) return false;
  if (from === "browser" && timeZoneFor(db, battleTag) !== undefined) return false;
  const row = { battleTag, timeZone, timeZoneFrom: from, updatedAt: now };
  db.insert(userPrefs)
    .values({ key: battleTagKey(battleTag), ...row })
    .onConflictDoUpdate({ target: userPrefs.key, set: row })
    .run();
  return true;
}

// --- the bot's settings -------------------------------------------------------------------------------------------

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** What the bot posts and where; the defaults until the admin changes something. */
export function getBotSettings(db: Db | Tx): BotSettings {
  return botSettingsFrom(db.select().from(botSettings).where(eq(botSettings.id, 1)).get());
}

/**
 * The settings as `GET /api/bot/v1/settings` adds them (docs/BOT-API.md "Settings"; optional fields within v1).
 * Channel and role ids are null until picked; the recap time is in `timeZone` (the admin's).
 */
export function botApiSettings(db: Db, admin = adminBattleTag()) {
  const s = getBotSettings(db);
  return {
    posts: { milestones: s.milestones, runs: s.runs, recap: s.recap },
    channels: { posts: s.postsChannel, recap: s.recapChannel, runs: s.runsChannel },
    mentionRole: s.mentionRole,
    recap: { day: s.recapDay, time: s.recapTime, timeZone: effectiveTimeZone(db, admin, admin) },
    runs: {
      reminders: s.reminders,
      reminderMinutes: s.reminderMinutes,
      startingNow: true,
      askNow: s.askNow,
      markDone: s.markDone,
    },
  };
}

export function updateBotSettings(db: Db, change: Partial<BotSettings>, by: string, now: number): BotSettings {
  return db.transaction((tx) => {
    const next = { ...botSettingsFrom(tx.select().from(botSettings).where(eq(botSettings.id, 1)).get()), ...change };
    const row = { ...next, updatedAt: now, updatedBy: by };
    tx.insert(botSettings)
      .values({ id: 1, ...row })
      .onConflictDoUpdate({ target: botSettings.id, set: row })
      .run();
    return next;
  });
}
