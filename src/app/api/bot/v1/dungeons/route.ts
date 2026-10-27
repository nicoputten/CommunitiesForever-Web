import { nowSeconds } from "@/app/clock";
import { dungeonList } from "@/server/botRuns";
import { botGuard } from "@/server/session";

// GET: the dungeons a run can be planned for, Scarlet Monastery as its four wings (WEB-40; `/plan` autocomplete).

export function GET(req: Request): Response {
  const db = botGuard(req, nowSeconds());
  if (db instanceof Response) return db;
  return Response.json({ dungeons: dungeonList() }, { headers: { "Cache-Control": "no-store" } });
}
