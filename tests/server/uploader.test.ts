import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as startRoute } from "@/app/api/uploader/v1/device_authorization/route";
import { GET as meRoute } from "@/app/api/uploader/v1/me/route";
import { POST as revokeRoute } from "@/app/api/uploader/v1/revoke/route";
import { POST as tokenRoute } from "@/app/api/uploader/v1/token/route";
import { POST as uploadRoute } from "@/app/api/uploader/v1/uploads/route";
import { CLIENT_ID, DEVICE_CODE_GRANT, RateLimiter } from "@/core/uploader";
import { isPublic } from "@/proxy";
import { block, putGuest } from "@/server/access";
import { getDb } from "@/server/db";
import { uploads } from "@/server/db/schema";
import { activeTokens, createToken, decidePairing, findPairing, limits, TooManyTokensError } from "@/server/uploader";
import { listOwnUploads, listUploads, MAX_UPLOAD_BYTES, upload, UploadForbiddenError } from "@/server/uploads";

// The uploader API's routes (WEB-33): every status code of docs/UPLOADER-API.md, and its examples as a contract:
// each real response has the example's keys with the same value types.

const ADMIN = "Nico#1000";
const BASE = "http://localhost:3000";
let dir: string;
let ip = 0;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  process.env.DATA_DIR = dir;
  process.env.ADMIN_BATTLETAG = ADMIN;
  process.env.AUTH_URL = "https://wow.example";
  putGuest(getDb(), "Gus#3003", false, ADMIN);
  putGuest(getDb(), "Gwen#4004", true, ADMIN);
  // The poll limit is tested on its own; the other tests poll as often as they like.
  limits.poll = new RateLimiter(1000, 1);
});

afterAll(() => {
  getDb().$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const now = () => Math.floor(Date.now() / 1000);
/** A well-formed token that was never issued. */
const UNKNOWN = `cfu_${"x".repeat(43)}`;

function req(
  pathname: string,
  init: { method?: string; body?: BodyInit; form?: Record<string, string>; token?: string } = {},
) {
  const headers = new Headers({ "x-forwarded-for": `10.0.0.${++ip}` });
  if (init.token !== undefined) headers.set("authorization", `Bearer ${init.token}`);
  let body = init.body;
  if (init.form !== undefined) {
    headers.set("content-type", "application/x-www-form-urlencoded");
    body = new URLSearchParams(init.form).toString();
  }
  return new NextRequest(new URL(pathname, BASE), { method: init.method ?? "GET", headers, body });
}

const start = (
  form: Record<string, string> = { client_id: CLIENT_ID, device_name: "DESKTOP-NICO", app_version: "1.0.0" },
) => startRoute(req("/api/uploader/v1/device_authorization", { method: "POST", form }));
const poll = (deviceCode: string, form: Record<string, string> = {}) =>
  tokenRoute(
    req("/api/uploader/v1/token", {
      method: "POST",
      form: { grant_type: DEVICE_CODE_GRANT, device_code: deviceCode, client_id: CLIENT_ID, ...form },
    }),
  );
const send = (token: string | undefined, body: BodyInit) =>
  uploadRoute(req("/api/uploader/v1/uploads", { method: "POST", body, token }));

const lua = (tag: string, level: number, at: number, club = 7) =>
  `return { schemaVersion = 1, settings = { clubId = ${club}, clubName = "Doombringers" },
    self = { battleTag = "${tag}", version = ${at}, chars = { V = { name = "Ves Doombringer", level = ${level}, updatedAt = ${at} } } } }`;

interface Started {
  device_code: string;
  user_code: string;
  verification_uri_complete: string;
}

/** Connects a device for a user through the routes; returns the access token. */
async function pair(as: string, deviceName = "DESKTOP-NICO"): Promise<string> {
  const started = (await (await start({ client_id: CLIENT_ID, device_name: deviceName })).json()) as Started;
  expect(decidePairing(getDb(), started.user_code, as, true, now())).toBe(true);
  const body = (await (await poll(started.device_code)).json()) as { access_token: string };
  return body.access_token;
}

// --- the contract -------------------------------------------------------------------------------------------------

const doc = readFileSync(new URL("../../docs/UPLOADER-API.md", import.meta.url), "utf8");

function example(name: string): unknown {
  const match = new RegExp(`<!-- example: ${name} -->\\s*\`\`\`json\\n([\\s\\S]*?)\`\`\``).exec(doc);
  if (match?.[1] === undefined) throw new Error(`No example ${name} in docs/UPLOADER-API.md`);
  return JSON.parse(match[1]);
}

/** Same keys and value types, recursively; an empty array matches any array. */
function sameShape(actual: unknown, expected: unknown, at = "$"): void {
  const kind = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
  expect(kind(actual), at).toBe(kind(expected));
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length > 0 && expected.length > 0) actual.forEach((a, i) => sameShape(a, expected[0], `${at}[${i}]`));
  } else if (kind(actual) === "object") {
    const a = actual as Record<string, unknown>;
    const e = expected as Record<string, unknown>;
    expect(Object.keys(a).sort(), at).toEqual(Object.keys(e).sort());
    for (const key of Object.keys(e)) sameShape(a[key], e[key], `${at}.${key}`);
  }
}

describe("contract", () => {
  it("documents every example", () => {
    for (const name of ["error", "device-authorization", "token", "upload-ok", "upload-rejected", "me"]) {
      expect(() => example(name)).not.toThrow();
    }
  });

  it("answers in the documented shapes", async () => {
    const started = await start();
    expect(started.status).toBe(200);
    expect(started.headers.get("cache-control")).toBe("no-store");
    const startBody = (await started.json()) as Started;
    sameShape(startBody, example("device-authorization"));
    expect(startBody.user_code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(startBody.verification_uri_complete).toBe(`https://wow.example/uploader?code=${startBody.user_code}`);

    decidePairing(getDb(), startBody.user_code, ADMIN, true, now());
    const approved = await poll(startBody.device_code);
    expect(approved.status).toBe(200);
    expect(approved.headers.get("cache-control")).toBe("no-store");
    const { access_token: token } = (await approved.clone().json()) as { access_token: string };
    sameShape(await approved.json(), example("token"));

    const me = await meRoute(req("/api/uploader/v1/me", { token }));
    sameShape(await me.json(), example("me"));

    upload(getDb(), new TextEncoder().encode(lua(ADMIN, 37, 100)), ADMIN, now());
    const ok = await send(token, lua(ADMIN, 39, 200));
    expect(ok.status).toBe(200);
    const okBody = (await ok.json()) as { status: string; highlights: string[]; reportUrl: string; uploadId: number };
    expect(okBody).toMatchObject({ status: "ok", highlights: ["Ves Doombringer 37 → 39"] });
    expect(okBody.reportUrl).toBe(`https://wow.example/upload/${okBody.uploadId}`);
    sameShape(okBody, example("upload-ok"));

    const rejected = await send(token, "return { schemaVersion = 99 }");
    const rejectedBody = await rejected.json();
    expect(rejectedBody).toMatchObject({ status: "rejected", rejection: "newer_format", schemaVersion: 99 });
    sameShape(rejectedBody, example("upload-rejected"));

    sameShape(await (await send(UNKNOWN, "x")).json(), example("error"));
  });
});

// --- every status code --------------------------------------------------------------------------------------------

const errorOf = async (r: Response) => ((await r.json()) as { error: string }).error;

describe("routes", () => {
  it("lets the uploader API past the session proxy, and nothing else", () => {
    expect(isPublic("/api/uploader/v1/uploads")).toBe(true);
    expect(isPublic("/api/uploads")).toBe(false);
    expect(isPublic("/uploader")).toBe(false);
  });

  it("checks the device authorization request", async () => {
    const noName = await start({ client_id: CLIENT_ID });
    expect([noName.status, await errorOf(noName)]).toEqual([400, "invalid_request"]);
    const client = await start({ client_id: "other", device_name: "PC" });
    expect([client.status, await errorOf(client)]).toEqual([401, "invalid_client"]);
    const json = await startRoute(
      new NextRequest(new URL("/api/uploader/v1/device_authorization", BASE), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect([json.status, await errorOf(json)]).toEqual([400, "invalid_request"]);
  });

  it("polls: pending, the token once, then expired; denied; unknown; wrong grant or client", async () => {
    const a = (await (await start()).json()) as Started;
    const pending = await poll(a.device_code);
    expect([pending.status, await errorOf(pending)]).toEqual([400, "authorization_pending"]);
    expect(findPairing(getDb(), a.user_code.toLowerCase().replace("-", " "), now())?.deviceName).toBe("DESKTOP-NICO");
    expect(decidePairing(getDb(), a.user_code, "Gwen#4004", true, now())).toBe(true);
    const ok = await poll(a.device_code);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ token_type: "Bearer" });
    expect(await errorOf(await poll(a.device_code))).toBe("expired_token");

    const b = (await (await start()).json()) as Started;
    expect(decidePairing(getDb(), b.user_code, ADMIN, false, now())).toBe(true);
    const denied = await poll(b.device_code);
    expect([denied.status, await errorOf(denied)]).toEqual([400, "access_denied"]);
    expect(decidePairing(getDb(), b.user_code, ADMIN, true, now())).toBe(false);

    expect(await errorOf(await poll("unknown"))).toBe("expired_token");
    expect(await errorOf(await poll(b.device_code, { grant_type: "password" }))).toBe("unsupported_grant_type");
    const client = await poll(b.device_code, { client_id: "other" });
    expect([client.status, await errorOf(client)]).toEqual([401, "invalid_client"]);
  });

  it("expires codes after 10 minutes", async () => {
    const a = (await (await start()).json()) as Started;
    expect(findPairing(getDb(), a.user_code, now() + 601)).toBeUndefined();
    expect(decidePairing(getDb(), a.user_code, ADMIN, true, now() + 601)).toBe(false);
  });

  it("lets only someone who may upload allow, up to 5 uploaders", async () => {
    const a = (await (await start()).json()) as Started;
    expect(() => decidePairing(getDb(), a.user_code, "Gus#3003", true, now())).toThrow(UploadForbiddenError);
    for (let i = 0; i < 5; i++) createToken(getDb(), "Max#5005", `PC-${i}`, null, "manual", now());
    putGuest(getDb(), "Max#5005", true, ADMIN);
    expect(() => decidePairing(getDb(), a.user_code, "Max#5005", true, now())).toThrow(TooManyTokensError);
    // Pairing a device again replaces its token and is not counted.
    createToken(getDb(), "Max#5005", "PC-0", null, "manual", now());
    expect(activeTokens(getDb(), "Max#5005")).toHaveLength(5);
  });

  it("rate-limits device authorization per IP, and polls with slow_down", async () => {
    const same = () =>
      startRoute(
        new NextRequest(new URL("/api/uploader/v1/device_authorization", BASE), {
          method: "POST",
          headers: { "x-forwarded-for": "203.0.113.9, 10.9.9.9", "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: CLIENT_ID, device_name: "PC" }).toString(),
        }),
      );
    for (let i = 0; i < 10; i++) expect((await same()).status).toBe(200);
    const limited = await same();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await limited.json()).error).toBe("rate_limited");

    const saved = limits.poll;
    limits.poll = new RateLimiter(1, 1);
    try {
      expect(await errorOf(await poll("x"))).toBe("expired_token");
      const slow = await poll("x");
      expect([slow.status, await errorOf(slow)]).toEqual([400, "slow_down"]);
    } finally {
      limits.poll = saved;
    }
  });

  it("uploads with a token: 401, 400, 413, nothing_new, other community, 403, 429", async () => {
    const token = await pair("Gwen#4004", "GWEN-PC");
    const none = await send(undefined, "x");
    expect([none.status, none.headers.get("www-authenticate")]).toEqual([401, 'Bearer realm="uploader"']);
    const unknown = await send(UNKNOWN, "x");
    expect([unknown.status, await errorOf(unknown)]).toEqual([401, "invalid_token"]);
    expect(unknown.headers.get("www-authenticate")).toBe('Bearer realm="uploader", error="invalid_token"');
    expect(await (await send(token, "")).json()).toMatchObject({ error: "empty_file" });
    const big = await send(token, new Uint8Array(MAX_UPLOAD_BYTES + 1));
    expect(big.status).toBe(413);
    expect(await big.json()).toMatchObject({ error: "too_large" });

    const first = await (await send(token, lua("Gwen#4004", 10, 100))).json();
    expect(first).toMatchObject({ status: "ok", counts: { characters: 1, friends: 1 } });
    const row = getDb()
      .select()
      .from(uploads)
      .all()
      .find((u) => u.id === first.uploadId);
    expect(row?.deviceId).toBe(activeTokens(getDb(), "Gwen#4004")[0]?.id);
    // The history names the device (WEB-34 "via GWEN-PC").
    expect(listUploads(getDb()).find((u) => u.id === first.uploadId)?.device).toBe("GWEN-PC");
    // The uploader page's own history: only Gwen's uploads (any case of the BattleTag), with her devices.
    const own = listOwnUploads(getDb(), "gwen#4004", 1);
    expect(own.uploads.map((u) => u.uploadedBy)).toEqual(["Gwen#4004"]);
    expect(own.devices).toEqual(["GWEN-PC"]);
    expect(await (await send(token, lua("Gwen#4004", 10, 100))).json()).toMatchObject({ status: "nothing_new" });
    expect(await (await send(token, lua("Gwen#4004", 10, 150, 8))).json()).toMatchObject({
      status: "rejected",
      rejection: "other_community",
    });
    expect(await (await send(token, lua("Bob#2002", 10, 150))).json()).toMatchObject({ rejection: "not_your_file" });

    const me = await (await meRoute(req("/api/uploader/v1/me", { token }))).json();
    expect(me).toMatchObject({ battleTag: "Gwen#4004", deviceName: "GWEN-PC", siteName: "Doombringers" });
    expect(me.lastUploadAt).toBeGreaterThan(0);

    // A guest without "may upload" (here with a token made before the tick was removed) gets 403.
    const gus = createToken(getDb(), "Gus#3003", "GUS-PC", null, "manual", now()).token;
    const forbidden = await send(gus, lua("Gus#3003", 11, 200));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ error: "may_not_upload" });

    const saved = limits.upload;
    limits.upload = new RateLimiter(0, 3600);
    try {
      const limited = await send(token, lua("Gwen#4004", 12, 300));
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toBe("3600");
    } finally {
      limits.upload = saved;
    }
  });

  it("revokes a token on disconnect and on a block", async () => {
    const token = await pair("Gwen#4004", "GWEN-LAPTOP");
    expect((await meRoute(req("/api/uploader/v1/me", { token }))).status).toBe(200);
    const revoke = (form: Record<string, string>) =>
      revokeRoute(req("/api/uploader/v1/revoke", { method: "POST", form }));
    expect((await revoke({ token, token_type_hint: "access_token", client_id: "other" })).status).toBe(401);
    expect((await revoke({ client_id: CLIENT_ID })).status).toBe(400);
    expect((await revoke({ token, token_type_hint: "access_token", client_id: CLIENT_ID })).status).toBe(200);
    expect((await revoke({ token, client_id: CLIENT_ID })).status).toBe(200);
    expect((await meRoute(req("/api/uploader/v1/me", { token }))).status).toBe(401);

    const other = await pair("Gwen#4004", "GWEN-DESK");
    block(getDb(), "Gwen#4004", ADMIN);
    expect((await send(other, lua("Gwen#4004", 13, 400))).status).toBe(401);
  });
});
