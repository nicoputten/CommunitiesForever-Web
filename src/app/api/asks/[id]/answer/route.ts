import { nowSeconds } from "@/app/clock";
import { characterParam, refusalText, roleParam, runIdParam } from "@/server/botRuns";
import { badRequest, jsonBody } from "@/server/http";
import { answerAskFor } from "@/server/runs";
import { guard } from "@/server/session";

// POST { answer, characterId?, role? }: the signed-in friend answers an ask on the Runs page (WEB-51, "Asking now"),
// as a run is answered (the role per sign-up; no slots, so no reserve). After its 10 minutes: 409 "This ask has expired."

const ANSWERS = ["in", "maybe", "cant"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const caller = await guard(req);
  if (caller instanceof Response) return caller;
  const id = runIdParam((await params).id);
  const body = await jsonBody(req);
  const answer = ANSWERS.find((a) => a === body?.answer);
  const role = roleParam(body?.role);
  if (id === undefined || answer === undefined || role === null) {
    return badRequest("Send { answer, characterId, role }.");
  }
  const characterId = body === undefined ? undefined : characterParam(body);
  const request = {
    battleTag: caller.battleTag,
    answer,
    source: "website" as const,
    ...(characterId === undefined ? {} : { guid: characterId }),
    ...(role === undefined ? {} : { role }),
  };
  const outcome = answerAskFor(caller.db, id, request, nowSeconds());
  if (typeof outcome === "string") {
    const [status, text] = refusalText(outcome);
    return Response.json({ error: text }, { status });
  }
  return Response.json({
    stored: { answer: outcome.stored.answer, role: outcome.stored.role },
  });
}
