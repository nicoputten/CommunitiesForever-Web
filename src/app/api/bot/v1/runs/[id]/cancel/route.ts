import { nowSeconds } from "@/app/clock";
import { botFriend, refusal, runIdParam } from "@/server/botRuns";
import { jsonBody } from "@/server/http";
import { cancelRun, runPayload } from "@/server/runs";
import { botGuard } from "@/server/session";

// POST: delete (cancel) a run through the bot (WEB-40, `/run cancel`): its organiser, or the admin any run.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const friend = botFriend(db, (await jsonBody(req))?.discordUserId);
  if (friend instanceof Response) return friend;
  const id = runIdParam((await params).id);
  if (id === undefined) return refusal("unknown_run");
  const cancelled = cancelRun(db, id, friend.battleTag, friend.isAdmin, now);
  if (typeof cancelled === "string") return refusal(cancelled);
  return Response.json({ run: runPayload(db, cancelled, now) });
}
