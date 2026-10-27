import { nowSeconds } from "@/app/clock";
import { parseMessageId } from "@/core/bot";
import { acknowledge } from "@/server/bot";
import { jsonBody } from "@/server/http";
import { apiError, botGuard } from "@/server/session";

// POST { messageId }: the bot posted an event (WEB-38, docs/BOT-API.md "Acknowledging"). From then on the event is
// never handed out again. The same acknowledgement again is fine; another message id for it is a conflict.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const { id } = await params;
  const eventId = /^\d{1,15}$/.test(id) ? Number(id) : undefined;
  const messageId = parseMessageId((await jsonBody(req))?.messageId);
  if (messageId === undefined)
    return apiError(400, "invalid_request", "Send { messageId } with the Discord message id.");
  const result = eventId === undefined ? "unknown" : acknowledge(db, eventId, messageId, now);
  switch (result) {
    case "ok":
      return Response.json({ id: eventId, messageId }, { headers: { "Cache-Control": "no-store" } });
    case "unknown":
      return apiError(404, "unknown_event", "No such event.");
    case "expired":
      return apiError(410, "expired", "The event is older than 7 days and was not posted.");
    case "conflict":
      return apiError(409, "already_posted", "The event was acknowledged with another message.");
  }
}
