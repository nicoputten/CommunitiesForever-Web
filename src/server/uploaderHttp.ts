import { getSiteInfo } from "@/app/site";

// Request helpers for the uploader API routes (WEB-33).

/**
 * The client's IP for rate limits: the rightmost `X-Forwarded-For` entry, which our nginx appends
 * (docs/ARCHITECTURE.md "Hosting"; port 3000 is never reachable from outside). Without it, one shared key.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || "direct";
}

/** The public origin for links the app opens: AUTH_URL behind nginx, else the request's own. */
export function siteUrl(req: Request): string {
  return process.env.AUTH_URL || new URL(req.url).origin;
}

export function siteName(): string {
  return getSiteInfo().name;
}

/** The body, at most `max` bytes; undefined when it is larger (reading stops there). */
export async function readCapped(req: Request, max: number): Promise<Uint8Array | undefined> {
  if (Number(req.headers.get("content-length") ?? "0") > max) return undefined;
  if (req.body === null) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    body.set(c, at);
    at += c.byteLength;
  }
  return body;
}
