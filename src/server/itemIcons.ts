import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_ICON_CDN, FALLBACK_ICON, iconName, iconUrl, isJpeg } from "@/core/recipes/icons";
import { dataDir } from "./db";

// The icon cache (WEB-90, handoff B3): `DATA_DIR/icons/<name>.jpg`, fetched once from the CDN (ICON_CDN_URL) on the
// first request for a name and served from disk from then on. A name the CDN doesn't have gets the game's
// question-mark icon instead; it is asked again after a week (`<name>.missing`), in case the CDN gains it.

const MAX_BYTES = 64 * 1024;
const RETRY_MISSING_MS = 7 * 24 * 3600 * 1000;
const TIMEOUT_MS = 10_000;

export interface IconOptions {
  dir?: string;
  cdn?: string;
  fetch?: typeof fetch;
  now?: number;
}

/** In-flight fetches per name, so many requests for a new icon fetch it once. */
const pending = new Map<string, Promise<Uint8Array | undefined>>();

function dirOf(options: IconOptions): string {
  return options.dir ?? path.join(dataDir(), "icons");
}

function readCached(file: string): Uint8Array | undefined {
  try {
    return new Uint8Array(readFileSync(file));
  } catch {
    return undefined;
  }
}

async function fetchIcon(name: string, options: IconOptions): Promise<Uint8Array | undefined> {
  const dir = dirOf(options);
  const file = path.join(dir, `${name}.jpg`);
  const cached = readCached(file);
  if (cached !== undefined) return cached;
  const missing = path.join(dir, `${name}.missing`);
  const now = options.now ?? Date.now();
  try {
    if (now - statSync(missing).mtimeMs < RETRY_MISSING_MS) return undefined;
  } catch {
    // never asked, or the marker is gone
  }
  let bytes: Uint8Array | undefined;
  try {
    const res = await (options.fetch ?? fetch)(
      iconUrl(options.cdn ?? (process.env.ICON_CDN_URL || DEFAULT_ICON_CDN), name),
      {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (res.ok) {
      const body = new Uint8Array(await res.arrayBuffer());
      if (body.byteLength <= MAX_BYTES && isJpeg(body)) bytes = body;
    } else if (res.status !== 403 && res.status !== 404) {
      return undefined; // the CDN is down: ask again next time
    }
  } catch {
    return undefined; // network error or timeout: ask again next time
  }
  mkdirSync(dir, { recursive: true });
  if (bytes === undefined) {
    writeFileSync(missing, "");
    return undefined;
  }
  // Written whole, then moved in: a reader never sees half a file.
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, file);
  return bytes;
}

function once(name: string, options: IconOptions): Promise<Uint8Array | undefined> {
  const key = `${dirOf(options)}|${name}`;
  let p = pending.get(key);
  if (p === undefined) {
    p = fetchIcon(name, options).finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

/** The icon's JPEG, else the question mark's; undefined only when neither can be had (the CDN unreachable). */
export async function itemIcon(raw: string, options: IconOptions = {}): Promise<Uint8Array | undefined> {
  const name = iconName(raw);
  const icon = name !== undefined ? await once(name, options) : undefined;
  return icon ?? (name !== FALLBACK_ICON ? await once(FALLBACK_ICON, options) : undefined);
}
