import { nowSeconds } from "@/app/clock";
import { cleanLabel, CLIENT_ID, PAIRING_SECONDS, POLL_SECONDS } from "@/core/uploader";
import { getDb } from "@/server/db";
import { apiError } from "@/server/session";
import { limits, startPairing } from "@/server/uploader";
import { clientIp, formParams, siteUrl } from "@/server/uploaderHttp";

// POST: the device authorization request of the OAuth 2.0 device flow (RFC 8628 §3.1-3.2; WEB-33b,
// docs/UPLOADER-API.md "Connecting"). Open, rate-limited per IP. `device_name` and `app_version` are our extensions.

export async function POST(req: Request): Promise<Response> {
  const now = nowSeconds();
  const wait = limits.start.hit(clientIp(req), now);
  if (wait !== undefined) return apiError(429, "rate_limited", "Too many requests.", { "Retry-After": String(wait) });
  const form = await formParams(req);
  if (form === undefined) return apiError(400, "invalid_request", "Send a form (application/x-www-form-urlencoded).");
  if (form.get("client_id") !== CLIENT_ID) return apiError(401, "invalid_client", "Unknown client_id.");
  const deviceName = cleanLabel(form.get("device_name"));
  if (deviceName === undefined) return apiError(400, "invalid_request", "device_name is required.");
  const started = startPairing(getDb(), deviceName, cleanLabel(form.get("app_version"), 32), now);
  if (started === undefined) {
    return apiError(429, "rate_limited", "Too many connections waiting.", { "Retry-After": "60" });
  }
  const verify = new URL("/uploader", siteUrl(req));
  const complete = new URL(verify);
  complete.searchParams.set("code", started.userCode);
  return Response.json(
    {
      device_code: started.pairingId,
      user_code: started.userCode,
      verification_uri: verify.toString(),
      verification_uri_complete: complete.toString(),
      expires_in: PAIRING_SECONDS,
      interval: POLL_SECONDS,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
