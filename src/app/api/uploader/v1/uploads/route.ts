import { nowSeconds } from "@/app/clock";
import { cleanLabel, uploaderUploadResponse } from "@/core/uploader";
import { apiError, tokenGuard } from "@/server/session";
import { limits, touchToken } from "@/server/uploader";
import { readCapped, siteUrl } from "@/server/uploaderHttp";
import { firstOkId, MAX_UPLOAD_BYTES, upload, UploadForbiddenError, UploadTooLargeError } from "@/server/uploads";

// POST: the app uploads the raw SavedVariables file with its token (WEB-33, docs/UPLOADER-API.md "Uploading"). The
// same checks and storage as the upload page (src/app/api/uploads); the answer is the app's own stable shape.

export async function POST(req: Request): Promise<Response> {
  const caller = tokenGuard(req);
  if (caller instanceof Response) return caller;
  const now = nowSeconds();
  const wait = limits.upload.hit(String(caller.device.id), now);
  if (wait !== undefined) return apiError(429, "rate_limited", "Too many uploads.", { "Retry-After": String(wait) });

  const file = await readCapped(req, MAX_UPLOAD_BYTES);
  if (file === undefined) return tooLarge();
  if (file.byteLength === 0) return apiError(400, "empty_file", "The body is empty.");

  try {
    const result = upload(caller.db, file, caller.battleTag, now, undefined, caller.device.id);
    touchToken(caller.db, caller.device.id, now, cleanLabel(req.headers.get("x-uploader-version"), 32), true);
    const first = result.status === "ok" && firstOkId(caller.db) === result.id;
    return Response.json(uploaderUploadResponse({ ...result, first }, siteUrl(req)));
  } catch (e) {
    if (e instanceof UploadTooLargeError) return tooLarge();
    if (e instanceof UploadForbiddenError) return apiError(403, "may_not_upload", "This user may not upload.");
    throw e;
  }
}

function tooLarge(): Response {
  return apiError(413, "too_large", `The file is larger than ${MAX_UPLOAD_BYTES} bytes.`);
}
