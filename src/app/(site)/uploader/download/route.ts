import { SETUP_DOWNLOAD_NAME } from "@/core/releases";
import { currentSetup, fileResponse } from "@/server/releases";
import { guard } from "@/server/session";

// GET: the newest installer (WEB-35), for everyone who may upload (the uploader page's "Download for Windows");
// 404 for anyone else, as the page, and before the first release.

export async function GET(req: Request): Promise<Response> {
  const caller = await guard(req, "upload");
  if (caller instanceof Response) return caller.status === 401 ? caller : new Response(null, { status: 404 });
  const setup = await currentSetup();
  if (setup === undefined) return new Response(null, { status: 404 });
  return fileResponse(setup.path, {
    "Content-Type": "application/vnd.microsoft.portable-executable",
    "Content-Disposition": `attachment; filename="${SETUP_DOWNLOAD_NAME}"`,
    "Cache-Control": "private, no-store",
  });
}
