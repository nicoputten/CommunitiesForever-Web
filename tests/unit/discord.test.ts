import { describe, expect, it } from "vitest";
import {
  settingChangeText,
  authorizeUrl,
  botStatus,
  botSettingsFrom,
  clockIn,
  DEFAULT_BOT_SETTINGS,
  discordRedirectUri,
  discordUser,
  isTimeZone,
  linkCookie,
  linkedFriends,
  parseLinkCookie,
  parseNotice,
  randomCode,
  reminderLabel,
  settingChange,
  timeZoneLabel,
  utcOffset,
} from "@/core/discord";

// WEB-39: linking a Discord account, the bot's settings and time zones.

const STATE = randomCode(new Uint8Array(32).fill(1));
const VERIFIER = randomCode(new Uint8Array(32).fill(2));

describe("linking", () => {
  it("asks Discord for the identify scope only, with state and a S256 challenge", () => {
    const url = new URL(
      authorizeUrl({
        clientId: "123",
        redirectUri: "https://site.example/api/discord/callback",
        state: STATE,
        challenge: "c",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "123",
      scope: "identify",
      redirect_uri: "https://site.example/api/discord/callback",
      state: STATE,
      code_challenge: "c",
      code_challenge_method: "S256",
    });
  });

  it("builds the redirect URI from the site URL", () => {
    expect(discordRedirectUri("https://site.example/")).toBe("https://site.example/api/discord/callback");
    expect(discordRedirectUri("http://localhost:3000")).toBe("http://localhost:3000/api/discord/callback");
  });

  it("makes 43-character codes and reads its own cookie back, nothing else", () => {
    expect(STATE).toHaveLength(43);
    expect(parseLinkCookie(linkCookie(STATE, VERIFIER))).toEqual({ state: STATE, verifier: VERIFIER });
    expect(parseLinkCookie(undefined)).toBeUndefined();
    expect(parseLinkCookie(`${STATE}.short`)).toBeUndefined();
    expect(parseLinkCookie(`${STATE}.${VERIFIER}.x`)).toBeUndefined();
  });

  it("reads the user from /users/@me as untrusted text", () => {
    expect(discordUser({ id: "80351110224678912", username: "ada_example", email: "x" })).toEqual({
      id: "80351110224678912",
      name: "ada_example",
    });
    expect(discordUser({ id: "80351110224678912", username: "a|cffff0000b\u0007" })?.name).toBe("ab");
    expect(discordUser({ id: "80351110224678912", username: "x".repeat(50) })?.name).toHaveLength(32);
    expect(discordUser({ id: "12", username: "ada" })).toBeUndefined();
    expect(discordUser({ id: 80351110224678912, username: "ada" })).toBeUndefined();
    expect(discordUser({ id: "80351110224678912", username: "  " })).toBeUndefined();
    expect(discordUser(null)).toBeUndefined();
  });

  it("knows only its own notices", () => {
    expect(parseNotice("linked")).toBe("linked");
    expect(parseNotice("toString")).toBeUndefined();
    expect(parseNotice(["linked"])).toBeUndefined();
  });
});

describe("linked friends", () => {
  it("counts linked ones, lists them first and each BattleTag once", () => {
    const { rows, linked } = linkedFriends(
      ["Nico#2201", "Bob#2002", "ada#1001", "Ada#1001"],
      new Map([["ada#1001", "ada_example"]]),
    );
    expect(linked).toBe(1);
    expect(rows).toEqual([
      { battleTag: "ada#1001", discordName: "ada_example" },
      { battleTag: "Nico#2201" },
      { battleTag: "Bob#2002" },
    ]);
  });
});

describe("bot settings", () => {
  it("defaults to every post on but Doomsday's, the recap on Sunday 13:00 and reminders 30 minutes before", () => {
    expect(botSettingsFrom(undefined)).toEqual(DEFAULT_BOT_SETTINGS);
    // Doomsday's posts are off until the admin turns them on (Nico, 2026-10-28): without a row, and in a row from
    // before WEB-58 that has no such keys; the other posts stay on.
    expect(botSettingsFrom(undefined)).toMatchObject({
      doomsdayBoard: false,
      doomsdayLadder: false,
      milestones: true,
      runs: true,
      recap: true,
    });
    expect(botSettingsFrom({ milestones: true, runs: true, recap: true })).toMatchObject({
      doomsdayBoard: false,
      doomsdayLadder: false,
    });
    expect(DEFAULT_BOT_SETTINGS).toMatchObject({ recapDay: 0, recapTime: "13:00", reminderMinutes: 30, recap: true });
  });

  it("takes valid form values only", () => {
    expect(settingChange("milestones", "false")).toEqual({ milestones: false });
    expect(settingChange("askNow", "true")).toEqual({ askNow: true });
    expect(settingChange("milestones", "yes")).toBeUndefined();
    expect(settingChange("postsChannel", "80351110224678912")).toEqual({ postsChannel: "80351110224678912" });
    expect(settingChange("mentionRole", "")).toEqual({ mentionRole: null });
    expect(settingChange("runsChannel", "#general")).toBeUndefined();
    expect(settingChange("reminderMinutes", "60")).toEqual({ reminderMinutes: 60 });
    expect(settingChange("reminderMinutes", "45")).toBeUndefined();
    expect(settingChange("recapAt", "5|20:00")).toEqual({ recapDay: 5, recapTime: "20:00" });
    expect(settingChange("recapAt", "7|20:00")).toBeUndefined();
    expect(settingChange("recapAt", "0|20:30")).toBeUndefined();
    expect(settingChange("updatedBy", "x")).toBeUndefined();
    expect(settingChange("__proto__", "true")).toBeUndefined();
  });

  it("falls back to defaults for stored values out of range", () => {
    const s = botSettingsFrom({ recapDay: 9, recapTime: "25:00", reminderMinutes: 45, runs: false, postsChannel: "x" });
    expect(s).toEqual({ ...DEFAULT_BOT_SETTINGS, runs: false });
  });

  it("names reminder times", () => {
    expect([15, 30, 60, 120].map(reminderLabel)).toEqual([
      "15 minutes before",
      "30 minutes before",
      "1 hour before",
      "2 hours before",
    ]);
  });
});

describe("time zones", () => {
  // 2026-01-15 12:00 UTC (winter) and 2026-07-15 12:00 UTC (summer).
  const WINTER = Date.UTC(2026, 0, 15, 12) / 1000;
  const SUMMER = Date.UTC(2026, 6, 15, 12) / 1000;

  it("knows IANA names and UTC", () => {
    const known = new Set(["Europe/Amsterdam"]);
    expect(isTimeZone("Europe/Amsterdam", known)).toBe(true);
    expect(isTimeZone("UTC", known)).toBe(true);
    expect(isTimeZone("Mars/Olympus", known)).toBe(false);
    expect(isTimeZone(undefined, known)).toBe(false);
  });

  it("shows the offset at that moment, around daylight saving", () => {
    expect(utcOffset("Europe/Amsterdam", WINTER)).toBe("UTC+01:00");
    expect(utcOffset("Europe/Amsterdam", SUMMER)).toBe("UTC+02:00");
    expect(utcOffset("UTC", WINTER)).toBe("UTC");
    expect(timeZoneLabel("America/New_York", WINTER)).toBe("America/New York · UTC-05:00");
    expect(clockIn("Europe/Amsterdam", SUMMER)).toBe("14:00");
  });
});

describe("the bot's status", () => {
  const NOW = 1_800_000_000;
  it("is online when the bot called in the last minute", () => {
    expect(botStatus({ createdAt: NOW - 7200, lastUsedAt: NOW - 30 }, NOW)).toEqual({
      state: "online",
      pill: "● Bot online",
      line: "Token made 2 h ago · last call just now",
    });
    expect(botStatus({ createdAt: NOW - 7200, lastUsedAt: NOW - 300 }, NOW)).toMatchObject({
      state: "offline",
      pill: "Bot offline",
      line: "Token made 2 h ago · last call 5 min ago",
    });
  });

  it("says not connected without a token or before the bot used it", () => {
    expect(botStatus(undefined, NOW)).toMatchObject({ state: "none", pill: "Bot not connected" });
    expect(botStatus({ createdAt: NOW - 60 }, NOW)).toMatchObject({
      state: "never",
      pill: "Bot not connected",
      line: "Token made 1 min ago · the bot hasn't used it yet",
    });
  });
});

describe("settings in the admin changes log (WEB-64)", () => {
  const name = (id: string) => ({ "1": "doombringers", "9": "Raiders" })[id] ?? id;
  it("says what changed", () => {
    expect(settingChangeText("doomsdayBoard", { doomsdayBoard: true }, name)).toBe("turned on the daily board");
    expect(settingChangeText("doomsdayReset", { doomsdayReset: 20 * 3600 }, name)).toBe(
      "changed the Doomsday reset to 20:00",
    );
    expect(settingChangeText("postsChannel", { postsChannel: "1" }, name)).toBe(
      "changed the default channel to # doombringers",
    );
    expect(settingChangeText("mentionRole", { mentionRole: "9" }, name)).toBe(
      "changed the role for new runs to @Raiders",
    );
    expect(settingChangeText("featsChannel", { featsChannel: null }, name)).toBe("cleared the feats channel");
  });
});
