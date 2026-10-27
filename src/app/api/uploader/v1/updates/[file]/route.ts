import { FEED_NAME, SIGNATURE_NAME } from "@/core/releases";
import { feedFile, fileResponse } from "@/server/releases";
import { apiError, tokenGuard } from "@/server/session";

// GET: the Velopack update feed for the app (WEB-35, docs/UPLOADER-API.md "Installer and updates"): the feed and the
// packages it lists, and the feed's signature (WEB-35b), for any active token. The feed and signature are served byte
// for byte as the release workflow sent them.

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const caller = tokenGuard(req, false);
  if (caller instanceof Response) return caller;
  const { file } = await params;
  const found = await feedFile(file);
  if (found === undefined) return apiError(404, "not_found", "No such release file.");
  // The feed and its signature change with every release; packages never change under their name.
  if (file === FEED_NAME || file === SIGNATURE_NAME) {
    return fileResponse(found, {
      "Content-Type": file === FEED_NAME ? "application/json" : "application/octet-stream",
      "Cache-Control": "no-store",
    });
  }
  return fileResponse(found, {
    "Content-Type": "application/octet-stream",
    "Cache-Control": "private, max-age=31536000, immutable",
  });
}
