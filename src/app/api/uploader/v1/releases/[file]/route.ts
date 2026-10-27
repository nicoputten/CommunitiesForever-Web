import { FEED_NAME } from "@/core/releases";
import { deploySecret, feedFile, fileResponse, isDeploySecret } from "@/server/releases";
import { apiError } from "@/server/session";

// GET: the release workflow pulls the current feed and packages before `vpk pack` (WEB-35b), so Velopack builds the
// delta and a complete feed. The same files as the update feed, read only, with the deploy secret instead of an
// uploader token (`vpk download http` can't send one). 404 when no secret is configured.

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const secret = deploySecret();
  if (secret === undefined) return new Response(null, { status: 404 });
  if (!isDeploySecret(req.headers.get("authorization"), secret)) {
    return apiError(401, "invalid_token", "Wrong deploy secret.", { "WWW-Authenticate": 'Bearer realm="releases"' });
  }
  const { file } = await params;
  const found = await feedFile(file);
  if (found === undefined) return apiError(404, "not_found", "No such release file.");
  return fileResponse(found, {
    "Content-Type": file === FEED_NAME ? "application/json" : "application/octet-stream",
    "Cache-Control": "no-store",
  });
}
