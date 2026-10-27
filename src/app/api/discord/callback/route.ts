import { cookies } from "next/headers";
import { nowSeconds } from "@/app/clock";
import { guard } from "@/server/session";
import { discordApp } from "@/server/discord";
import { discordCallback, LINK_COOKIE } from "@/server/discordLink";

// Discord's redirect after "Link Discord" (WEB-39): needs the session (src/proxy.ts, guard), then always goes back to
// the Discord page with a notice. The state cookie is used once.

export async function GET(req: Request): Promise<Response> {
  const caller = await guard(req);
  if (caller instanceof Response) return caller;
  const jar = await cookies();
  const cookie = jar.get(LINK_COOKIE)?.value;
  jar.delete({ name: LINK_COOKIE, path: "/api/discord/callback" });
  const notice = await discordCallback({
    db: caller.db,
    app: discordApp(),
    battleTag: caller.battleTag,
    params: new URL(req.url).searchParams,
    cookie,
    now: nowSeconds(),
  });
  return new Response(null, {
    status: 303,
    headers: { Location: `/discord?notice=${notice}`, "Cache-Control": "no-store" },
  });
}
