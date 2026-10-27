import { nowSeconds } from "@/app/clock";
import { botFriend, refusal, runIdParam } from "@/server/botRuns";
import { jsonBody } from "@/server/http";
import { answerRunFor, getRun, runPayload } from "@/server/runs";
import { apiError, botGuard } from "@/server/session";

// POST { discordUserId, answer, guid? }: a friend answers in Discord (WEB-40, the post's buttons). I'm in needs one of
// their characters in range; on a full role it is kept as Maybe, first in line (`stored.waitlisted`).

const ANSWERS = ["in", "maybe", "cant"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const body = (await jsonBody(req)) ?? {};
  const friend = botFriend(db, body.discordUserId);
  if (friend instanceof Response) return friend;
  const id = runIdParam((await params).id);
  if (id === undefined) return refusal("unknown_run");
  const answer = ANSWERS.find((a) => a === body.answer);
  if (answer === undefined) return apiError(400, "invalid_request", "answer is in, maybe or cant.");
  const request = {
    battleTag: friend.battleTag,
    answer,
    source: "discord" as const,
    ...(typeof body.guid === "string" ? { guid: body.guid } : {}),
  };
  const outcome = answerRunFor(db, id, request, now);
  if (typeof outcome === "string") return refusal(outcome);
  return Response.json({
    stored: {
      answer: outcome.stored.answer,
      role: outcome.stored.role,
      waitlisted: outcome.stored.waitlisted === true,
    },
    run: runPayload(db, getRun(db, id)!, now),
  });
}
