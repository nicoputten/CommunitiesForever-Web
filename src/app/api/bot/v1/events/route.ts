import { nowSeconds } from "@/app/clock";
import { parseCursor } from "@/core/bot";
import { longPoll, waitForEvents } from "@/server/bot";
import { apiError, botGuard } from "@/server/session";

// GET ?after=<cursor>: the event feed as a long poll (WEB-38, docs/BOT-API.md "Events"). Answers at once when there
// are events after the cursor that the bot hasn't acknowledged, otherwise holds until an upload makes some or about
// 30 s pass. The cursor to send next is in the answer.

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const db = botGuard(req, nowSeconds());
  if (db instanceof Response) return db;
  const after = parseCursor(new URL(req.url).searchParams.get("after"));
  if (after === undefined) return apiError(400, "invalid_cursor", "after must be the cursor of an earlier answer.");
  const events = await waitForEvents(db, after, nowSeconds, longPoll.seconds * 1000, req.signal);
  const cursor = String(events.at(-1)?.id ?? after);
  return Response.json({ events, cursor }, { headers: { "Cache-Control": "no-store" } });
}
