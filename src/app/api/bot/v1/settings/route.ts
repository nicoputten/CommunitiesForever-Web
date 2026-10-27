import { nowSeconds } from "@/app/clock";
import { EVENT_TTL_SECONDS, LONG_POLL_SECONDS } from "@/core/bot";
import { botApiSettings } from "@/server/discord";
import { botGuard } from "@/server/session";
import { siteName } from "@/server/uploaderHttp";

// GET: what the bot needs to know about the site (WEB-38, docs/BOT-API.md "Settings"), with what the admin sets on the
// Discord page (WEB-39): the toggles per post type, channels, the mention role, the recap time and the runs settings.

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
      ...botApiSettings(db),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
