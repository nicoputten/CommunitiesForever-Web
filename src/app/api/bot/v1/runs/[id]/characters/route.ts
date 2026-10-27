import { nowSeconds } from "@/app/clock";
import { botFriend, pickableCharacters, refusal, runIdParam } from "@/server/botRuns";
import { getRun } from "@/server/runs";
import { botGuard } from "@/server/session";

// GET ?discordUserId=: "Pick my character" (WEB-40): the friend's characters in the run's level range.

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const db = botGuard(req, nowSeconds());
  if (db instanceof Response) return db;
  const friend = botFriend(db, new URL(req.url).searchParams.get("discordUserId"));
  if (friend instanceof Response) return friend;
  const id = runIdParam((await params).id);
  const run = id === undefined ? undefined : getRun(db, id);
  if (run === undefined) return refusal("unknown_run");
  return Response.json(
    { characters: pickableCharacters(db, run, friend.battleTag) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
