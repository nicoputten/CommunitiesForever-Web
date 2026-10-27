import { nowSeconds } from "@/app/clock";
import { CLIENT_ID, DEVICE_CODE_GRANT } from "@/core/uploader";
import { getDb } from "@/server/db";
import { apiError } from "@/server/session";
import { limits, pollPairing } from "@/server/uploader";
import { formParams } from "@/server/uploaderHttp";

// POST: the device access token request (RFC 8628 §3.4-3.5; WEB-33b, docs/UPLOADER-API.md "Connecting"). Open: the
// unguessable device_code is the secret. The access token is long-lived until revoked (decided with Nico).

export async function POST(req: Request): Promise<Response> {
  const form = await formParams(req);
  if (form === undefined) return apiError(400, "invalid_request", "Send a form (application/x-www-form-urlencoded).");
  if (form.get("grant_type") !== DEVICE_CODE_GRANT) {
    return apiError(400, "unsupported_grant_type", "Only the device_code grant.");
  }
  if (form.get("client_id") !== CLIENT_ID) return apiError(401, "invalid_client", "Unknown client_id.");
  const deviceCode = form.get("device_code");
  if (!deviceCode) return apiError(400, "invalid_request", "device_code is required.");

  const now = nowSeconds();
  if (limits.poll.hit(deviceCode, now) !== undefined) return apiError(400, "slow_down", "Poll less often.");
  const poll = pollPairing(getDb(), deviceCode, now);
  switch (poll.status) {
    case "pending":
      return apiError(400, "authorization_pending", "Not allowed yet.");
    case "denied":
      return apiError(400, "access_denied", "Denied on the site.");
    case "expired":
      return apiError(400, "expired_token", "Expired or already used.");
    case "approved":
      return Response.json(
        { access_token: poll.token, token_type: "Bearer" },
        { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
      );
  }
}
