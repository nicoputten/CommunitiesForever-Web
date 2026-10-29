import { battleTagKey } from "@/core/access";
import { block, listBlocks, listMembers, unblock } from "@/server/access";
import { logChange } from "@/server/admins";
import { nowSeconds } from "@/app/clock";
import { attempt, badRequest, jsonBody } from "@/server/http";
import { guard } from "@/server/session";

// Members and blocks for the admin page (WEB-18). The owner and admins (WEB-06, WEB-64); a real change goes in the
// admin changes log, a repeat doesn't.

/** Members (with whether they are blocked) and every block. */
export async function GET(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  return Response.json({ members: listMembers(caller.db), blocks: listBlocks(caller.db) });
}

/** Blocks a BattleTag: `{ battleTag }`. The owner and admins can't be blocked (400). */
export async function PUT(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  const body = await jsonBody(req);
  if (typeof body?.battleTag !== "string") return badRequest("Send { battleTag }.");
  const { battleTag } = body;
  return attempt(() => {
    const now = nowSeconds();
    const was = listBlocks(caller.db).some((b) => battleTagKey(b.battleTag) === battleTagKey(battleTag));
    const done = block(caller.db, battleTag, caller.battleTag, now);
    if (!was) logChange(caller.db, caller.battleTag, "blocked", now, done.battleTag);
    return done;
  });
}

/** Lifts a block: `{ battleTag }`. */
export async function DELETE(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  const body = await jsonBody(req);
  if (typeof body?.battleTag !== "string") return badRequest("Send { battleTag }.");
  const { battleTag } = body;
  return attempt(() => {
    const unblocked = unblock(caller.db, battleTag);
    if (unblocked) logChange(caller.db, caller.battleTag, "unblocked", nowSeconds(), battleTag);
    return { unblocked };
  });
}
