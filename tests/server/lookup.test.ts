import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as lookupRoute } from "@/app/api/bot/v1/lookup/[what]/route";
import { block, putGuest } from "@/server/access";
import { createBotToken } from "@/server/bot";
import { getDb } from "@/server/db";
import { linkDiscord } from "@/server/discord";
import { upload } from "@/server/uploads";

// WEB-39b: the bot's look-ups, only for a linked friend; names only, never BattleTags. Made-up names (rule 7).

const ADMIN = "Nico#1000";
const NOW = Math.floor(Date.now() / 1000);
const NICO_DISCORD = "100000000000000011";
const ADA_DISCORD = "100000000000000012";
const STRANGER = "100000000000000013";
const day = Math.floor(NOW / 86400);

const file = new TextEncoder().encode(`return { schemaVersion = 1,
  self = { battleTag = "${ADMIN}", displayName = "Nico", version = ${NOW},
    chars = {
      ["G-V"] = { name = "Ves Doombringer", classFile = "WARLOCK", raceID = 5, level = 39, updatedAt = ${NOW}, mainTree = 3,
        role = "dps", ilvl = 34, talents = { { name = "Affliction", points = 10 }, { name = "Demonology", points = 0 }, { name = "Destruction", points = 20 } },
        professions = { [197] = { name = "Tailoring", rank = 187, max = 225 } } },
      ["G-L"] = { name = "Lia Thornwhisper", classFile = "PRIEST", raceID = 8, level = 37, updatedAt = ${NOW}, role = "heal",
        professions = { [197] = { name = "Tailoring", rank = 205, max = 225 } } },
    },
    feed = { [${day}] = { ["G-V"] = { at = ${NOW - 600}, levelFrom = 37, levelTo = 39, quests = { ["Duskwood"] = 4 },
      runs = { { name = "Shadowfang Keep", kind = "party", with = {} } } } } } },
  people = { ["Ada#1001"] = { version = 1, displayName = "Ada", chars = { ["G-A"] = { name = "Ada Example", classFile = "MAGE", level = 60, updatedAt = 1,
    professions = { [197] = { name = "Tailoring", rank = 300, max = 300 } } } } } },
  locations = { ["G-V"] = { zone = "Duskwood", seenAt = ${NOW - 3600} }, ["G-A"] = { zone = "Orgrimmar", seenAt = ${NOW - 7200} } },
  settings = { clubId = 7, clubName = "Friends" },
}`);

let dir: string;
let token: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  process.env.DATA_DIR = dir;
  process.env.ADMIN_BATTLETAG = ADMIN;
  const db = getDb();
  token = createBotToken(db, ADMIN, 1);
  expect(upload(db, file, ADMIN, NOW, ADMIN).status).toBe("ok");
  linkDiscord(db, ADMIN, { id: NICO_DISCORD, name: "nico_example" }, 1);
  linkDiscord(db, "Ada#1001", { id: ADA_DISCORD, name: "ada_example" }, 1);
});

afterAll(() => {
  getDb().$client.close();
  rmSync(dir, { recursive: true, force: true });
});

async function get(what: string, query: Record<string, string>, auth = token) {
  const url = `http://localhost/api/bot/v1/lookup/${what}?${new URLSearchParams(query).toString()}`;
  const res = await lookupRoute(new Request(url, { headers: auth ? { authorization: `Bearer ${auth}` } : {} }), {
    params: Promise.resolve({ what }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("look-ups", () => {
  it("need the bot token and a linked friend on the list", async () => {
    expect((await get("names", { discordUserId: NICO_DISCORD }, "")).status).toBe(401);
    expect(await get("names", { discordUserId: STRANGER })).toMatchObject({
      status: 403,
      body: { error: "not_linked" },
    });
    expect((await get("names", {})).status).toBe(400);
    // A blocked friend's link no longer counts.
    putGuest(getDb(), "Gus#3003", false, ADMIN, 1);
    linkDiscord(getDb(), "Gus#3003", { id: "100000000000000014", name: "gus" }, 1);
    block(getDb(), "Gus#3003", ADMIN, 2);
    expect((await get("names", { discordUserId: "100000000000000014" })).status).toBe(403);
  });

  it("autocomplete friends by display name and characters with their GUID", async () => {
    const { body } = await get("names", { discordUserId: NICO_DISCORD, q: "a" });
    expect(body.names).toEqual([
      { kind: "friend", name: "Ada", value: "Ada" },
      { kind: "character", name: "Ada Example", value: "G-A" },
      { kind: "character", name: "Lia Thornwhisper", value: "G-L" },
    ]);
  });

  it("answer /whereis, /who, /whocancraft, /character, /alts and /me", async () => {
    const whereis = (await get("whereis", { discordUserId: ADA_DISCORD, friend: "nico" })).body;
    expect(whereis).toMatchObject({ friend: "Nico", card: "G-V" });
    expect(
      (whereis.characters as { name: string; seen?: { zone: string } }[]).map((c) => [c.name, c.seen?.zone]),
    ).toEqual([
      ["Ves Doombringer", "Duskwood"],
      ["Lia Thornwhisper", undefined],
    ]);

    const healers = (await get("who", { discordUserId: ADA_DISCORD, level: "30-40", role: "healer" })).body;
    expect(healers).toMatchObject({
      total: 1,
      characters: [{ name: "Lia Thornwhisper", owner: "Nico", role: "heal" }],
    });
    expect((await get("who", { discordUserId: ADA_DISCORD, recent: "true" })).body.total).toBe(2);

    const tailors = (await get("whocancraft", { discordUserId: ADA_DISCORD, profession: "tailoring" })).body;
    expect(
      (tailors.crafters as { name: string; rank: number; best: boolean }[]).map((c) => [c.name, c.rank, c.best]),
    ).toEqual([
      ["Ada Example", 300, true],
      ["Lia Thornwhisper", 205, false],
      ["Ves Doombringer", 187, false],
    ]);

    const ves = (await get("character", { discordUserId: ADA_DISCORD, name: "ves doombringer" })).body;
    expect(ves.character).toMatchObject({
      name: "Ves Doombringer",
      race: "Undead",
      spec: "Destruction",
      ilvl: 34,
      talents: [10, 0, 20],
    });

    expect((await get("alts", { discordUserId: ADA_DISCORD, friend: "Ada" })).body).toMatchObject({
      friend: "Ada",
      characters: [{ name: "Ada Example" }],
    });

    const me = (await get("me", { discordUserId: NICO_DISCORD })).body;
    expect(me).toMatchObject({ asker: "Nico", friend: "Nico", week: { levels: 2, quests: 4, runs: 1 } });
    expect(whereis.asker).toBe("Ada");
    expect((me.characters as unknown[]).length).toBe(2);
    // Ada shares no feed: no week line.
    expect((await get("me", { discordUserId: ADA_DISCORD })).body).not.toHaveProperty("week");

    expect((await get("character", { discordUserId: ADA_DISCORD, name: "Nobody" })).status).toBe(404);
    expect((await get("teleport", { discordUserId: ADA_DISCORD })).status).toBe(404);
  });

  it("never answers a BattleTag", async () => {
    for (const what of ["names", "whereis", "who", "character", "alts", "me"]) {
      const { body } = await get(what, { discordUserId: ADA_DISCORD, q: "", friend: "Nico", name: "Ves Doombringer" });
      expect(JSON.stringify(body), what).not.toContain("#1");
    }
  });
});
