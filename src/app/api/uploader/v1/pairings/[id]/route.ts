import { nowSeconds } from "@/app/clock";
import { getDb } from "@/server/db";
import { apiError } from "@/server/session";
import { limits, pollPairing } from "@/server/uploader";
import { siteName } from "@/server/uploaderHttp";

// GET: the app polls its pairing (WEB-33, docs/UPLOADER-API.md "Pairing"). Open: the unguessable id is the secret.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const now = nowSeconds();
  const wait = limits.poll.hit(id, now);
  if (wait !== undefined) return apiError(429, "rate_limited", "Poll less often.", { "Retry-After": String(wait) });
  const poll = pollPairing(getDb(), id, now);
  switch (poll.status) {
    case "pending":
      return Response.json(poll, { status: 202 });
    case "approved":
      return Response.json({ ...poll, siteName: siteName() });
    case "denied":
      return Response.json(poll, { status: 403 });
    case "expired":
      return Response.json(poll, { status: 410 });
  }
}
