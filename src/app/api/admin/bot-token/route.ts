import { nowSeconds } from "@/app/clock";
import { createBotToken, revokeBotToken } from "@/server/bot";
import { guard } from "@/server/session";

// The Discord bot's token (WEB-38, docs/BOT-API.md "Token"). Admin only. Until WEB-39's Discord page, the admin calls
// it from the browser console on the site: `await (await fetch("/api/admin/bot-token", { method: "POST" })).json()`.

/** Makes a new bot token and answers it once (`{ token }`); the one before stops working. */
export async function POST(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  const token = createBotToken(caller.db, caller.battleTag, nowSeconds());
  return Response.json({ token }, { headers: { "Cache-Control": "no-store" } });
}

/** Revokes the bot token: `{ revoked }` is false when there was none. */
export async function DELETE(req: Request): Promise<Response> {
  const caller = await guard(req, "admin");
  if (caller instanceof Response) return caller;
  return Response.json({ revoked: revokeBotToken(caller.db, nowSeconds()) });
}
