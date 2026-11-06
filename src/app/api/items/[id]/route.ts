import { getDb } from "@/server/db";
import { tooltipItems } from "@/server/recipeViews";
import { guard } from "@/server/session";

// GET /api/items/<id>: one item's tooltip data from the item database (WEB-92, handoff C1), for an item tooltip whose
// page didn't send it (the Professions page's search). Signed-in viewers only (CLAUDE.md rule 6). No sell price.

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const caller = await guard(req);
  if (caller instanceof Response) return caller;
  const raw = (await params).id;
  if (!/^\d{1,9}$/.test(raw)) return Response.json({ error: "not found" }, { status: 404 });
  const item = tooltipItems(getDb(), [Number(raw)])[0];
  if (item === undefined) return Response.json({ error: "not found" }, { status: 404 });
  // The item data changes once per patch: a day in the browser is plenty.
  return Response.json(item, { headers: { "cache-control": "private, max-age=86400" } });
}
