import { battleTagKey } from "@/core/access";
import { listGuests, putGuest, removeGuest } from "@/server/access";
import { logChange } from "@/server/admins";
import { nowSeconds } from "@/app/clock";
import { attempt, badRequest, jsonBody } from "@/server/http";
import { guard } from "@/server/session";

// The guest list for the admin page (WEB-18). The owner and admins (WEB-06, WEB-64); a real change goes in the admin
// changes log, a repeat doesn't.

export async function GET(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  return Response.json(listGuests(caller.db));
}

/** Adds a guest or changes "may upload": `{ battleTag, mayUpload }`. */
export async function PUT(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  const body = await jsonBody(req);
  if (typeof body?.battleTag !== "string" || typeof body.mayUpload !== "boolean") {
    return badRequest("Send { battleTag, mayUpload }.");
  }
  const { battleTag, mayUpload } = body;
  return attempt(() => {
    const now = nowSeconds();
    const before = listGuests(caller.db).find((g) => battleTagKey(g.battleTag) === battleTagKey(battleTag));
    const guest = putGuest(caller.db, battleTag, mayUpload, caller.battleTag, now);
    if (before === undefined) logChange(caller.db, caller.battleTag, "guestAdded", now, guest.battleTag);
    else if (before.mayUpload !== mayUpload) {
      logChange(
        caller.db,
        caller.battleTag,
        "guestChanged",
        now,
        guest.battleTag,
        mayUpload ? "may upload" : "may not upload",
      );
    }
    return guest;
  });
}

/** Removes a guest: `{ battleTag }`. */
export async function DELETE(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  const body = await jsonBody(req);
  if (typeof body?.battleTag !== "string") return badRequest("Send { battleTag }.");
  const { battleTag } = body;
  return attempt(() => {
    const removed = removeGuest(caller.db, battleTag);
    if (removed) logChange(caller.db, caller.battleTag, "guestRemoved", nowSeconds(), battleTag);
    return { removed };
  });
}
