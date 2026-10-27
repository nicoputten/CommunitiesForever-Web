import { nowSeconds } from "@/app/clock";
import { botFriend, characterParam, refusal, roleParam, runIdParam } from "@/server/botRuns";
import { jsonBody } from "@/server/http";
import { answerRunFor, getRun, runPayload } from "@/server/runs";
import { apiError, botGuard } from "@/server/session";

// POST { discordUserId, answer, characterId?, role? }: a friend answers in Discord (WEB-40, the post's buttons). I'm in
// needs one of their characters that may join; the role is one its class can play (WEB-47). On a full role it is
// kept as reserve (`stored.reserve`; `waitlisted` too, for bots from before WEB-47).

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
  const request = {
    battleTag: friend.battleTag,
    answer,
    source: "discord" as const,
    ...(characterId === undefined ? {} : { guid: characterId }),
    ...(role === undefined ? {} : { role }),
  };
  const outcome = answerRunFor(db, id, request, now);
  if (typeof outcome === "string") return refusal(outcome);
  return Response.json({
    stored: {
      answer: outcome.stored.answer === "reserve" ? "maybe" : outcome.stored.answer,
      role: outcome.stored.role,
      reserve: outcome.stored.answer === "reserve",
      waitlisted: outcome.stored.answer === "reserve",
    },
    run: runPayload(db, getRun(db, id)!, now),
  });
}
