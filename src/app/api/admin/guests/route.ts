import { listGuests, putGuest, removeGuest } from "@/server/access";
import { attempt, badRequest, jsonBody } from "@/server/http";
import { guard } from "@/server/session";

// The guest list for the admin page (WEB-18). Admin only (WEB-06).

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
  return attempt(() => putGuest(caller.db, battleTag, mayUpload, caller.battleTag));
}

/** Removes a guest: `{ battleTag }`. */
export async function DELETE(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  const body = await jsonBody(req);
  if (typeof body?.battleTag !== "string") return badRequest("Send { battleTag }.");
  const { battleTag } = body;
  return attempt(() => ({ removed: removeGuest(caller.db, battleTag) }));
}
