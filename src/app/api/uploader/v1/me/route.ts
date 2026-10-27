import { nowSeconds } from "@/app/clock";
import { cleanLabel } from "@/core/uploader";
import { tokenGuard } from "@/server/session";
import { revokeToken, touchToken } from "@/server/uploader";
import { siteName } from "@/server/uploaderHttp";

// The app's own token (WEB-33, docs/UPLOADER-API.md "Identity and disconnect"): GET is "Test connection", DELETE is
// "Disconnect".

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

export function DELETE(req: Request): Response {
  const caller = tokenGuard(req);
  if (caller instanceof Response) return caller;
  revokeToken(caller.db, caller.battleTag, caller.device.id, nowSeconds());
  return new Response(null, { status: 204 });
}
