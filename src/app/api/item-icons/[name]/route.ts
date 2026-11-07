import { iconName } from "@/core/recipes/icons";
import { getDb } from "@/server/db";
import { isKnownIcon, itemIcon } from "@/server/itemIcons";

// GET /api/item-icons/<icon name>: an item's icon, 56 px JPEG, from the site's own cache (WEB-90, src/server/itemIcons.ts).
// Open without a session (WEB-91, Nico 2026-11-07; CLAUDE.md rule 6): they are Blizzard's public icons, and Discord
// loads them for the bot's posts. Only names the item database holds are served (404 otherwise), so the open route
// can't make the server fetch arbitrary names; one the CDN lacks gets the game's question-mark icon.

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }): Promise<Response> {
  const name = iconName((await params).name.replace(/\.jpg$/, ""));
  if (name === undefined || !isKnownIcon(getDb(), name)) {
    return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  }
  const bytes = await itemIcon(name);
  if (bytes === undefined) return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/jpeg",
      // The same name is the same picture until a patch: anyone may cache it for a week.
      "cache-control": "public, max-age=604800",
    },
  });
}
