import { nowSeconds } from "@/app/clock";
import { CLIENT_ID } from "@/core/uploader";
import { getDb } from "@/server/db";
import { apiError } from "@/server/session";
import { revokeBySecret } from "@/server/uploader";
import { formParams } from "@/server/uploaderHttp";

// POST: token revocation (RFC 7009; WEB-33b), the app's "Disconnect". Holding the token is the proof. An unknown or
// already revoked token also answers 200 (RFC 7009 §2.2), so the answer tells nothing.

export async function POST(req: Request): Promise<Response> {
  const form = await formParams(req);
  if (form === undefined) return apiError(400, "invalid_request", "Send a form (application/x-www-form-urlencoded).");
  if (form.get("client_id") !== CLIENT_ID) return apiError(401, "invalid_client", "Unknown client_id.");
  const token = form.get("token");
  if (!token) return apiError(400, "invalid_request", "token is required.");
  revokeBySecret(getDb(), token, nowSeconds());
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
