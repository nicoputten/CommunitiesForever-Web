import { nowSeconds } from "@/app/clock";
import { EVENT_TTL_SECONDS, LONG_POLL_SECONDS } from "@/core/bot";
import { botGuard } from "@/server/session";
import { siteName } from "@/server/uploaderHttp";

// GET: what the bot needs to know about the site (WEB-38, docs/BOT-API.md "Settings"). WEB-39 adds the channels and
// the toggles per post type the admin sets on the Discord page.

export const dynamic = "force-dynamic";

export function GET(req: Request): Response {
  const db = botGuard(req, nowSeconds());
  if (db instanceof Response) return db;
  return Response.json(
    {
      apiVersion: 1,
      siteName: siteName(),
      longPollSeconds: LONG_POLL_SECONDS,
      eventTtlSeconds: EVENT_TTL_SECONDS,
      posts: { milestones: true },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
