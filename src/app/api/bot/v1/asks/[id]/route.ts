import { nowSeconds } from "@/app/clock";
import { refusal, runIdParam } from "@/server/botRuns";
import { askPayload, getRun } from "@/server/runs";
import { botGuard } from "@/server/session";

// One ask through the bot (WEB-51).

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const id = runIdParam((await params).id);
  const ask = id === undefined ? undefined : getRun(db, id, "ask");
  if (ask === undefined) return refusal("unknown_run");
  return Response.json({ ask: askPayload(db, ask, now) }, { headers: { "Cache-Control": "no-store" } });
}
