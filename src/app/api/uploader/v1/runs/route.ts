import { nowSeconds } from "@/app/clock";
import { cleanLabel } from "@/core/uploader";
import { uploaderRuns } from "@/core/uploaderRuns";
import { effectiveTimeZone, getBotSettings } from "@/server/discord";
import { listRuns } from "@/server/runs";
import { tokenGuard } from "@/server/session";
import { touchToken } from "@/server/uploader";
import { siteUrl } from "@/server/uploaderHttp";
import { loadState } from "@/server/uploads";

// GET: the upcoming runs (next 14 days) for the game (WEB-44, docs/UPLOADER-API.md "Runs"), in the shape of the
// addon's planned runs file, which the uploader writes as Data\Runs.lua (UP-12). Any active upload token.

export const dynamic = "force-dynamic";

export function GET(req: Request): Response {
  const caller = tokenGuard(req);
  if (caller instanceof Response) return caller;
  const { db } = caller;
  const now = nowSeconds();
  touchToken(db, caller.device.id, now, cleanLabel(req.headers.get("x-uploader-version"), 32));
  const data = loadState(db)?.data;
  const body = uploaderRuns({
    runs: listRuns(db),
    characterName: (guid) => data?.characters[guid]?.name,
    timeZoneOf: (battleTag) => effectiveTimeZone(db, battleTag),
    reminderMinutes: getBotSettings(db).reminderMinutes,
    siteUrl: siteUrl(req),
    now,
  });
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
