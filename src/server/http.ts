import { AccessError } from "./access";

// Small helpers for the JSON route handlers.

/** The request's JSON body as an object; undefined when it is not one. */
export async function jsonBody(req: Request): Promise<Record<string, unknown> | undefined> {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

/** Runs an admin action; an AccessError (not a BattleTag, the admin can't be blocked) becomes a 400. */
export function attempt(action: () => unknown): Response {
  try {
    return Response.json(action() ?? { ok: true });
  } catch (e) {
    if (e instanceof AccessError) return badRequest(e.message);
    throw e;
  }
}
