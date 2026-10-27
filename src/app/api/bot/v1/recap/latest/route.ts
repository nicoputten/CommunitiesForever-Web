import { nowSeconds } from "@/app/clock";
import { latestRecap, postedRecap } from "@/server/recap";
import { apiError, botGuard } from "@/server/session";

// GET: the last weekly recap, as it was posted (WEB-41c, docs/BOT-API.md "Recap"), for the bot's /recap command.
// 404 before the first recap.

export const dynamic = "force-dynamic";

export function GET(req: Request): Response {
  const db = botGuard(req, nowSeconds());
  if (db instanceof Response) return db;
  const latest = latestRecap(db);
  if (latest === undefined) return apiError(404, "no_recap", "There is no recap yet.");
  return Response.json(postedRecap(latest.data), { headers: { "Cache-Control": "no-store" } });
}
