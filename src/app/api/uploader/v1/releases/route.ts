import { nowSeconds } from "@/app/clock";
import { ReleaseError } from "@/core/releases";
import { MultipartError } from "@/server/multipart";
import { deploySecret, isDeploySecret, publish } from "@/server/releases";
import { apiError } from "@/server/session";

// POST: the uploader repo's release workflow publishes a version (WEB-35, docs/UPLOADER-API.md "Installer and
// updates"): one multipart upload of Velopack's files, with the deploy secret. 404 when no secret is configured.

export async function POST(req: Request): Promise<Response> {
  const secret = deploySecret();
  if (secret === undefined) return new Response(null, { status: 404 });
  if (!isDeploySecret(req.headers.get("authorization"), secret)) {
    return apiError(401, "invalid_token", "Wrong deploy secret.", { "WWW-Authenticate": 'Bearer realm="releases"' });
  }
  if (req.body === null) return apiError(400, "invalid_release", "Send the release files.");
  try {
    const current = await publish(req.body, req.headers.get("content-type"), nowSeconds());
    return Response.json(current, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ReleaseError) return apiError(e.code === "not_newer" ? 409 : 400, e.code, e.message);
    if (e instanceof MultipartError) {
      return apiError(
        e.code === "too_large" ? 413 : 400,
        e.code === "too_large" ? "too_large" : "invalid_release",
        e.message,
      );
    }
    throw e;
  }
}
