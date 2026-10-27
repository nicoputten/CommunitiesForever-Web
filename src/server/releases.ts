import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import {
  checkRelease,
  type CurrentRelease,
  FEED_NAME,
  isSafeName,
  mergeFeed,
  parseFeed,
  type ReleaseAsset,
  ReleaseError,
  releaseFileKind,
} from "@/core/releases";
import { dataDir } from "./db";
import { boundaryOf, receiveFiles } from "./multipart";

// The uploader's releases on the data volume (WEB-35): `DATA_DIR/uploader/releases/` holds the kept packages, the
// newest installer and the feed; `current.json` names the newest release. A publish is staged in its own folder and
// moved in with the feed and current.json last, so the app never sees half a release.

const root = () => path.join(dataDir(), "uploader");
const releasesDir = () => path.join(root(), "releases");
const currentFile = () => path.join(root(), "current.json");

/** UPLOADER_DEPLOY_SECRET (.env.example); publishing is off (404) without one of at least 32 characters. */
export function deploySecret(env: Record<string, string | undefined> = process.env): string | undefined {
  const secret = env.UPLOADER_DEPLOY_SECRET;
  return secret !== undefined && secret.length >= 32 ? secret : undefined;
}

/** Constant-time comparison of `Authorization: Bearer <secret>` with the deploy secret. */
export function isDeploySecret(header: string | null, secret: string): boolean {
  const sent = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "")?.[1] ?? "";
  const a = createHash("sha256").update(sent).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export async function readCurrent(): Promise<CurrentRelease | undefined> {
  try {
    return JSON.parse(await readFile(currentFile(), "utf8")) as CurrentRelease;
  } catch {
    return undefined;
  }
}

async function readFeed(): Promise<ReleaseAsset[]> {
  try {
    return parseFeed(await readFile(path.join(releasesDir(), FEED_NAME), "utf8"));
  } catch {
    return [];
  }
}

/** A file the feed may serve: the feed itself or a package it lists. Undefined for anything else. */
export async function feedFile(name: string): Promise<string | undefined> {
  if (!isSafeName(name)) return undefined;
  if (name !== FEED_NAME && !(await readFeed()).some((a) => a.FileName === name)) return undefined;
  return path.join(releasesDir(), name);
}

/** The newest installer's path and what is known about it; undefined before the first release. */
export async function currentSetup(): Promise<{ path: string; current: CurrentRelease } | undefined> {
  const current = await readCurrent();
  return current === undefined ? undefined : { path: path.join(releasesDir(), current.setup), current };
}

let publishing = false;

/**
 * Publishes a release from the workflow's multipart upload (docs/UPLOADER-API.md). Throws ReleaseError (invalid or
 * not newer) or MultipartError; nothing changes then. One publish at a time.
 */
export async function publish(
  body: ReadableStream<Uint8Array>,
  contentType: string | null,
  now: number,
): Promise<CurrentRelease> {
  const boundary = boundaryOf(contentType);
  if (boundary === undefined) throw new ReleaseError("invalid_release", "Send multipart/form-data.");
  if (publishing) throw new ReleaseError("invalid_release", "Another publish is running.");
  publishing = true;
  const staging = path.join(root(), `staging-${randomBytes(6).toString("hex")}`);
  try {
    await mkdir(staging, { recursive: true });
    await mkdir(releasesDir(), { recursive: true });
    const files = await receiveFiles(body, boundary, staging, (sent) =>
      releaseFileKind(sent) === undefined ? undefined : sent,
    );
    const feedSent = files.find((f) => f.name === FEED_NAME);
    if (feedSent === undefined) throw new ReleaseError("invalid_release", `Send ${FEED_NAME}.`);
    const release = checkRelease(files, await readFile(feedSent.path, "utf8"), (await readCurrent())?.version);

    // Packages and the installer first, then the feed and current.json: the switch.
    const previous = await readCurrent();
    for (const asset of release.assets)
      await rename(path.join(staging, asset.FileName), path.join(releasesDir(), asset.FileName));
    await rename(path.join(staging, release.setup.name), path.join(releasesDir(), release.setup.name));
    const feed = mergeFeed(await readFeed(), release.assets);
    const feedTemp = path.join(staging, "feed.tmp");
    await writeFile(feedTemp, JSON.stringify({ Assets: feed }, null, 2));
    await rename(feedTemp, path.join(releasesDir(), FEED_NAME));
    const current: CurrentRelease = {
      version: release.version,
      setup: release.setup.name,
      size: release.setup.size,
      publishedAt: now,
    };
    const currentTemp = path.join(staging, "current.tmp");
    await writeFile(currentTemp, JSON.stringify(current, null, 2));
    await rename(currentTemp, currentFile());

    // Clean up: packages no longer in the feed, and the previous installer.
    const keep = new Set([FEED_NAME, current.setup, ...feed.map((a) => a.FileName)]);
    for (const name of await readdir(releasesDir())) {
      if (!keep.has(name) && (name === previous?.setup || releaseFileKind(name) !== undefined)) {
        await rm(path.join(releasesDir(), name), { force: true });
      }
    }
    return current;
  } finally {
    publishing = false;
    await rm(staging, { recursive: true, force: true });
  }
}

/** A file as a streamed response; 404 when it is gone. */
export async function fileResponse(file: string, headers: Record<string, string>): Promise<Response> {
  try {
    const info = await stat(file);
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
    return new Response(stream, { headers: { ...headers, "Content-Length": String(info.size) } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
