import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as guildRoute } from "@/app/api/bot/v1/guild/route";
import { isPublic } from "@/proxy";
import { createBotToken } from "@/server/bot";
import { getDb } from "@/server/db";
import { updateBotSettings } from "@/server/discord";
import { loadGuild } from "@/server/guild";
import { createToken } from "@/server/uploader";

// WEB-46: the bot reports its Discord server's channels and roles; each report replaces the last, a picked one that's
// gone keeps its last name.

const ADMIN = "Nico#1000";
const A = "80351110224678912";
const B = "80351110224678913";
const R = "80351110224678920";
let dir: string;
let token: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  process.env.DATA_DIR = dir;
  process.env.ADMIN_BATTLETAG = ADMIN;
  token = createBotToken(getDb(), ADMIN, 1000);
});

afterAll(() => {
  getDb().$client.close();
  rmSync(dir, { recursive: true, force: true });
});

/** `auth` "" sends no Authorization header. */
const report = (body: unknown, auth: string = token) =>
  guildRoute(
    new Request("http://localhost:3000/api/bot/v1/guild", {
      method: "POST",
      headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body),
    }),
  );

describe("POST guild", () => {
  it("takes only the bot token", async () => {
    expect(isPublic("/api/bot/v1/guild")).toBe(true);
    expect((await report({ channels: [], roles: [] }, "")).status).toBe(401);
    const uploader = createToken(getDb(), ADMIN, "PC", null, "manual", 1000).token;
    expect((await report({ channels: [], roles: [] }, uploader)).status).toBe(401);
    expect(loadGuild(getDb()).reportedAt).toBeUndefined();
  });

  it("refuses a body that isn't a report, and stores nothing", async () => {
    const bad = await report({ channels: [{ id: "x", name: "general" }], roles: [] });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: "invalid_request" });
    expect(loadGuild(getDb()).channels).toEqual([]);
  });

  it("replaces the lists on every report; a picked one that's gone keeps its last name", async () => {
    const first = await report({
      channels: [
        { id: A, name: "general" },
        { id: B, name: "runs" },
      ],
      roles: [{ id: R, name: "Raiders" }],
    });
    expect([first.status, await first.json()]).toEqual([200, { channels: 2, roles: 1 }]);
    const g = loadGuild(getDb());
    expect(g.reportedAt).toEqual(expect.any(Number));
    expect(g.channels).toEqual([
      { id: A, name: "general", present: true },
      { id: B, name: "runs", present: true },
    ]);

    updateBotSettings(getDb(), { runsChannel: B }, ADMIN, 1);
    expect((await report({ channels: [{ id: A, name: "lobby" }], roles: [] })).status).toBe(200);
    expect(loadGuild(getDb())).toMatchObject({
      channels: [
        { id: A, name: "lobby", present: true },
        { id: B, name: "runs", present: false },
      ],
      // Not picked: forgotten.
      roles: [],
    });

    updateBotSettings(getDb(), { runsChannel: null }, ADMIN, 2);
    await report({ channels: [{ id: A, name: "lobby" }], roles: [] });
    expect(loadGuild(getDb()).channels).toEqual([{ id: A, name: "lobby", present: true }]);
  });
});
