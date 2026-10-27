import { nowSeconds } from "@/app/clock";
import {
  alts,
  findCharacter,
  friendByName,
  knownProfessions,
  lookupCharacter,
  names,
  who,
  whoCanCraft,
  whereisFriend,
} from "@/core/lookup";
import { botFriend } from "@/server/botRuns";
import { personKeyOf, weekOf } from "@/server/lookup";
import { apiError, botGuard } from "@/server/session";
import { loadState } from "@/server/uploads";

// GET lookup/<what>?discordUserId=…: the data of the bot's look-up commands (WEB-39b, docs/BOT-API.md "Look-ups"),
// only for a Discord user linked to someone on the list (else 403 `not_linked`, and the bot shows "Link your Discord
// first"). The bot formats it; texts are names only, never BattleTags.

export const dynamic = "force-dynamic";

const ROLES = { tank: "tank", healer: "heal", damage: "dps" } as const;
const json = (body: unknown) => Response.json(body, { headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, { params }: { params: Promise<{ what: string }> }): Promise<Response> {
  const now = nowSeconds();
  const db = botGuard(req, now);
  if (db instanceof Response) return db;
  const q = new URL(req.url).searchParams;
  const friend = botFriend(db, q.get("discordUserId") ?? undefined);
  if (friend instanceof Response) return friend;
  const { what } = await params;
  const d = loadState(db)?.data;
  if (d === undefined) return apiError(404, "no_data", "The site has no data yet.");
  const text = (name: string) => (q.get(name) ?? "").trim().slice(0, 100);

  switch (what) {
    case "names": {
      const kind = q.get("kind");
      return json({ names: names(d, text("q"), now, kind === "friend" || kind === "character" ? kind : "both") });
    }
    case "professions":
      return json({ professions: knownProfessions(d, now) });
    case "whereis": {
      if (text("character") !== "") {
        const c = findCharacter(d, text("character"), now);
        if (c === undefined) return apiError(404, "not_found", "No such character.");
        return json({ characters: [lookupCharacter(c)], ...(c.sighting !== undefined ? { card: c.guid } : {}) });
      }
      const f = friendByName(d, text("friend"), now);
      if (f === undefined) return apiError(404, "not_found", "No such friend.");
      return json({ friend: f.name, ...whereisFriend(d, f.key, now) });
    }
    case "who": {
      const level = /^(\d{1,2})(?:\s*-\s*(\d{1,2}))?$/.exec(text("level"));
      const role = text("role") as keyof typeof ROLES;
      const recent = q.get("recent") === "true";
      return json(
        who(
          d,
          {
            ...(level !== null ? { minLevel: Number(level[1]), maxLevel: Number(level[2] ?? level[1]) } : {}),
            ...(role in ROLES ? { role: ROLES[role] } : {}),
            ...(text("class") !== "" ? { classFile: text("class").toUpperCase() } : {}),
            ...(recent ? { seenWithin: 86400 } : {}),
          },
          now,
        ),
      );
    }
    case "whocancraft":
      if (text("profession") === "") return apiError(400, "invalid_request", "Send profession.");
      return json(whoCanCraft(d, text("profession"), now));
    case "character": {
      const c = findCharacter(d, text("name"), now);
      if (c === undefined) return apiError(404, "not_found", "No such character.");
      return json({ character: lookupCharacter(c) });
    }
    case "alts": {
      const f = friendByName(d, text("friend"), now);
      if (f === undefined) return apiError(404, "not_found", "No such friend.");
      return json({ friend: f.name, characters: alts(d, f.key, now) });
    }
    case "me": {
      const key = personKeyOf(d, friend.battleTag);
      const name = key !== undefined ? d.people[key]?.displayName : undefined;
      const week = key !== undefined ? weekOf(db, key, now) : undefined;
      return json({
        friend: name ?? "You",
        characters: key !== undefined ? alts(d, key, now) : [],
        ...(week !== undefined ? { week } : {}),
      });
    }
    default:
      return apiError(404, "not_found", "No such look-up.");
  }
}
