import { nowSeconds } from "@/app/clock";
import { parseGuildReport } from "@/core/guild";
import { saveGuildReport } from "@/server/guild";
import { jsonBody } from "@/server/http";
import { apiError, botGuard } from "@/server/session";

// POST { channels, roles }: the bot reports its Discord server's text channels it may post in and the roles it may
// mention (WEB-46, docs/BOT-API.md "Guild"), when it connects and when they change. Each report replaces the last;
// the Discord page's dropdowns offer them.

export async function POST(req: Request): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const report = parseGuildReport(await jsonBody(req));
  if (typeof report === "string") return apiError(400, "invalid_request", report);
  saveGuildReport(db, report, now);
  return Response.json(
    { channels: report.channels.length, roles: report.roles.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
