import { minimumVersion, updateStatus } from "@/core/releases";
import { readCurrent } from "@/server/releases";
import { apiError, tokenGuard } from "@/server/session";
import { siteUrl } from "@/server/uploaderHttp";

// GET: the newest uploader release for the app's update check (WEB-35b, UP-10; docs/UPLOADER-API.md "Installer and
// updates"), for any active token like the feed. `minimumVersion` is UPLOADER_MINIMUM_VERSION (.env.example); `notesUrl`
// the "What's new" page at the newest version (WEB-73).

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const caller = tokenGuard(req, false);
  if (caller instanceof Response) return caller;
  const current = await readCurrent();
  if (current === undefined) return apiError(404, "not_found", "No release yet.");
  return Response.json(updateStatus(current, minimumVersion(process.env.UPLOADER_MINIMUM_VERSION), siteUrl(req)), {
    headers: { "Cache-Control": "no-store" },
  });
}
