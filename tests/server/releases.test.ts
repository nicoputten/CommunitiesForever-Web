import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as downloadRoute } from "@/app/(site)/uploader/download/route";
import { POST as publishRoute } from "@/app/api/uploader/v1/releases/route";
import { GET as updatesRoute } from "@/app/api/uploader/v1/updates/[file]/route";
import { FEED_NAME } from "@/core/releases";
import { putGuest } from "@/server/access";
import { getDb } from "@/server/db";
import { receiveFiles } from "@/server/multipart";
import { createToken } from "@/server/uploader";

// WEB-35: publishing a release with the deploy secret, the update feed with a token, the installer download with a
// session; no access without them.

const SECRET = "test-secret-at-least-32-characters-long";
const DEPLOY = "deploy-secret-of-at-least-32-characters!";
const ADMIN = "Nico#1000";
const BASE = "http://localhost:3000";
const ID = "CommunitiesForever.Upload";
const SETUP = `${ID}-win-Setup.exe`;

let dir: string;
let token: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = SECRET;
  process.env.ADMIN_BATTLETAG = ADMIN;
  process.env.UPLOADER_DEPLOY_SECRET = DEPLOY;
  putGuest(getDb(), "Gus#3003", false, ADMIN);
  token = createToken(getDb(), "Gus#3003", "GUS-PC", null, "manual", 1000).token;
});

afterAll(() => {
  getDb().$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const sha = (data: string) => createHash("sha256").update(data).digest("hex");
const full = (v: string) => `${ID}-${v}-full.nupkg`;

/** A release as `vpk pack` would leave it: the installer, the full package and the feed. */
function release(version: string, extra: Record<string, string> = {}): Record<string, string> {
  const pkg = `package ${version}`;
  const feed = JSON.stringify({
    Assets: [
      { PackageId: ID, Version: version, Type: "Full", FileName: full(version), SHA256: sha(pkg), Size: pkg.length },
    ],
  });
  return { [SETUP]: `setup ${version}`, [full(version)]: pkg, [FEED_NAME]: feed, ...extra };
}

function multipart(files: Record<string, string>, boundary = "----cfboundary7"): string {
  return (
    Object.entries(files)
      .map(
        ([name, body]) =>
          `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${name}"\r\n` +
          `Content-Type: application/octet-stream\r\n\r\n${body}\r\n`,
      )
      .join("") + `--${boundary}--\r\n`
  );
}

/** The body in tiny chunks, so the multipart reader has to join them. */
function chunked(text: string, size = 7): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let at = 0;
  return new ReadableStream({
    pull(controller) {
      if (at >= bytes.length) return controller.close();
      controller.enqueue(bytes.subarray(at, at + size));
      at += size;
    },
  });
}

const publish = (files: Record<string, string>, secret = DEPLOY) =>
  publishRoute(
    new Request(`${BASE}/api/uploader/v1/releases`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "multipart/form-data; boundary=----cfboundary7" },
      body: chunked(multipart(files)),
      duplex: "half",
    } as RequestInit),
  );

const updates = (file: string, auth?: string) =>
  updatesRoute(
    new Request(`${BASE}/api/uploader/v1/updates/${file}`, {
      headers: auth ? { authorization: `Bearer ${auth}` } : {},
    }),
    { params: Promise.resolve({ file }) },
  );

async function download(as?: string): Promise<Response> {
  const headers = new Headers();
  if (as !== undefined) {
    const name = "authjs.session-token";
    headers.set("cookie", `${name}=${await encode({ token: { battleTag: as }, secret: SECRET, salt: name })}`);
  }
  return downloadRoute(new NextRequest(new URL("/uploader/download", BASE), { headers }));
}

describe("multipart reader", () => {
  it("writes each file part to disk with its size and hash, across chunk borders", async () => {
    const out = mkdtempSync(path.join(tmpdir(), "cf-mp-"));
    const body = "x\r\n--almost a boundary\r\n" + "y".repeat(100);
    const files = await receiveFiles(
      chunked(multipart({ "a-full.nupkg": body, "b.json": "{}" }), 5),
      "----cfboundary7",
      out,
      (n) => n,
    );
    expect(files.map((f) => [f.name, f.size, f.sha256])).toEqual([
      ["a-full.nupkg", body.length, sha(body)],
      ["b.json", 2, sha("{}")],
    ]);
    rmSync(out, { recursive: true, force: true });
  });
});

describe("releases", () => {
  it("has nothing before the first release", async () => {
    expect((await download(ADMIN)).status).toBe(404);
    expect((await updates(FEED_NAME, token)).status).toBe(404);
  });

  it("publishes only with the deploy secret and only Velopack's files", async () => {
    expect((await publish(release("1.0.0"), "wrong-secret-wrong-secret-wrong-secret")).status).toBe(401);
    const bad = await publish({ ...release("1.0.0"), "evil.dll": "x" });
    expect([bad.status, (await bad.json()).error]).toEqual([400, "invalid_release"]);
    const mismatch = await publish({ ...release("1.0.0"), [full("1.0.0")]: "tampered" });
    expect([mismatch.status, (await mismatch.json()).error]).toEqual([400, "invalid_release"]);

    const ok = await publish(release("1.0.0"));
    expect(ok.status).toBe(201);
    // The contract's example (docs/UPLOADER-API.md): the same keys and value types.
    const doc = readFileSync(new URL("../../docs/UPLOADER-API.md", import.meta.url), "utf8");
    const example = JSON.parse(/<!-- example: release -->\s*```json\n([\s\S]*?)```/.exec(doc)![1]!) as object;
    const shape = (o: object) =>
      Object.entries(o)
        .map(([k, v]) => `${k}:${typeof v}`)
        .sort();
    expect(shape((await ok.clone().json()) as object)).toEqual(shape(example));
    expect(await ok.json()).toMatchObject({ version: "1.0.0", setup: SETUP, size: "setup 1.0.0".length });
    const again = await publish(release("1.0.0"));
    expect([again.status, (await again.json()).error]).toEqual([409, "not_newer"]);
    expect(readdirSync(path.join(dir, "uploader")).filter((n) => n.startsWith("staging"))).toEqual([]);
  });

  it("serves the feed and its packages to an active token only", async () => {
    expect((await updates(FEED_NAME)).status).toBe(401);
    expect((await updates(FEED_NAME, `cfu_${"x".repeat(43)}`)).status).toBe(401);
    // Gus may not upload, but may update.
    const feed = await updates(FEED_NAME, token);
    expect(feed.status).toBe(200);
    expect(feed.headers.get("cache-control")).toBe("no-store");
    expect((await feed.json()).Assets.map((a: { Version: string }) => a.Version)).toEqual(["1.0.0"]);
    const pkg = await updates(full("1.0.0"), token);
    expect(await pkg.text()).toBe("package 1.0.0");
    expect(pkg.headers.get("cache-control")).toContain("immutable");
    expect((await updates("..%2Fcurrent.json", token)).status).toBe(404);
    expect((await updates(SETUP, token)).status).toBe(404);
  });

  it("lets uploaders download the installer", async () => {
    expect((await download()).status).toBe(401);
    expect((await download("Gus#3003")).status).toBe(404);
    const ok = await download(ADMIN);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).toBe('attachment; filename="CommunitiesForever-Uploader-Setup.exe"');
    expect(await ok.text()).toBe("setup 1.0.0");
  });

  it("keeps the newest three versions", async () => {
    for (const v of ["1.1.0", "1.2.0", "1.3.0"]) expect((await publish(release(v))).status).toBe(201);
    const versions = (await (await updates(FEED_NAME, token)).json()).Assets.map((a: { Version: string }) => a.Version);
    expect(versions).toEqual(["1.1.0", "1.2.0", "1.3.0"]);
    expect(existsSync(path.join(dir, "uploader", "releases", full("1.0.0")))).toBe(false);
    expect(await (await download(ADMIN)).text()).toBe("setup 1.3.0");
  });

  it("is off without a deploy secret", async () => {
    delete process.env.UPLOADER_DEPLOY_SECRET;
    try {
      expect((await publish(release("9.0.0"))).status).toBe(404);
    } finally {
      process.env.UPLOADER_DEPLOY_SECRET = DEPLOY;
    }
  });
});
