import { nowSeconds } from "@/app/clock";
import { cardFor } from "@/server/cards";
import { renderCard } from "@/server/cards/render";
import { apiError, botGuard } from "@/server/session";

// GET cards/<id>.png: a card image for the bot to attach to its post (WEB-41d, docs/BOT-API.md "Card images"):
// the recap headers, the Zone of the week map, milestone cards and /whereis. The bot token only, like every bot
// route; 404 for an id the site can't draw.

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const { file } = await params;
  const id = /^(.+)\.png$/.exec(file)?.[1];
  const spec = id === undefined ? undefined : cardFor(db, id, now);
  if (spec === undefined) return apiError(404, "not_found", "No such card.");
  return renderCard(spec);
}
