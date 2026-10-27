import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkCookie, randomCode } from "@/core/discord";
import { putGuest } from "@/server/access";
import { openDatabase, type Db } from "@/server/db";
import {
  discordApp,
  effectiveTimeZone,
  fetchDiscordUser,
  friendBattleTags,
  getBotSettings,
  linkDiscord,
  linkFor,
  linkForDiscordUser,
  setTimeZone,
  timeZoneFor,
  unlinkDiscord,
  updateBotSettings,
} from "@/server/discord";
import { discordCallback } from "@/server/discordLink";

// WEB-39: links, time zones, the bot's settings and the link callback, on a temporary database.

const ADMIN = "Nico#1000";
const ADA = { id: "80351110224678912", name: "ada_example" };
const APP = { clientId: "123", clientSecret: "made-up", redirectUri: "https://site.example/api/discord/callback" };

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = openDatabase(path.join(dir, "test.sqlite"));
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("configuration", () => {
  it("needs the client id, secret and site URL", () => {
    expect(
      discordApp({ DISCORD_CLIENT_ID: "1", DISCORD_CLIENT_SECRET: "s", AUTH_URL: "https://site.example/" }),
    ).toEqual({ clientId: "1", clientSecret: "s", redirectUri: "https://site.example/api/discord/callback" });
    expect(discordApp({ DISCORD_CLIENT_ID: "1", AUTH_URL: "https://site.example" })).toBeUndefined();
  });
});

describe("links", () => {
  it("links, relinks and unlinks your own account", () => {
    expect(linkDiscord(db, "Ada#1001", ADA, 10)).toBe(true);
    expect(linkFor(db, "ada#1001")).toMatchObject({ battleTag: "Ada#1001", discordName: "ada_example" });
    expect(linkForDiscordUser(db, ADA.id)?.battleTag).toBe("Ada#1001");
    expect(linkDiscord(db, "Ada#1001", { id: "80351110224678913", name: "ada_two" }, 20)).toBe(true);
    expect(linkForDiscordUser(db, ADA.id)).toBeUndefined();
    unlinkDiscord(db, "Ada#1001");
    expect(linkFor(db, "Ada#1001")).toBeUndefined();
  });

  it("never moves a Discord account linked to someone else", () => {
    linkDiscord(db, "Ada#1001", ADA, 10);
    expect(linkDiscord(db, "Bob#2002", ADA, 20)).toBe(false);
    expect(linkForDiscordUser(db, ADA.id)?.battleTag).toBe("Ada#1001");
    expect(linkFor(db, "Bob#2002")).toBeUndefined();
  });

  it("lists the admin and guests as friends", () => {
    putGuest(db, "Gus#3003", false, ADMIN, 1);
    expect(friendBattleTags(db, ADMIN)).toEqual([ADMIN, "Gus#3003"]);
  });
});

describe("time zones", () => {
  it("takes the browser's only while none is stored; a picked one always", () => {
    expect(setTimeZone(db, "Ada#1001", "Europe/Amsterdam", "browser", 1)).toBe(true);
    expect(setTimeZone(db, "Ada#1001", "America/New_York", "browser", 2)).toBe(false);
    expect(timeZoneFor(db, "ada#1001")).toBe("Europe/Amsterdam");
    expect(setTimeZone(db, "Ada#1001", "America/New_York", "picked", 3)).toBe(true);
    expect(timeZoneFor(db, "Ada#1001")).toBe("America/New_York");
    expect(setTimeZone(db, "Ada#1001", "Mars/Olympus", "picked", 4)).toBe(false);
  });

  it("falls back to the admin's, then UTC", () => {
    expect(effectiveTimeZone(db, "Ada#1001", ADMIN)).toBe("UTC");
    setTimeZone(db, ADMIN, "Europe/Amsterdam", "picked", 1);
    expect(effectiveTimeZone(db, "Ada#1001", ADMIN)).toBe("Europe/Amsterdam");
    setTimeZone(db, "Ada#1001", "Asia/Tokyo", "picked", 1);
    expect(effectiveTimeZone(db, "Ada#1001", ADMIN)).toBe("Asia/Tokyo");
  });
});

describe("bot settings", () => {
  it("starts at the defaults and keeps changes", () => {
    expect(getBotSettings(db).recapTime).toBe("13:00");
    updateBotSettings(db, { milestones: false }, ADMIN, 1);
    updateBotSettings(db, { reminderMinutes: 120 }, ADMIN, 2);
    expect(getBotSettings(db)).toMatchObject({ milestones: false, reminderMinutes: 120, runs: true });
  });
});

describe("the link callback", () => {
  const state = randomCode(new Uint8Array(32).fill(1));
  const verifier = randomCode(new Uint8Array(32).fill(2));
  const cookie = linkCookie(state, verifier);
  const params = (p: Record<string, string>) => new URLSearchParams(p);

  function discord(user: unknown = { id: ADA.id, username: ADA.name }, scope = "identify") {
    return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/oauth2/token")) {
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("code_verifier")).toBe(verifier);
        expect(body.get("redirect_uri")).toBe(APP.redirectUri);
        return Response.json({ access_token: "made-up-token", token_type: "Bearer", scope });
      }
      if (u.endsWith("/users/@me")) return Response.json(user);
      return new Response(null, { status: 200 });
    });
  }

  const run = (p: URLSearchParams, c: string | undefined = cookie, fetcher = discord()) =>
    discordCallback({ db, app: APP, battleTag: "Ada#1001", params: p, cookie: c, now: 5, fetcher });

  it("links the session's BattleTag and revokes Discord's token", async () => {
    const fetcher = discord();
    expect(await run(params({ code: "abc", state }), cookie, fetcher)).toBe("linked");
    expect(linkFor(db, "Ada#1001")?.discordId).toBe(ADA.id);
    expect(fetcher.mock.calls.map(([u]) => String(u))).toEqual([
      "https://discord.com/api/oauth2/token",
      "https://discord.com/api/users/@me",
      "https://discord.com/api/oauth2/token/revoke",
    ]);
  });

  it("refuses a callback this browser didn't start", async () => {
    const fetcher = discord();
    expect(await run(params({ code: "abc", state }), "", fetcher)).toBe("expired");
    expect(await run(params({ code: "abc", state: randomCode(new Uint8Array(32)) }), cookie, fetcher)).toBe("expired");
    expect(fetcher).not.toHaveBeenCalled();
    expect(linkFor(db, "Ada#1001")).toBeUndefined();
  });

  it("says cancelled when the person said no on Discord", async () => {
    expect(await run(params({ error: "access_denied", state }))).toBe("cancelled");
  });

  it("fails without linking when Discord answers oddly or grants more than identify", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await run(params({ code: "abc", state }), cookie, discord({ id: "nope" }))).toBe("failed");
    expect(await run(params({ code: "abc", state }), cookie, discord(undefined, "identify email"))).toBe("failed");
    expect(linkFor(db, "Ada#1001")).toBeUndefined();
  });

  it("says taken when the Discord account is someone else's", async () => {
    linkDiscord(db, "Bob#2002", ADA, 1);
    expect(await run(params({ code: "abc", state }))).toBe("taken");
  });

  it("never stores the token", async () => {
    await run(params({ code: "abc", state }));
    const dump = JSON.stringify(db.$client.prepare("select * from discord_links").all());
    expect(dump).not.toContain("made-up-token");
  });

  it("fetchDiscordUser throws on a failed exchange", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 400 }));
    await expect(fetchDiscordUser(APP, "abc", verifier, fetcher)).rejects.toThrow("token exchange failed (400)");
  });
});
