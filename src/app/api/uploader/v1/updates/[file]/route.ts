import { FEED_NAME } from "@/core/releases";
import { feedFile, fileResponse } from "@/server/releases";
import { apiError, tokenGuard } from "@/server/session";

// GET: the Velopack update feed for the app (WEB-35, docs/UPLOADER-API.md "Installer and updates"): the feed and the
// packages it lists, for any active token. Packages never change under their name; the feed always may.

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const caller = tokenGuard(req, false);
  if (caller instanceof Response) return caller;
  const { file } = await params;
  const found = await feedFile(file);
  if (found === undefined) return apiError(404, "not_found", "No such release file.");
  return file === FEED_NAME
    ? fileResponse(found, { "Content-Type": "application/json", "Cache-Control": "no-store" })
    : fileResponse(found, {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable",
      });
}
