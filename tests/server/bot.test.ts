import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DELETE as revokeRoute, POST as createRoute } from "@/app/api/admin/bot-token/route";
import { POST as postedRoute } from "@/app/api/bot/v1/events/[id]/posted/route";
import { GET as eventsRoute } from "@/app/api/bot/v1/events/route";
import { GET as settingsRoute } from "@/app/api/bot/v1/settings/route";
import { EVENT_TTL_SECONDS, type MilestonesEvent } from "@/core/bot";
import { isPublic } from "@/proxy";
import { putGuest } from "@/server/access";
import { acknowledge, botTokenStatus, createBotToken, longPoll, pendingEvents } from "@/server/bot";
import { getDb } from "@/server/db";
import { botEvents } from "@/server/db/schema";
import { createToken } from "@/server/uploader";
import { rebuild, upload } from "@/server/uploads";

// The bot API's routes (WEB-38, docs/BOT-API.md): the token check, the long poll, the cursor and acknowledgement,
// milestone events from sample uploads.

const SECRET = "test-secret-at-least-32-characters-long";
const ADMIN = "Nico#1000";
const BASE = "http://localhost:3000";
const COOKIE = "authjs.session-token";
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = SECRET;
  process.env.ADMIN_BATTLETAG = ADMIN;
  putGuest(getDb(), "Gwen#4004", true, ADMIN);
});

afterAll(() => {
  getDb().$client.close();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  longPoll.seconds = 30;
});

const now = () => Math.floor(Date.now() / 1000);
const lua = (body: string) => new TextEncoder().encode(`return { schemaVersion = 1, ${body} }`);

async function req(
  pathname: string,
  init: { method?: string; token?: string; as?: string; body?: unknown; signal?: AbortSignal } = {},
) {
  const headers = new Headers();
  if (init.token !== undefined) headers.set("authorization", `Bearer ${init.token}`);
  if (init.as !== undefined) {
    headers.set("cookie", `${COOKIE}=${await encode({ token: { battleTag: init.as }, secret: SECRET, salt: COOKIE })}`);
  }
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(new URL(pathname, BASE), {
    method: init.method ?? "GET",
    headers,
    body,
    ...(init.signal ? { signal: init.signal } : {}),
  });
}

const events = async (token: string, after?: string) =>
  eventsRoute(await req(`/api/bot/v1/events${after === undefined ? "" : `?after=${after}`}`, { token }));
const posted = async (token: string, id: number | string, body: unknown) =>
  postedRoute(await req(`/api/bot/v1/events/${id}/posted`, { method: "POST", token, body }), {
    params: Promise.resolve({ id: String(id) }),
  });

// Nico's uploads: the first one sets the stage, the next ones reach milestones.
const day1 = lua(`
  self = { battleTag = "${ADMIN}", displayName = "Nico", version = 100, chars = {
    V = { name = "Ves Example", classFile = "WARLOCK", level = 18, updatedAt = 100,
          professions = { [197] = { name = "Tailoring", rank = 70, max = 75 } } },
    M = { name = "Mira Example", classFile = "MAGE", level = 58, updatedAt = 100 } } },
  settings = { clubId = 1, clubName = "Friends" },
`);
const day2 = lua(`
  self = { battleTag = "${ADMIN}", displayName = "Nico", version = 200, chars = {
    V = { name = "Ves Example", classFile = "WARLOCK", level = 21, updatedAt = 200,
          professions = { [197] = { name = "Tailoring", rank = 75, max = 75 } } },
    M = { name = "Mira Example", classFile = "MAGE", level = 60, updatedAt = 200 },
    G = { name = "Grom Example", classFile = "WARRIOR", level = 12, updatedAt = 200 } } },
  settings = { clubId = 1, clubName = "Friends" },
`);
const day3 = lua(`
  self = { battleTag = "${ADMIN}", displayName = "Nico", version = 300, chars = {
    V = { name = "Ves Example", classFile = "WARLOCK", level = 30, updatedAt = 300,
          professions = { [197] = { name = "Tailoring", rank = 75, max = 150 } } },
    M = { name = "Mira Example", classFile = "MAGE", level = 60, updatedAt = 300 },
    G = { name = "Grom Example", classFile = "WARRIOR", level = 12, updatedAt = 300 } } },
  settings = { clubId = 1, clubName = "Friends" },
`);

describe("bot API", () => {
  let token: string;

  it("is outside the session check, and takes only the bot token", async () => {
    expect(isPublic("/api/bot/v1/events")).toBe(true);
    const bare = await settingsRoute(await req("/api/bot/v1/settings"));
    expect(bare.status).toBe(401);
    expect(bare.headers.get("www-authenticate")).toBe('Bearer realm="bot"');
    // A session cookie, even the admin's, is not a bot token.
    expect((await settingsRoute(await req("/api/bot/v1/settings", { as: ADMIN }))).status).toBe(401);
    // Nor is an uploader token.
    const uploaderToken = createToken(getDb(), ADMIN, "PC", null, "manual", now()).token;
    const wrong = await settingsRoute(await req("/api/bot/v1/settings", { token: uploaderToken }));
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({ error: "invalid_token" });
  });

  it("the admin makes the token, once; anyone else may not", async () => {
    expect((await createRoute(await req("/api/admin/bot-token", { method: "POST" }))).status).toBe(401);
    expect((await createRoute(await req("/api/admin/bot-token", { method: "POST", as: "Gwen#4004" }))).status).toBe(
      403,
    );
    const made = await createRoute(await req("/api/admin/bot-token", { method: "POST", as: ADMIN }));
    expect(made.status).toBe(200);
    token = ((await made.json()) as { token: string }).token;
    expect(token).toMatch(/^cfb_/);
    const settings = await settingsRoute(await req("/api/bot/v1/settings", { token }));
    expect(settings.status).toBe(200);
    expect(await settings.json()).toEqual({
      apiVersion: 1,
      siteName: expect.any(String),
      longPollSeconds: 30,
      eventTtlSeconds: EVENT_TTL_SECONDS,
      posts: { milestones: true },
    });
  });

  it("the site's first upload makes no milestones; later ones one event per upload", async () => {
    expect(upload(getDb(), day1, ADMIN, now()).status).toBe("ok");
    expect(pendingEvents(getDb(), 0, now())).toEqual([]);
    const second = upload(getDb(), day2, ADMIN, now());
    const res = await events(token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      events: { id: number; type: string; data: MilestonesEvent }[];
      cursor: string;
    };
    expect(body.events).toHaveLength(1);
    const [event] = body.events;
    expect(body.cursor).toBe(String(event!.id));
    expect(event!.type).toBe("milestones");
    expect(event!.data.uploadId).toBe(second.id);
    expect(event!.data.milestones.map((m) => `${m.kind} ${m.character.name}`)).toEqual([
      "maxLevel Mira Example",
      "level Ves Example",
      "professionCap Ves Example",
      "newCharacter Grom Example",
    ]);
    expect(event!.data.milestones[0]!.character.ownerName).toBe("Nico");
    expect(JSON.stringify(event)).not.toContain("#");
  });

  it("hands an event out until it is acknowledged, then never again", async () => {
    const first = (await (await events(token)).json()) as { events: { id: number }[]; cursor: string };
    const id = first.events[0]!.id;
    // Not acknowledged yet: from the start again (a restarted bot), it comes again.
    expect(((await (await events(token, "0")).json()) as { events: unknown[] }).events).toHaveLength(1);

    expect((await posted(token, id, {})).status).toBe(400);
    expect((await posted(token, id, { messageId: "12x" })).status).toBe(400);
    const ok = await posted(token, id, { messageId: "1100000000000000001" });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ id, messageId: "1100000000000000001" });
    // A retry of the same acknowledgement is fine; another message for it is a conflict.
    expect((await posted(token, id, { messageId: "1100000000000000001" })).status).toBe(200);
    expect((await posted(token, id, { messageId: "1100000000000000002" })).status).toBe(409);
    expect((await posted(token, 999999, { messageId: "1" })).status).toBe(404);

    longPoll.seconds = 0.05;
    expect(((await (await events(token, "0")).json()) as { events: unknown[] }).events).toEqual([]);
    expect((await events(token, "nope")).status).toBe(400);
  });

  it("long poll: holds when there is nothing, answers as soon as an upload makes an event", async () => {
    longPoll.seconds = 0.3;
    const quiet = Date.now();
    const empty = (await (await events(token, "0")).json()) as { events: unknown[]; cursor: string };
    expect(empty).toEqual({ events: [], cursor: "0" });
    expect(Date.now() - quiet).toBeGreaterThanOrEqual(250);

    longPoll.seconds = 10;
    const started = Date.now();
    const waiting = events(token, "0");
    await new Promise((r) => setTimeout(r, 50));
    upload(getDb(), day3, ADMIN, now());
    const body = (await (await waiting).json()) as { events: { data: MilestonesEvent }[] };
    expect(Date.now() - started).toBeLessThan(3000);
    // Raising Tailoring's cap is not a milestone; Ves reaching 30 is.
    expect(body.events.map((e) => e.data.milestones.map((m) => m.kind))).toEqual([["level"]]);
  });

  it("an aborted poll ends at once", async () => {
    longPoll.seconds = 10;
    const abort = new AbortController();
    const started = Date.now();
    const waiting = eventsRoute(await req("/api/bot/v1/events?after=999999", { token, signal: abort.signal }));
    abort.abort();
    await waiting;
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("events older than 7 days are no longer handed out or acknowledged", () => {
    const db = getDb();
    const old = now() - EVENT_TTL_SECONDS - 60;
    const { id } = db
      .insert(botEvents)
      .values({ type: "milestones", data: { milestones: [] }, createdAt: old })
      .returning({ id: botEvents.id })
      .get();
    expect(pendingEvents(db, 0, now()).some((e) => e.id === id)).toBe(false);
    expect(pendingEvents(db, 0, old + 60).some((e) => e.id === id)).toBe(true);
    expect(acknowledge(db, id, "1", now())).toBe("expired");
  });

  it("a rebuild of the uploads makes no events", () => {
    const before = getDb().select().from(botEvents).all().length;
    rebuild(getDb());
    expect(getDb().select().from(botEvents).all()).toHaveLength(before);
  });

  it("a new token ends the old one; revoking ends it too", async () => {
    const next = createBotToken(getDb(), ADMIN, now());
    expect(botTokenStatus(getDb())).toEqual({ createdAt: expect.any(Number), createdBy: ADMIN });
    expect((await settingsRoute(await req("/api/bot/v1/settings", { token }))).status).toBe(401);
    expect((await settingsRoute(await req("/api/bot/v1/settings", { token: next }))).status).toBe(200);
    expect((await revokeRoute(await req("/api/admin/bot-token", { method: "DELETE", as: "Gwen#4004" }))).status).toBe(
      403,
    );
    const revoked = await revokeRoute(await req("/api/admin/bot-token", { method: "DELETE", as: ADMIN }));
    expect(await revoked.json()).toEqual({ revoked: true });
    expect(botTokenStatus(getDb())).toBeUndefined();
    expect((await settingsRoute(await req("/api/bot/v1/settings", { token: next }))).status).toBe(401);
  });
});
