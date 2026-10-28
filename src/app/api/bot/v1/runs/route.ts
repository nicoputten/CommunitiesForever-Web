import { nowSeconds } from "@/app/clock";
import { botFriend, refusal, startTime, upcomingRuns } from "@/server/botRuns";
import { jsonBody } from "@/server/http";
import { getRun, planRunFor, runPayload } from "@/server/runs";
import { apiError, botGuard } from "@/server/session";

// Runs through the bot (WEB-40, docs/BOT-API.md "Run actions"). GET: upcoming runs (`/runs`). POST: plan one (`/plan`)
// for a linked Discord user.

export const dynamic = "force-dynamic";

export function GET(req: Request): Response {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  return Response.json({ runs: upcomingRuns(db, now) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const body = (await jsonBody(req)) ?? {};
  const friend = botFriend(db, body.discordUserId);
  if (friend instanceof Response) return friend;
  if (typeof body.dungeonId !== "string") return apiError(400, "invalid_request", "Send dungeonId.");
  const startsAt = startTime(body, friend.timeZone, now);
  if (startsAt === undefined) return apiError(400, "invalid_time", "Send startsAt, or date and time in your zone.");
  const planned = planRunFor(
    db,
    {
      dungeonId: body.dungeonId,
      startsAt,
      note: body.note,
      organiser: friend.battleTag,
      source: "discord",
      ...(typeof body.leadGuid === "string" ? { leadGuid: body.leadGuid } : {}),
    },
    now,
  );
  if (typeof planned === "string") return refusal(planned);
  return Response.json({ run: runPayload(db, getRun(db, planned.id)!, now) }, { status: 201 });
}
