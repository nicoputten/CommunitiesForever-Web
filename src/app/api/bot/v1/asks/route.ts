import { nowSeconds } from "@/app/clock";
import { botFriend, refusal, roleParam } from "@/server/botRuns";
import { jsonBody } from "@/server/http";
import { askFor, askPayload, getRun, openAsks } from "@/server/runs";
import { apiError, botGuard } from "@/server/session";

// Asks through the bot (WEB-51, docs/BOT-API.md "Asks"). GET: the open asks. POST: `/ask` for a linked Discord user,
// a run that starts now and takes answers for 10 minutes.

export const dynamic = "force-dynamic";

export function GET(req: Request): Response {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  return Response.json(
    { asks: openAsks(db, now).map((a) => askPayload(db, a, now)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const body = (await jsonBody(req)) ?? {};
  const friend = botFriend(db, body.discordUserId);
  if (friend instanceof Response) return friend;
  if (typeof body.dungeonId !== "string") return apiError(400, "invalid_request", "Send dungeonId.");
  const role = roleParam(body.role);
  if (role === null) return apiError(400, "invalid_request", "role is tank, healer or damage.");
  const asked = askFor(
    db,
    {
      dungeonId: body.dungeonId,
      note: body.note,
      organiser: friend.battleTag,
      source: "discord",
      ...(typeof body.leadGuid === "string" ? { leadGuid: body.leadGuid } : {}),
      ...(role === undefined ? {} : { leadRole: role }),
    },
    now,
  );
  if (typeof asked === "string") return refusal(asked);
  return Response.json({ ask: askPayload(db, getRun(db, asked.id, "ask")!, now) }, { status: 201 });
}
