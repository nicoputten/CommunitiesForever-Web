import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as downloadRoute } from "@/app/(site)/uploader/download/route";
import { GET as pullRoute } from "@/app/api/uploader/v1/releases/[file]/route";
import { POST as publishRoute } from "@/app/api/uploader/v1/releases/route";
import { GET as updatesRoute } from "@/app/api/uploader/v1/updates/[file]/route";
import { GET as statusRoute } from "@/app/api/uploader/v1/updates/status/route";
import { FEED_NAME, SIGNATURE_NAME } from "@/core/releases";
import { putGuest } from "@/server/access";
import { getDb } from "@/server/db";
import { receiveFiles } from "@/server/multipart";
import { createToken } from "@/server/uploader";

// WEB-35: publishing a release with the deploy secret, the update feed with a token, the installer download with a
// session; no access without them. WEB-35b: the workflow sends the whole signed feed, which is kept and served byte
// for byte with exactly the packages it lists; the workflow pulls it first with the deploy secret; the update status.

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

const pkgOf = (v: string) => `package ${v}`;
const assetOf = (v: string) => ({
  PackageId: ID,
  Version: v,
  Type: "Full",
  FileName: full(v),
  SHA256: sha(pkgOf(v)),
  Size: pkgOf(v).length,
});

/**
 * A release as the workflow sends it after `vpk pack` and signing: the installer, the new full package, the whole
 * feed (the new version and `kept` earlier ones, already on the site) and its signature. Velopack's own formatting
 * (indented, CRLF) shows the feed is stored byte for byte.
 */
function release(version: string, kept: string[] = [], extra: Record<string, string> = {}): Record<string, string> {
  const feed = JSON.stringify({ Assets: [...kept, version].map(assetOf) }, null, 2).replace(/\n/g, "\r\n");
  return {
    [SETUP]: `setup ${version}`,
    [full(version)]: pkgOf(version),
    [FEED_NAME]: feed,
    [SIGNATURE_NAME]: `sig of ${version}`,
    ...extra,
  };
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

const pull = (file: string, secret?: string) =>
  pullRoute(
    new Request(`${BASE}/api/uploader/v1/releases/${file}`, {
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    }),
    { params: Promise.resolve({ file }) },
  );

const status = (auth?: string) =>
  statusRoute(
    new Request(`${BASE}/api/uploader/v1/updates/status`, { headers: auth ? { authorization: `Bearer ${auth}` } : {} }),
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
    expect((await status(token)).status).toBe(404);
    // The first release has nothing to pull.
    expect((await pull(FEED_NAME, DEPLOY)).status).toBe(404);
  });

  it("publishes only with the deploy secret and only Velopack's files", async () => {
    expect((await publish(release("1.0.0"), "wrong-secret-wrong-secret-wrong-secret")).status).toBe(401);
    const bad = await publish({ ...release("1.0.0"), "evil.dll": "x" });
    expect([bad.status, (await bad.json()).error]).toEqual([400, "invalid_release"]);
    const mismatch = await publish({ ...release("1.0.0"), [full("1.0.0")]: "tampered" });
    expect([mismatch.status, (await mismatch.json()).error]).toEqual([400, "invalid_release"]);
    const unsigned = release("1.0.0");
    delete unsigned[SIGNATURE_NAME];
    const noSig = await publish(unsigned);
    expect([noSig.status, (await noSig.json()).error_description]).toEqual([400, `Send ${SIGNATURE_NAME}.`]);

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
    // Byte for byte as sent (the signature covers these bytes).
    expect(await feed.text()).toBe(release("1.0.0")[FEED_NAME]);
    const sig = await updates(SIGNATURE_NAME, token);
    expect([sig.status, sig.headers.get("cache-control"), await sig.text()]).toEqual([200, "no-store", "sig of 1.0.0"]);
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

  it("answers the update status to an active token", async () => {
    expect((await status()).status).toBe(401);
    process.env.UPLOADER_MINIMUM_VERSION = "1.0.0";
    try {
      const res = await status(token);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({
        latest: "1.0.0",
        releasedAt: expect.any(Number),
        minimumVersion: "1.0.0",
        notesUrl: null,
      });
    } finally {
      delete process.env.UPLOADER_MINIMUM_VERSION;
    }
    expect(((await (await status(token)).json()) as { minimumVersion: unknown }).minimumVersion).toBeNull();
  });

  it("lets the workflow pull the feed and packages with the deploy secret only", async () => {
    expect((await pull(FEED_NAME)).status).toBe(401);
    expect((await pull(FEED_NAME, token)).status).toBe(401);
    const feed = await pull(FEED_NAME, DEPLOY);
    expect([feed.status, await feed.text()]).toEqual([200, release("1.0.0")[FEED_NAME]]);
    expect(await (await pull(full("1.0.0"), DEPLOY)).text()).toBe("package 1.0.0");
    expect((await pull(SETUP, DEPLOY)).status).toBe(404);
    expect((await pull("..%2Fcurrent.json", DEPLOY)).status).toBe(404);
  });

  it("refuses a feed that lists a package the site doesn't have, or another one under its name", async () => {
    const unknown = await publish(release("1.1.0", ["0.9.0"]));
    expect([unknown.status, (await unknown.json()).error]).toEqual([400, "invalid_release"]);
    const other = release("1.1.0", ["1.0.0"]);
    other[FEED_NAME] = other[FEED_NAME]!.replace(sha(pkgOf("1.0.0")), sha("another package"));
    const changed = await publish(other);
    expect([changed.status, (await changed.json()).error]).toEqual([400, "invalid_release"]);
    expect(await (await updates(FEED_NAME, token)).text()).toBe(release("1.0.0")[FEED_NAME]);
  });

  it("keeps exactly the packages the new feed lists", async () => {
    expect((await publish(release("1.1.0", ["1.0.0"]))).status).toBe(201);
    expect((await publish(release("1.2.0", ["1.0.0", "1.1.0"]))).status).toBe(201);
    // The workflow trimmed 1.0.0 from the feed: its package goes.
    expect((await publish(release("1.3.0", ["1.1.0", "1.2.0"]))).status).toBe(201);
    expect(await (await updates(FEED_NAME, token)).text()).toBe(release("1.3.0", ["1.1.0", "1.2.0"])[FEED_NAME]);
    expect(await (await updates(SIGNATURE_NAME, token)).text()).toBe("sig of 1.3.0");
    expect(existsSync(path.join(dir, "uploader", "releases", full("1.0.0")))).toBe(false);
    expect(existsSync(path.join(dir, "uploader", "releases", full("1.1.0")))).toBe(true);
    expect((await updates(full("1.0.0"), token)).status).toBe(404);
    expect(await (await download(ADMIN)).text()).toBe("setup 1.3.0");
  });

  it("is off without a deploy secret", async () => {
    delete process.env.UPLOADER_DEPLOY_SECRET;
    try {
      expect((await publish(release("9.0.0"))).status).toBe(404);
      expect((await pull(FEED_NAME, DEPLOY)).status).toBe(404);
    } finally {
      process.env.UPLOADER_DEPLOY_SECRET = DEPLOY;
    }
  });
});
