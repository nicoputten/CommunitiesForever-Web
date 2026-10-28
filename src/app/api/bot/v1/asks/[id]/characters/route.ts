import { nowSeconds } from "@/app/clock";
import { botFriend, pickableCharacters, refusal, runIdParam } from "@/server/botRuns";
import { getRun } from "@/server/runs";
import { botGuard } from "@/server/session";

// GET ?discordUserId=: "Pick my character" on an ask (WEB-51): the friend's characters that may say I'm in.

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const db = botGuard(req, nowSeconds());
  if (db instanceof Response) return db;
  const friend = botFriend(db, new URL(req.url).searchParams.get("discordUserId"));
  if (friend instanceof Response) return friend;
  const id = runIdParam((await params).id);
  const ask = id === undefined ? undefined : getRun(db, id, "ask");
  if (ask === undefined) return refusal("unknown_run");
  return Response.json(
    { characters: pickableCharacters(db, ask, friend.battleTag) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
