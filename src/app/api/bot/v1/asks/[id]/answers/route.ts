import { nowSeconds } from "@/app/clock";
import { botFriend, characterParam, refusal, roleParam, runIdParam } from "@/server/botRuns";
import { jsonBody } from "@/server/http";
import { answerAskFor, askPayload, getRun } from "@/server/runs";
import { apiError, botGuard } from "@/server/session";

// POST { discordUserId, answer, characterId?, role? }: a friend answers an ask in Discord (WEB-51), as a run's answer
// but without slots: I'm in is in. After the 10 minutes: 409 `expired`.

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
  const role = roleParam(body.role);
  if (role === null) return apiError(400, "invalid_request", "role is tank, healer or damage.");
  const characterId = characterParam(body);
  const outcome = answerAskFor(
    db,
    id,
    {
      battleTag: friend.battleTag,
      answer,
      source: "discord",
      ...(characterId === undefined ? {} : { guid: characterId }),
      ...(role === undefined ? {} : { role }),
    },
    now,
  );
  if (typeof outcome === "string") return refusal(outcome);
  return Response.json({
    stored: { answer: outcome.stored.answer, role: outcome.stored.role },
    ask: askPayload(db, getRun(db, id, "ask")!, now),
  });
}
