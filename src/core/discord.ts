import { battleTagKey } from "./access";
import { stripEscapes } from "./sanitize";
import { base64url } from "./uploader";
import { timeAgo } from "./views/age";

// Discord (WEB-39): linking a Discord account (OAuth 2.0 authorization code flow with PKCE, `identify` only), the
// bot's settings and time zones. Pure: random bytes, hashes, "now" and the time zone list come in as arguments.

// --- linking ------------------------------------------------------------------------------------------------------

export const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
export const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
export const DISCORD_REVOKE_URL = "https://discord.com/api/oauth2/token/revoke";
export const DISCORD_ME_URL = "https://discord.com/api/users/@me";

/** The site's callback, registered as the only redirect in the Discord application (`.env.example`). */
export const DISCORD_CALLBACK_PATH = "/api/discord/callback";
/** How long a started link may take before its state cookie expires. */
export const LINK_SECONDS = 10 * 60;

/** The redirect URI for a site URL (AUTH_URL), without a doubled slash. */
export function discordRedirectUri(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "") + DISCORD_CALLBACK_PATH;
}

/** A PKCE verifier (RFC 7636) or state from 32 random bytes: 43 base64url characters. */
export function randomCode(bytes: Uint8Array): string {
  return base64url(bytes);
}

/** The PKCE S256 challenge from the SHA-256 of the verifier. */
export function pkceChallenge(verifierSha256: Uint8Array): string {
  return base64url(verifierSha256);
}

export interface AuthorizeInput {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}

/** Discord's consent page, for the `identify` scope only. */
export function authorizeUrl({ clientId, redirectUri, state, challenge }: AuthorizeInput): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "identify",
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;
}

/** The state cookie's value: state and verifier, both base64url, so a dot separates them. */
export function linkCookie(state: string, verifier: string): string {
  return `${state}.${verifier}`;
}

export function parseLinkCookie(value: string | undefined): { state: string; verifier: string } | undefined {
  const match = /^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(value ?? "");
  return match ? { state: match[1]!, verifier: match[2]! } : undefined;
}

export interface DiscordUser {
  /** A snowflake, as text. */
  id: string;
  /** The username (not the display name): unique, so the admin can tell people apart. */
  name: string;
}

/** The user from Discord's `/users/@me` answer; undefined when it isn't one. Untrusted: text only, 32 characters. */
export function discordUser(body: unknown): DiscordUser | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const { id, username } = body as Record<string, unknown>;
  if (typeof id !== "string" || !/^\d{17,20}$/.test(id)) return undefined;
  if (typeof username !== "string") return undefined;
  const name = stripEscapes(username)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 32);
  return name === "" ? undefined : { id, name };
}

/** What the Discord page says after a link or unlink (`?notice=`). */
export const NOTICES = {
  linked: "Your Discord is linked.",
  unlinked: "Your Discord is unlinked. The bot no longer answers your commands.",
  cancelled: "Linking was cancelled. Nothing changed.",
  taken: "That Discord account is linked to another friend. Unlink it there first.",
  failed: "Discord didn't answer. Nothing changed; try again.",
  expired: "That link took too long or came from another tab. Try again.",
  "time-zone": "Your time zone is saved.",
  "bot-revoked": "The bot token is revoked. The bot stops at its next call.",
  "test-sent": "Test post sent. The bot posts it in the channel for posts within a few seconds.",
  "test-run-sent":
    "Test run post sent. The bot posts it in the runs channel within a few seconds; nothing was planned.",
} as const;

export type Notice = keyof typeof NOTICES;

export function parseNotice(value: unknown): Notice | undefined {
  return typeof value === "string" && Object.hasOwn(NOTICES, value) ? (value as Notice) : undefined;
}

export function noticeOk(notice: Notice): boolean {
  return notice !== "cancelled" && notice !== "taken" && notice !== "failed" && notice !== "expired";
}

// --- linked friends (admin) ---------------------------------------------------------------------------------------

export interface LinkedFriend {
  battleTag: string;
  /** Undefined when not linked. */
  discordName?: string;
}

/** Everyone who may sign in, linked ones with their Discord username; "n of m" counts them. */
export function linkedFriends(
  battleTags: readonly string[],
  links: ReadonlyMap<string, string>,
): { rows: LinkedFriend[]; linked: number } {
  const seen = new Set<string>();
  const rows: LinkedFriend[] = [];
  for (const battleTag of battleTags) {
    const key = battleTagKey(battleTag);
    if (seen.has(key)) continue;
    seen.add(key);
    const discordName = links.get(key);
    rows.push(discordName === undefined ? { battleTag } : { battleTag, discordName });
  }
  rows.sort((a, b) => Number(b.discordName !== undefined) - Number(a.discordName !== undefined));
  return { rows, linked: rows.filter((r) => r.discordName !== undefined).length };
}

// --- the bot's settings -------------------------------------------------------------------------------------------

export const REMINDER_MINUTES = [15, 30, 60, 120] as const;
export type ReminderMinutes = (typeof REMINDER_MINUTES)[number];

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export interface BotSettings {
  milestones: boolean;
  runs: boolean;
  recap: boolean;
  postsChannel: string | null;
  recapChannel: string | null;
  runsChannel: string | null;
  mentionRole: string | null;
  /** 0 Sunday … 6 Saturday, in the admin's time zone. */
  recapDay: number;
  /** "HH:MM", in the admin's time zone. */
  recapTime: string;
  reminders: boolean;
  reminderMinutes: ReminderMinutes;
  askNow: boolean;
  markDone: boolean;
  /** Doomsday (WEB-58): the daily board and the weekly ladder posts, and their channel (null: the posts channel). */
  doomsdayBoard: boolean;
  doomsdayLadder: boolean;
  doomsdayChannel: string | null;
  /** Feats (the `milestones` event, WEB-56); null: the default channel (`postsChannel`). WEB-58 part 2. */
  featsChannel: string | null;
  /** The Doomsday reset in seconds after realm midnight (19:00 = 68400). */
  doomsdayReset: number;
  /** The reset before the last change and when it was changed: a change applies from the next reset. */
  doomsdayResetPrevious: number | null;
  doomsdayResetChangedAt: number | null;
  /** The realm's IANA time zone. */
  realmTimeZone: string;
}

/**
 * Before the admin changed anything: every post on but Doomsday's board and ladder, recap Sunday 13:00 (WEB-41),
 * reminders 30 minutes before.
 */
export const DEFAULT_BOT_SETTINGS: BotSettings = {
  milestones: true,
  runs: true,
  recap: true,
  postsChannel: null,
  recapChannel: null,
  runsChannel: null,
  mentionRole: null,
  recapDay: 0,
  recapTime: "13:00",
  reminders: true,
  reminderMinutes: 30,
  askNow: true,
  markDone: true,
  // Off until the admin turns them on at launch (Nico, 2026-10-28): deploying never posts a board by itself.
  doomsdayBoard: false,
  doomsdayLadder: false,
  doomsdayChannel: null,
  featsChannel: null,
  doomsdayReset: 68400,
  doomsdayResetPrevious: null,
  doomsdayResetChangedAt: null,
  realmTimeZone: "Europe/Paris",
};

export const SWITCHES = [
  "milestones",
  "runs",
  "recap",
  "reminders",
  "askNow",
  "markDone",
  "doomsdayBoard",
  "doomsdayLadder",
] as const;
export type SwitchName = (typeof SWITCHES)[number];

export const PICKS = [
  "postsChannel",
  "recapChannel",
  "runsChannel",
  "mentionRole",
  "doomsdayChannel",
  "featsChannel",
] as const;
export type PickName = (typeof PICKS)[number];

/** Recap times: every full hour. */
export const RECAP_TIMES = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

/** "Sunday · 13:00" for the recap select. */
export function recapLabel(day: number, time: string): string {
  return `${DAYS[day] ?? DAYS[0]} · ${time}`;
}

export function reminderLabel(minutes: number): string {
  return minutes < 60 ? `${minutes} minutes before` : `${minutes / 60} hour${minutes === 60 ? "" : "s"} before`;
}

/** "19:00" for a reset in seconds after midnight. */
export function resetLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * One field from the settings form as a change to the settings; undefined for anything that isn't a valid value
 * (the form is untrusted input). Switches take "true"/"false", picks a snowflake or "" (none), the recap "day|HH:MM",
 * the Doomsday reset "HH:MM", the realm time zone one of `zones`.
 */
export function settingChange(
  field: string,
  value: string,
  zones: ReadonlySet<string> = new Set(),
): Partial<BotSettings> | undefined {
  if ((SWITCHES as readonly string[]).includes(field)) {
    if (value !== "true" && value !== "false") return undefined;
    return { [field]: value === "true" } as Partial<BotSettings>;
  }
  if ((PICKS as readonly string[]).includes(field)) {
    if (value !== "" && !/^\d{17,20}$/.test(value)) return undefined;
    return { [field]: value === "" ? null : value } as Partial<BotSettings>;
  }
  if (field === "reminderMinutes") {
    const minutes = Number(value);
    return (REMINDER_MINUTES as readonly number[]).includes(minutes)
      ? { reminderMinutes: minutes as ReminderMinutes }
      : undefined;
  }
  if (field === "doomsdayReset") {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    return match ? { doomsdayReset: Number(match[1]) * 3600 + Number(match[2]) * 60 } : undefined;
  }
  if (field === "realmTimeZone") return isTimeZone(value, zones) ? { realmTimeZone: value } : undefined;
  if (field === "recapAt") {
    const match = /^([0-6])\|(\d\d:00)$/.exec(value);
    if (!match || !RECAP_TIMES.includes(match[2]!)) return undefined;
    return { recapDay: Number(match[1]), recapTime: match[2]! };
  }
  return undefined;
}

/** Stored settings, with defaults for anything missing or out of range (a row from an older or newer site). */
export function botSettingsFrom(row: Partial<Record<keyof BotSettings, unknown>> | undefined): BotSettings {
  const s: BotSettings = { ...DEFAULT_BOT_SETTINGS };
  if (row === undefined) return s;
  for (const name of SWITCHES) if (typeof row[name] === "boolean") s[name] = row[name];
  for (const name of PICKS) if (typeof row[name] === "string" && /^\d{17,20}$/.test(row[name])) s[name] = row[name];
  if (typeof row.recapDay === "number" && Number.isInteger(row.recapDay) && row.recapDay >= 0 && row.recapDay <= 6) {
    s.recapDay = row.recapDay;
  }
  if (typeof row.recapTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.recapTime)) s.recapTime = row.recapTime;
  if ((REMINDER_MINUTES as readonly unknown[]).includes(row.reminderMinutes)) {
    s.reminderMinutes = row.reminderMinutes as ReminderMinutes;
  }
  const seconds = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 86400;
  if (seconds(row.doomsdayReset)) s.doomsdayReset = row.doomsdayReset as number;
  if (seconds(row.doomsdayResetPrevious)) s.doomsdayResetPrevious = row.doomsdayResetPrevious as number;
  if (typeof row.doomsdayResetChangedAt === "number") s.doomsdayResetChangedAt = row.doomsdayResetChangedAt;
  if (typeof row.realmTimeZone === "string" && row.realmTimeZone !== "") s.realmTimeZone = row.realmTimeZone;
  return s;
}

// --- time zones ---------------------------------------------------------------------------------------------------

/** An IANA time zone the runtime knows ("Europe/Amsterdam"); "UTC" too. */
export function isTimeZone(value: unknown, known: ReadonlySet<string>): value is string {
  return typeof value === "string" && (value === "UTC" || known.has(value));
}

/** "UTC+01:00" for a zone at a moment (Unix seconds); "UTC" at offset 0. */
export function utcOffset(timeZone: string, now: number): string {
  const part = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(new Date(now * 1000))
    .find((p) => p.type === "timeZoneName")?.value;
  return part === undefined || /^GMT([+-]00:00)?$/.test(part) ? "UTC" : part.replace("GMT", "UTC");
}

/** "Europe/Amsterdam · UTC+01:00", with underscores as spaces. */
export function timeZoneLabel(timeZone: string, now: number): string {
  return `${timeZone.replace(/_/g, " ")} · ${utcOffset(timeZone, now)}`;
}

/**
 * The time zone dropdown's options (WEB-48): grouped by region ("Europe"), the place as label ("Isle of Man",
 * "Argentina / Buenos Aires") and the offset as meta. Zones without a region ("UTC") go under "Other".
 */
export function timeZoneOptions(
  timeZones: readonly string[],
  now: number,
): { value: string; label: string; meta: string; group: string }[] {
  return timeZones
    .map((tz) => {
      const [region, ...place] = tz.split("/");
      return {
        value: tz,
        label: (place.length > 0 ? place.join(" / ") : tz).replace(/_/g, " "),
        meta: utcOffset(tz, now),
        group: place.length > 0 ? region! : "Other",
      };
    })
    .sort((a, b) =>
      a.group === b.group ? 0 : a.group === "Other" ? 1 : b.group === "Other" ? -1 : a.group < b.group ? -1 : 1,
    );
}

/** "19:30" in a time zone, 24-hour. */
export function clockIn(timeZone: string, now: number): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(now * 1000),
  );
}

// --- the bot's status ---------------------------------------------------------------------------------------------

/** The bot polls at least every 30 s (docs/BOT-API.md), so a minute without a call means it isn't running. */
export const ONLINE_SECONDS = 60;

export type BotState = "online" | "offline" | "never" | "none";

export interface BotStatusView {
  state: BotState;
  /** The page's pill: "● Bot online", "Bot offline", "Bot not connected". */
  pill: string;
  /** The token card's line under the title. */
  line: string;
}

/** From the active token's dates (WEB-38 `botTokenStatus`; undefined without a token) at `now`. */
export function botStatus(token: { createdAt: number; lastUsedAt?: number } | undefined, now: number): BotStatusView {
  if (token === undefined) {
    return {
      state: "none",
      pill: "Bot not connected",
      line: "No bot token yet. Create one and put it in the bot's environment.",
    };
  }
  const made = `Token made ${timeAgo(token.createdAt, now)}`;
  if (token.lastUsedAt === undefined) {
    return { state: "never", pill: "Bot not connected", line: `${made} · the bot hasn't used it yet` };
  }
  const seen = `last call ${timeAgo(token.lastUsedAt, now)}`;
  if (now - token.lastUsedAt <= ONLINE_SECONDS)
    return { state: "online", pill: "● Bot online", line: `${made} · ${seen}` };
  return { state: "offline", pill: "Bot offline", line: `${made} · ${seen}` };
}
