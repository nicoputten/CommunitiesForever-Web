import { nowSeconds } from "@/app/clock";
import { probeFileName } from "@/core/probe";
import { loadProbeFile } from "@/server/probe";
import { guard } from "@/server/session";

// GET: the friends' launch-probe results as a JSON file (WEB-82), for the owner only: admins and friends get 403,
// without a session 401. The file is an attachment and is never cached or logged.

export async function GET(req: Request): Promise<Response> {
  const caller = await guard(req, "owner");
  if (caller instanceof Response) return caller;
  const now = nowSeconds();
  return new Response(JSON.stringify(loadProbeFile(caller.db, now), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${probeFileName(now)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
