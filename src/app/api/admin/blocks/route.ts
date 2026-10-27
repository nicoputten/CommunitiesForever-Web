import { block, listBlocks, listMembers, unblock } from "@/server/access";
import { nowSeconds } from "@/app/clock";
import { attempt, badRequest, jsonBody } from "@/server/http";
import { guard } from "@/server/session";

// Members and blocks for the admin page (WEB-18). Admin only (WEB-06).

/** Members (with whether they are blocked) and every block. */
export async function GET(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  return Response.json({ members: listMembers(caller.db), blocks: listBlocks(caller.db) });
}

/** Blocks a BattleTag: `{ battleTag }`. The admin can't be blocked (400). */
export async function PUT(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  const body = await jsonBody(req);
  if (typeof body?.battleTag !== "string") return badRequest("Send { battleTag }.");
  const { battleTag } = body;
  return attempt(() => block(caller.db, battleTag, caller.battleTag, nowSeconds()));
}

/** Lifts a block: `{ battleTag }`. */
export async function DELETE(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  const body = await jsonBody(req);
  if (typeof body?.battleTag !== "string") return badRequest("Send { battleTag }.");
  const { battleTag } = body;
  return attempt(() => ({ unblocked: unblock(caller.db, battleTag) }));
}
