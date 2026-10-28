import { nowSeconds } from "@/app/clock";
import { botFriend, planChoices } from "@/server/botRuns";
import { botGuard } from "@/server/session";

// GET ?discordUserId=: what `/plan` offers a linked Discord user (BOT-04): their time zone, the days in their own
// calendar, and per dungeon the character they would lead as.

export const dynamic = "force-dynamic";

export function GET(req: Request): Response {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const friend = botFriend(db, new URL(req.url).searchParams.get("discordUserId"));
  if (friend instanceof Response) return friend;
  return Response.json(planChoices(db, friend, now), { headers: { "Cache-Control": "no-store" } });
}
