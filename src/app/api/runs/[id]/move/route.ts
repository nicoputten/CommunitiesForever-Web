import { nowSeconds } from "@/app/clock";
import { mayAdmin } from "@/core/access";
import { adminBattleTag, loadAccessList } from "@/server/access";
import { moveParam, refusalText, runIdParam } from "@/server/botRuns";
import { badRequest, jsonBody } from "@/server/http";
import { moveRunSignUp } from "@/server/runs";
import { guard } from "@/server/session";

// POST { characterId, to }: the organiser (or the admin) moves a sign-up to another role (`tank`, `healer`, `damage`),
// to `reserve`, or `remove`s it (WEB-47). The moved friend gets a quiet Discord notice. WEB-49 adds the menu for it.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const caller = await guard(req);
  if (caller instanceof Response) return caller;
  const id = runIdParam((await params).id);
  const body = await jsonBody(req);
  const to = moveParam(body?.to);
  if (id === undefined || to === undefined || typeof body?.characterId !== "string") {
    return badRequest("Send { characterId, to }.");
  }
  const isAdmin = mayAdmin(caller.battleTag, loadAccessList(caller.db, adminBattleTag()));
  const moved = moveRunSignUp(caller.db, id, caller.battleTag, isAdmin, body.characterId, to, nowSeconds());
  if (typeof moved === "string") {
    const [status, text] = refusalText(moved);
    return Response.json({ error: text }, { status });
  }
  return Response.json({ ok: true });
}
