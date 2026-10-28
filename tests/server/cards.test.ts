import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as cardRoute } from "@/app/api/bot/v1/cards/[file]/route";
import { createBotToken } from "@/server/bot";
import { getDb } from "@/server/db";
import { botEvents } from "@/server/db/schema";
import { runDueRecap } from "@/server/recap";
import { upload } from "@/server/uploads";
import { type CardSpec, milestoneCard, recapHeader, whereisCard, zoneCard } from "@/core/cards/models";
import { renderCard } from "@/server/cards/render";

// WEB-41d: every card kind renders to a PNG of its size with the bundled fonts. CARDS_OUT=<dir> writes them out to
// look at next to design/cards/.

const NOW = Date.parse("2026-10-28T20:00:00Z") / 1000;
const H = 3600;
const HOST = "wow.example.test";
const mira = {
  name: "Mira Sunstrider",
  classFile: "MAGE",
  classLabel: "Mage",
  race: "Undead",
  spec: "Frost",
  owner: "Mira",
};
const char = (classFile: string, name: string) => ({ guid: "G", name, classFile, level: 60, ownerName: "Mira" });

const SPECS: Record<string, CardSpec> = {
  "level-60": milestoneCard(
    { kind: "maxLevel", character: char("MAGE", "Mira Sunstrider"), level: 60, from: 59 },
    mira,
    HOST,
  )!,
  "new-character-60": milestoneCard(
    { kind: "newCharacter", character: char("HUNTER", "Thorn Blackmane") },
    { name: "Thorn Blackmane", classFile: "HUNTER", classLabel: "Hunter", race: "Orc", spec: "Beast Mastery" },
    HOST,
  )!,
  "profession-300": milestoneCard(
    {
      kind: "professionCap",
      character: char("PRIEST", "Lia Thornwhisper"),
      skillLine: "197",
      profession: "Tailoring",
      rank: 300,
    },
    { name: "Lia Thornwhisper", classFile: "PRIEST", classLabel: "Priest", race: "Troll", owner: "Femke" },
    HOST,
  )!,
  "recap-header-award": recapHeader(
    {
      dates: "20–26 Oct",
      headline: "The week Mira hit 60",
      award: { title: "Doombringers of the week", friend: "Femke", amount: "6 levels", classFile: "PRIEST" },
    },
    HOST,
  ),
  "recap-header-zone": recapHeader(
    { dates: "20–26 Oct", headline: "A quiet week", zone: { name: "Stranglethorn Vale", friends: 5 } },
    HOST,
  ),
  "recap-header-headline": recapHeader({ dates: "20–26 Oct", headline: "A quiet week in Azeroth" }, HOST),
  "zone-of-the-week": zoneCard("Hillsbrad Foothills", 4, HOST)!,
  whereis: whereisCard(
    { name: "Bob Example", classFile: "ROGUE" },
    [
      { zone: "Stranglethorn Vale", seenAt: NOW - 2 * H },
      { zone: "Duskwood", seenAt: NOW - 30 * H },
      { zone: "Westfall", seenAt: NOW - 9 * 24 * H },
    ],
    NOW,
    HOST,
  )!,
};

describe("card images", () => {
  it.each(Object.entries(SPECS))(
    "%s renders a PNG of its size",
    async (name, spec) => {
      expect(spec).toBeDefined();
      const res = await renderCard(spec);
      expect(res.headers.get("content-type")).toBe("image/png");
      const png = Buffer.from(await res.arrayBuffer());
      expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      expect([width, height]).toEqual(name.startsWith("recap-header") ? [1200, 400] : [800, 400]);
      if (process.env.CARDS_OUT) {
        mkdirSync(process.env.CARDS_OUT, { recursive: true });
        writeFileSync(path.join(process.env.CARDS_OUT, `${name}.png`), png);
      }
    },
    30_000,
  );
});

describe("GET cards/<id>.png", () => {
  const ADMIN = "Nico#1000";
  const t = (iso: string) => Date.parse(iso) / 1000;
  const file = (level: number, at: number) =>
    new TextEncoder().encode(`return { schemaVersion = 1,
      self = { battleTag = "${ADMIN}", displayName = "Nico", version = ${at},
        chars = { ["G-V"] = { name = "Ves Example", classFile = "WARLOCK", raceID = 5, level = ${level}, updatedAt = ${at} } } },
      locations = { ["G-V"] = { zone = "Duskwood", seenAt = ${at} } },
      settings = { clubId = 7, clubName = "Friends" },
    }`);
  let dir: string;
  let token: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
    process.env.DATA_DIR = dir;
    process.env.ADMIN_BATTLETAG = ADMIN;
    process.env.AUTH_URL = "https://wow.example.test";
    token = createBotToken(getDb(), ADMIN, 1);
    const db = getDb();
    runDueRecap(db, t("2026-10-28T12:00:00Z"), "Friends");
    upload(db, file(58, t("2026-10-29T20:00:00Z")), ADMIN, t("2026-10-29T21:00:00Z"), ADMIN);
    upload(db, file(60, t("2026-10-31T20:00:00Z")), ADMIN, t("2026-10-31T21:00:00Z"), ADMIN);
    runDueRecap(db, t("2026-11-01T13:01:00Z"), "Friends");
  });

  afterAll(() => {
    getDb().$client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const get = (name: string, auth = token) =>
    cardRoute(
      new Request(`http://localhost/api/bot/v1/cards/${name}`, {
        headers: auth ? { authorization: `Bearer ${auth}` } : {},
      }),
      { params: Promise.resolve({ file: name }) },
    );

  it("needs the bot token", async () => {
    expect((await get("recap-1-header.png", "")).status).toBe(401);
  });

  it("draws the recap header, a milestone at 60 and /whereis; 404 for anything else", async () => {
    const header = await get("recap-1-header.png");
    expect([header.status, header.headers.get("content-type")]).toEqual([200, "image/png"]);
    const event = getDb()
      .select()
      .from(botEvents)
      .all()
      .find((e) => e.type === "milestones")!;
    expect((await get(`milestone-${event.id}-0.png`)).status).toBe(200);
    expect((await get("whereis-G-V.png")).status).toBe(200);
    for (const missing of [
      "recap-1-zone.png",
      "recap-9-header.png",
      "whereis-nobody.png",
      "milestone-999-0.png",
      "../x.png",
      "recap-1-header",
    ]) {
      expect((await get(missing)).status, missing).toBe(404);
    }
  }, 60_000);
});
