import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DELETE as unblockRoute, GET as blocksRoute, PUT as blockRoute } from "@/app/api/admin/blocks/route";
import { GET as guestsRoute, PUT as putGuestRoute } from "@/app/api/admin/guests/route";
import { GET as healthRoute } from "@/app/api/health/route";
import { POST as uploadRoute } from "@/app/api/uploads/route";
import { isPublic, proxy } from "@/proxy";
import { putGuest } from "@/server/access";
import { getDb } from "@/server/db";
import { sessionBattleTag } from "@/server/session";

// Route tests (WEB-06): 401 without a session, 403 without the role. Battle.net is not involved: the session cookie
// is minted with the test AUTH_SECRET, as Auth.js would after a sign-in.

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
  putGuest(getDb(), "Gus#3003", false, ADMIN);
  putGuest(getDb(), "Gwen#4004", true, ADMIN);
});

afterAll(() => {
  getDb().$client.close();
  rmSync(dir, { recursive: true, force: true });
});

async function cookie(battleTag: string, name = COOKIE, secret = SECRET): Promise<string> {
  return `${name}=${await encode({ token: { battleTag }, secret, salt: name })}`;
}

async function request(
  pathname: string,
  as?: string,
  init: { method?: string; body?: BodyInit; json?: unknown } = {},
): Promise<NextRequest> {
  const headers = new Headers();
  if (as !== undefined) headers.set("cookie", await cookie(as));
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  return new NextRequest(new URL(pathname, BASE), { method: init.method ?? "GET", headers, body });
}

function fileForm(text: string): FormData {
  const form = new FormData();
  form.set("file", new Blob([text]), "CommunitiesForever.lua");
  return form;
}

const post = async (as: string | undefined, text: string) =>
  uploadRoute(await request("/api/uploads", as, { method: "POST", body: fileForm(text) }));

const lua = (tag: string, club = 7) =>
  `CommunitiesForeverDB = { global = { schemaVersion = 1, self = { battleTag = "${tag}" }, settings = { clubId = ${club} } } }`;

describe("session cookie", () => {
  it("reads the BattleTag from a valid cookie only", async () => {
    expect(await sessionBattleTag(await request("/", ADMIN))).toBe(ADMIN);
    expect(await sessionBattleTag(await request("/"))).toBeUndefined();
    const forged = new Request(BASE, {
      headers: { cookie: await cookie(ADMIN, COOKIE, "another-secret-of-32-characters!!") },
    });
    expect(await sessionBattleTag(forged)).toBeUndefined();
  });

  it("reads the secure cookie behind HTTPS", async () => {
    const name = "__Secure-authjs.session-token";
    const req = new Request("https://wow.example/", { headers: { cookie: await cookie(ADMIN, name) } });
    expect(await sessionBattleTag(req)).toBe(ADMIN);
  });
});

describe("proxy", () => {
  it("leaves sign-in, the Auth.js routes, the not-on-the-list page and the health check open", async () => {
    for (const p of ["/signin", "/not-on-list", "/api/auth/callback/battlenet", "/api/auth/csrf", "/api/health"]) {
      expect(isPublic(p)).toBe(true);
      expect((await proxy(await request(p))).headers.get("x-middleware-next")).toBe("1");
    }
    expect(isPublic("/signin/x")).toBe(false);
    expect(isPublic("/api/authx")).toBe(false);
  });

  it("sends pages without a session to sign-in", async () => {
    const res = await proxy(await request("/roster?x=1"));
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/signin");
    expect(to.searchParams.get("callbackUrl")).toBe("/roster?x=1");
  });

  it("answers API routes without a session with 401", async () => {
    expect((await proxy(await request("/api/uploads", undefined, { method: "POST" }))).status).toBe(401);
    expect((await proxy(await request("/api/anything"))).status).toBe(401);
  });

  it("sends someone not on the list to the not-on-the-list page, or 403 for the API", async () => {
    const page = await proxy(await request("/", "Eve#6666"));
    expect(page.status).toBe(307);
    expect(new URL(page.headers.get("location")!).pathname).toBe("/not-on-list");
    expect((await proxy(await request("/api/uploads", "Eve#6666"))).status).toBe(403);
  });

  it("lets the admin and guests through", async () => {
    expect((await proxy(await request("/", ADMIN))).headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(await request("/", "gus#3003"))).headers.get("x-middleware-next")).toBe("1");
  });
});

describe("upload route", () => {
  it("needs a session and may upload", async () => {
    expect((await post(undefined, lua(ADMIN))).status).toBe(401);
    expect((await post("Eve#6666", lua("Eve#6666"))).status).toBe(403);
    expect((await post("Gus#3003", lua("Gus#3003"))).status).toBe(403);
  });

  it("stores the admin's file, then takes a guest's file of the community", async () => {
    const admin = await post(ADMIN, lua(ADMIN));
    expect(admin.status).toBe(200);
    expect(await admin.json()).toMatchObject({ status: "ok" });
    expect(await (await post("Gwen#4004", lua("Gwen#4004"))).json()).toMatchObject({ status: "ok" });
  });

  it("returns the rejection reasons", async () => {
    expect(await (await post("Gwen#4004", lua(ADMIN))).json()).toMatchObject({
      status: "rejected",
      rejection: { code: "not-your-file", owner: ADMIN },
    });
    expect(await (await post("Gwen#4004", lua("Gwen#4004", 8))).json()).toMatchObject({
      status: "rejected",
      rejection: { code: "other-community" },
    });
  });

  it("asks for a file", async () => {
    const res = await uploadRoute(await request("/api/uploads", ADMIN, { method: "POST", json: {} }));
    expect(res.status).toBe(400);
  });
});

describe("admin routes", () => {
  it("need a session and the admin", async () => {
    expect((await guestsRoute(await request("/api/admin/guests"))).status).toBe(401);
    expect((await blocksRoute(await request("/api/admin/blocks"))).status).toBe(401);
    for (const who of ["Gwen#4004", "Gus#3003", "Eve#6666"]) {
      expect((await guestsRoute(await request("/api/admin/guests", who))).status).toBe(403);
      const put = await blockRoute(
        await request("/api/admin/blocks", who, { method: "PUT", json: { battleTag: ADMIN } }),
      );
      expect(put.status).toBe(403);
    }
  });

  it("keep the guest list", async () => {
    const put = await putGuestRoute(
      await request("/api/admin/guests", ADMIN, { method: "PUT", json: { battleTag: "Hal#5005", mayUpload: false } }),
    );
    expect(await put.json()).toMatchObject({ battleTag: "Hal#5005", mayUpload: false, addedBy: ADMIN });
    const bad = await putGuestRoute(
      await request("/api/admin/guests", ADMIN, { method: "PUT", json: { battleTag: "Hal" } }),
    );
    expect(bad.status).toBe(400);
    const list = (await (await guestsRoute(await request("/api/admin/guests", ADMIN))).json()) as {
      battleTag: string;
    }[];
    expect(list.map((g) => g.battleTag)).toContain("Hal#5005");
  });

  it("block at once, never the admin", async () => {
    const block = (tag: string) => request("/api/admin/blocks", ADMIN, { method: "PUT", json: { battleTag: tag } });
    expect((await blockRoute(await block(ADMIN))).status).toBe(400);
    expect((await blockRoute(await block("Gwen#4004"))).status).toBe(200);
    expect((await proxy(await request("/", "Gwen#4004"))).headers.get("location")).toContain("/not-on-list");
    expect((await post("Gwen#4004", lua("Gwen#4004"))).status).toBe(403);
    const lift = await unblockRoute(
      await request("/api/admin/blocks", ADMIN, { method: "DELETE", json: { battleTag: "Gwen#4004" } }),
    );
    expect(await lift.json()).toEqual({ unblocked: true });
  });
});

describe("health route", () => {
  it("tells only ok and the version", async () => {
    const res = healthRoute();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, version: "dev" });
  });

  it("names the image version", async () => {
    process.env.APP_VERSION = "v1.2.3";
    try {
      expect(await healthRoute().json()).toEqual({ ok: true, version: "v1.2.3" });
    } finally {
      delete process.env.APP_VERSION;
    }
  });
});
