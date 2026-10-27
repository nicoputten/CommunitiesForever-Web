import { nowSeconds } from "@/app/clock";
import { cleanLabel, POLL_SECONDS } from "@/core/uploader";
import { getDb } from "@/server/db";
import { jsonBody } from "@/server/http";
import { apiError } from "@/server/session";
import { limits, startPairing } from "@/server/uploader";
import { clientIp, siteUrl } from "@/server/uploaderHttp";

// POST: the app starts a pairing (WEB-33, docs/UPLOADER-API.md "Pairing"). Open, rate-limited per IP.

export async function POST(req: Request): Promise<Response> {
  const now = nowSeconds();
  const wait = limits.start.hit(clientIp(req), now);
  if (wait !== undefined) return apiError(429, "rate_limited", "Too many pairings.", { "Retry-After": String(wait) });
  const body = await jsonBody(req);
  const deviceName = cleanLabel(body?.deviceName);
  if (deviceName === undefined) return apiError(400, "bad_request", "deviceName is required.");
  const started = startPairing(getDb(), deviceName, cleanLabel(body?.appVersion, 32), now);
  if (started === undefined) {
    return apiError(429, "rate_limited", "Too many pairings waiting.", { "Retry-After": "60" });
  }
  const verifyUrl = new URL("/uploader", siteUrl(req));
  verifyUrl.searchParams.set("code", started.userCode);
  return Response.json(
    {
      pairingId: started.pairingId,
      userCode: started.userCode,
      verifyUrl: verifyUrl.toString(),
      pollSeconds: POLL_SECONDS,
      expiresAt: started.expiresAt,
    },
    { status: 201 },
  );
}
