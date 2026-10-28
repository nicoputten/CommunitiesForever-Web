import { nowSeconds } from "@/app/clock";
import { botFriend, refusal, runIdParam, startTime } from "@/server/botRuns";
import { jsonBody } from "@/server/http";
import { editRun, getRun, runPayload } from "@/server/runs";
import { botGuard } from "@/server/session";

// One run through the bot (WEB-40). GET: the run. PATCH: the organiser changes day, time or note (`/run edit`).

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const id = runIdParam((await params).id);
  const run = id === undefined ? undefined : getRun(db, id);
  if (run === undefined) return refusal("unknown_run");
  return Response.json({ run: runPayload(db, run, now) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const body = (await jsonBody(req)) ?? {};
  const friend = botFriend(db, body.discordUserId);
  if (friend instanceof Response) return friend;
  const id = runIdParam((await params).id);
  if (id === undefined) return refusal("unknown_run");
  const startsAt = startTime(body, friend.timeZone, now);
  const change = {
    ...(startsAt === undefined ? {} : { startsAt }),
    ...("note" in body ? { note: body.note ?? "" } : {}),
  };
  const edited = editRun(db, id, friend.battleTag, change, now);
  if (typeof edited === "string") return refusal(edited);
  return Response.json({ run: runPayload(db, edited, now) });
}
