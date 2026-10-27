import { nowSeconds } from "@/app/clock";
import { cleanLabel } from "@/core/uploader";
import { tokenGuard } from "@/server/session";
import { touchToken } from "@/server/uploader";
import { siteName } from "@/server/uploaderHttp";

// GET: who the app's token belongs to (WEB-33, docs/UPLOADER-API.md "Identity"), the app's "Test connection".
// "Disconnect" is the standard revocation endpoint (../revoke).

export function GET(req: Request): Response {
  const caller = tokenGuard(req);
  if (caller instanceof Response) return caller;
  const d = caller.device;
  const appVersion = cleanLabel(req.headers.get("x-uploader-version"), 32);
  touchToken(caller.db, d.id, nowSeconds(), appVersion);
  return Response.json({
    battleTag: d.battleTag,
    siteName: siteName(),
    deviceName: d.deviceName,
    appVersion: appVersion ?? d.appVersion ?? null,
    createdAt: d.createdAt,
    lastUploadAt: d.lastUploadAt ?? null,
  });
}
