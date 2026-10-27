import { nowSeconds } from "@/app/clock";
import { botFriend, moveParam, refusal, runIdParam } from "@/server/botRuns";
import { jsonBody } from "@/server/http";
import { moveRunSignUp, runPayload } from "@/server/runs";
import { apiError, botGuard } from "@/server/session";

// POST { discordUserId, characterId, to }: the organiser (or the admin) moves a sign-up from Discord (WEB-47): to another
// role, to `reserve`, or `remove`. The moved friend gets a quiet notice (`runMoved`).

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const body = (await jsonBody(req)) ?? {};
  const friend = botFriend(db, body.discordUserId);
  if (friend instanceof Response) return friend;
  const id = runIdParam((await params).id);
  if (id === undefined) return refusal("unknown_run");
  const to = moveParam(body.to);
  if (to === undefined || typeof body.characterId !== "string") {
    return apiError(400, "invalid_request", "Send characterId and to (tank, healer, damage, reserve or remove).");
  }
  const moved = moveRunSignUp(db, id, friend.battleTag, friend.isAdmin, body.characterId, to, now);
  if (typeof moved === "string") return refusal(moved);
  return Response.json({ run: runPayload(db, moved, now) });
}
