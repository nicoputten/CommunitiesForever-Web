import { nowSeconds } from "@/app/clock";
import { refusalText, runIdParam } from "@/server/botRuns";
import { badRequest, jsonBody } from "@/server/http";
import { answerRunFor } from "@/server/runs";
import { guard } from "@/server/session";

// POST { answer, guid? }: the signed-in friend answers a run on the site (WEB-40, the Runs pages). A fetch rather than
// a form, so the phone can keep an answer that didn't go through and send it again (runs-phone board).

const ANSWERS = ["in", "maybe", "cant"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const caller = await guard(req);
  if (caller instanceof Response) return caller;
  const id = runIdParam((await params).id);
  const body = await jsonBody(req);
  const answer = ANSWERS.find((a) => a === body?.answer);
  if (id === undefined || answer === undefined) return badRequest("Send { answer, guid }.");
  const request = {
    battleTag: caller.battleTag,
    answer,
    source: "website" as const,
    ...(typeof body?.guid === "string" ? { guid: body.guid } : {}),
  };
  const outcome = answerRunFor(caller.db, id, request, nowSeconds());
  if (typeof outcome === "string") {
    const [status, text] = refusalText(outcome);
    return Response.json({ error: text }, { status });
  }
  return Response.json({
    stored: { answer: outcome.stored.answer, waitlisted: outcome.stored.waitlisted === true },
  });
}
