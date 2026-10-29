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
import type { Milestone } from "@/core/bot";
import {
  boardCard,
  type CardSpec,
  cardSize,
  featCard,
  milestoneCard,
  recapHeader,
  stripCard,
  whereisCard,
  zoneCard,
} from "@/core/cards/models";
import type { BoardData } from "@/core/doomsday/posts";
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
// A Wednesday 19:00 Paris board with five friends (made-up names).
const BOARD_START = Date.parse("2026-10-28T18:00:00Z") / 1000;
const BOARD: BoardData = {
  day: 20754,
  week: 2965,
  label: "Wed evening",
  span: "Wed 19:00 → Thu 19:00",
  start: BOARD_START,
  end: BOARD_START + 86400,
  goals: [
    { slot: "pve1", id: "d.level", title: "Gain a level", track: "pve", points: 5, shortLabel: "Level" },
    {
      slot: "pve2",
      id: "d.shared3",
      title: "Share 3 quests with a friend",
      track: "pve",
      points: 5,
      shortLabel: "3 shared",
    },
    {
      slot: "pve3",
      id: "d.skill5",
      title: "Earn 5 profession skill points",
      track: "pve",
      points: 5,
      shortLabel: "Skills",
    },
    { slot: "hunt", id: "hunt", title: "The Hunt: Night Elf Druid", track: "pvp", points: 5, shortLabel: "Hunt" },
    {
      slot: "skirmish",
      id: "p.loneWolf",
      title: "Lone wolf: 3 solo kills",
      track: "pvp",
      points: 5,
      shortLabel: "Lone wolf",
    },
  ],
  friends: [
    {
      name: "Mira",
      goals: ["pve1", "pve2", "pve3", "hunt"].map((slot) => ({ slot, id: "x", done: true })),
      doneCount: 4,
      goalCount: 6,
      crossedOut: true,
      today: { pve: 15, pvp: 11 },
      week: { pve: 40, pvp: 20 },
      streak: 4,
      best: 6,
      pvpVirgin: false,
    },
    {
      name: "Tok",
      goals: ["pve1", "pve2", "pve3"].map((slot) => ({ slot, id: "x", done: true })),
      doneCount: 3,
      goalCount: 6,
      crossedOut: true,
      today: { pve: 15, pvp: null },
      week: { pve: 30, pvp: null },
      streak: 7,
      best: 7,
      pvpVirgin: true,
    },
    {
      name: "Ada",
      goals: ["pve1", "pve2", "skirmish"].map((slot) => ({ slot, id: "x", done: true })),
      doneCount: 3,
      goalCount: 6,
      crossedOut: false,
      today: { pve: 10, pvp: 3 },
      week: { pve: 20, pvp: 9 },
      streak: 3,
      best: 5,
      pvpVirgin: false,
    },
    {
      name: "Bob",
      goals: [{ slot: "pve1", id: "x", done: true }],
      doneCount: 1,
      goalCount: 6,
      crossedOut: false,
      today: { pve: 5, pvp: 1 },
      week: { pve: 5, pvp: 1 },
      streak: 1,
      best: 2,
      pvpVirgin: false,
    },
    {
      name: "Lia",
      goals: [],
      doneCount: 0,
      goalCount: 6,
      crossedOut: false,
      today: { pve: 0, pvp: 0 },
      week: { pve: 0, pvp: 0 },
      streak: 0,
      best: 3,
      pvpVirgin: false,
    },
  ],
  withoutData: ["Sanne"],
  crown: { name: "Mira", at: BOARD_START + 4 * H + 13 * 60 },
  yesterdayCrown: null,
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
  // WEB-66: the Bloodbath zone crop, the strip feat cards and the daily board image.
  "zone-bloodbath": zoneCard("Stranglethorn Vale", 4, HOST, { kills: 87 })!,
  ...stripSpecs(),
  "board-during": boardCard(BOARD, BOARD.start + 18 * H + 10 * 60, "Europe/Paris", HOST),
  "board-start": boardCard(
    {
      ...BOARD,
      friends: BOARD.friends.map((f) => ({ ...f, goals: [], today: { pve: 0, pvp: f.pvpVirgin ? null : 0 } })),
      crown: null,
    },
    BOARD.start + 60,
    "Europe/Paris",
    HOST,
  ),
  "board-final": boardCard(
    { ...BOARD, final: true, summary: { goalsDone: 14, hunt: null, longestStreak: { name: "Tok", days: 7 } } },
    BOARD.end - 60,
    "Europe/Paris",
    HOST,
  ),
  // WEB-56: the feat cards of the board doomsday-feat-cards, and the ones drawn in its style.
  ...featSpecs(),
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

function stripSpecs(): Record<string, CardSpec> {
  const strip = (name: string, m: object, who: { name: string; classFile: string }) =>
    [name, stripCard({ character: { guid: "G", name: who.name }, ...m } as Milestone, who)!] as const;
  const lia = { name: "Lia Thornwhisper", classFile: "DRUID" };
  return Object.fromEntries([
    strip("strip-first-catch", { kind: "firstCatch" }, { name: "Mira Sunstrider", classFile: "MAGE" }),
    strip("strip-first-blood", { kind: "honorKills", kills: 1 }, { name: "Bob Example", classFile: "ROGUE" }),
    strip("strip-level-30", { kind: "level", level: 30, from: 28 }, lia),
    strip("strip-profession", { kind: "professionCap", skillLine: "197", profession: "Tailoring", rank: 225 }, lia),
    strip("strip-duel-wins", { kind: "duelWins", wins: 10 }, { name: "Bob Example", classFile: "ROGUE" }),
    strip("strip-bg-win", { kind: "bgFirstWin", battleground: "Warsong Gulch" }, lia),
    strip("strip-deaths", { kind: "deaths100", deaths: 100 }, { name: "Ada Nightshade", classFile: "WARLOCK" }),
    strip(
      "strip-rank-3",
      { kind: "pvpRank", rank: 3, rankName: "Sergeant", title: "Lowbie Botherer", firstInGroup: true },
      lia,
    ),
  ]);
}

function featSpecs(): Record<string, CardSpec> {
  const ada = { name: "Ada Nightshade", classFile: "WARLOCK", classLabel: "Warlock", race: "Undead" };
  const bob = { name: "Bob Example", classFile: "ROGUE", classLabel: "Rogue", race: "Troll" };
  const feat = (name: string, kind: Milestone["kind"], fields: object, who = ada, first = false) =>
    [
      name,
      featCard(
        {
          kind,
          character: { guid: "G", name: who.name },
          ...fields,
          ...(first ? { firstInGroup: true } : {}),
        } as Milestone,
        who,
        HOST,
      )!,
    ] as const;
  return Object.fromEntries([
    feat("feat-rank-6", "pvpRank", { rank: 6, rankName: "Stone Guard", title: "Mailbox Menace" }, ada, true),
    feat("feat-rank-9", "pvpRank", { rank: 9, rankName: "Centurion", title: "Queue Dweller" }),
    feat("feat-rank-14", "pvpRank", { rank: 14, rankName: "High Warlord", title: "Grass: Untouched" }, bob),
    feat(
      "feat-first-epic",
      "firstEpic",
      { item: { id: 1, name: "Robes of the Exalted", slot: "Chest", level: 60 } },
      { ...mira },
      true,
    ),
    feat("feat-epic-mount", "epicMount", { riding: 150, level: 60, place: 3 }, { ...mira }, true),
    feat("feat-jack", "jackOfAllTrades", {
      professions: ["Cooking", "First Aid", "Fishing", "Blacksmithing", "Mining"],
    }),
    feat("feat-kills-10000", "honorKills", { kills: 10000 }),
    feat("feat-arcanite-reaper", "notableItem", { notable: "arcaniteReaper", item: { id: 12784 } }, bob, true),
    feat("feat-arcanite-bar", "notableItem", { notable: "arcaniteTransmute", item: { id: 12360 } }),
    feat("feat-mooncloth", "notableItem", { notable: "mooncloth", item: { id: 14342 } }),
    feat("feat-devilsaur", "notableItem", { notable: "devilsaur", item: { id: 15063 } }),
    feat("feat-extravaganza-joined", "notableItem", { notable: "extravaganzaJoined", item: { id: 19807 } }),
    feat("feat-extravaganza-won", "notableItem", { notable: "extravaganzaWon", item: { id: 19970 } }, bob, true),
  ]);
}

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
      const size = cardSize(spec);
      expect([width, height]).toEqual([size.width, size.height]);
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
