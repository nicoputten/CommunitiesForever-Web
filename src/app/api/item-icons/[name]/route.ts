import { guard } from "@/server/session";
import { itemIcon } from "@/server/itemIcons";

// GET /api/item-icons/<icon name>: an item's icon, 56 px JPEG, from the site's own cache (WEB-90, src/server/itemIcons.ts).
// Signed-in viewers only, like every route (CLAUDE.md rule 6). An unknown name gets the game's question-mark icon.

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }): Promise<Response> {
  const caller = await guard(req);
  if (caller instanceof Response) return caller;
  const raw = (await params).name.replace(/\.jpg$/, "");
  const bytes = await itemIcon(raw);
  if (bytes === undefined) return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/jpeg",
      // The same name is the same picture until a patch: cache it in the browser for a week.
      "cache-control": "private, max-age=604800",
    },
  });
}
