import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { recordCharacters } from "@/core/views/characters";
import { searchEntries } from "@/core/views/recipes";
import { getDb } from "@/server/db";
import { recipeRows } from "@/server/recipeViews";
import { guard } from "@/server/session";

// GET /api/recipes/search: every recipe the live search on the Professions page looks through (WEB-92, handoff C3),
// loaded when the field is first used, so the page itself stays light. Signed-in viewers only (CLAUDE.md rule 6).

export async function GET(req: Request): Promise<Response> {
  const caller = await guard(req);
  if (caller instanceof Response) return caller;
  const data = getDataset();
  const now = nowSeconds();
  const characters = data === undefined ? [] : recordCharacters(data, now);
  const rows = recipeRows(getDb());
  return Response.json(searchEntries({ ...rows, characters, now }), { headers: { "cache-control": "no-store" } });
}
