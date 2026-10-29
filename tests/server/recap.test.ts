import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as latestRoute } from "@/app/api/bot/v1/recap/latest/route";
import { createBotToken } from "@/server/bot";
import { getDb } from "@/server/db";
import { botEvents, recaps } from "@/server/db/schema";
import { updateBotSettings } from "@/server/discord";
import { assembleWeek, previewRecap, runDueRecap } from "@/server/recap";
import { upload } from "@/server/uploads";

// WEB-41c: the recap job (due at the recap moment, once, catching up after downtime), the week's input from the
// history, the bot's `recap` event and `GET recap/latest`.

const ADMIN = "Nico#1000";
const SITE = "Friends";
const t = (iso: string) => Date.parse(iso) / 1000;
/** Default schedule: Sunday 13:00 in the admin's time zone (UTC: none set). */
const SUN1 = t("2026-11-01T13:00:00Z");
const SUN2 = t("2026-11-08T13:00:00Z");
const day = (at: number) => Math.floor(at / 86400);

const file = (level: number, at: number, zone: string, shareAda = true) =>
  new TextEncoder().encode(`return { schemaVersion = 1,
    self = { battleTag = "${ADMIN}", displayName = "Nico", version = ${at},
      chars = { ["G-V"] = { name = "Ves Example", classFile = "WARLOCK", raceID = 5, level = ${level}, updatedAt = ${at} } },
      feed = { [${day(at)}] = { ["G-V"] = { at = ${at}, levelFrom = ${level - 1}, levelTo = ${level}, quests = { ["Duskwood"] = 2 } } } } },
    people = { ["Ada#1001"] = { version = 1, displayName = "Ada", chars = { ["G-A"] = { name = "Ada Example", level = 30, updatedAt = 1 } },
      feed = ${shareAda ? `{ [${day(at)}] = { ["G-A"] = { at = ${at}, levelTo = 30 } } }` : "false"} } },
    locations = { ["G-V"] = { zone = "${zone}", seenAt = ${at} } },
    settings = { clubId = 7, clubName = "${SITE}" },
  }`);

let dir: string;
let token: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  process.env.DATA_DIR = dir;
  process.env.ADMIN_BATTLETAG = ADMIN;
  token = createBotToken(getDb(), ADMIN, 1);
});

afterAll(() => {
  getDb().$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const latest = () =>
  latestRoute(
    new Request("http://localhost/api/bot/v1/recap/latest", { headers: { authorization: `Bearer ${token}` } }),
  );
const recapEvents = () =>
  getDb()
    .select()
    .from(botEvents)
    .all()
    .filter((e) => e.type === "recap");

describe("the recap job", () => {
  it("starts counting when the site starts: nothing before the first moment", async () => {
    const db = getDb();
    expect(runDueRecap(db, t("2026-10-28T12:00:00Z"), SITE)).toBeUndefined();
    expect((await latest()).status).toBe(404);
    upload(db, file(20, t("2026-10-29T20:00:00Z"), "Duskwood"), ADMIN, t("2026-10-29T21:00:00Z"), ADMIN);
    upload(db, file(23, t("2026-10-31T20:00:00Z"), "Stranglethorn Vale"), ADMIN, t("2026-10-31T21:00:00Z"), ADMIN);
    expect(runDueRecap(db, SUN1 - 1, SITE)).toBeUndefined();
  });

  it("computes week 1 once at the moment, stores it and posts it", async () => {
    const db = getDb();
    const r = runDueRecap(db, SUN1 + 30, SITE);
    expect(r?.week).toBe(1);
    expect(r?.headline.text).toMatch(/Friends/);
    expect(runDueRecap(db, SUN1 + 90, SITE)).toBeUndefined();
    expect(
      db
        .select()
        .from(recaps)
        .all()
        .map((x) => [x.week, x.end]),
    ).toEqual([[1, SUN1]]);
    expect(recapEvents()).toHaveLength(1);
    const res = await latest();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.week).toBe(1);
    expect(body).not.toHaveProperty("past");
    expect(body).not.toHaveProperty("cycles");
    expect(JSON.stringify(body)).not.toContain("#");
    // WEB-66: what the bot's visual recap needs besides the texts.
    expect(r!.numbers).toMatchObject({ feats: expect.any(Number), honorKills: expect.any(Number) });
    if (r!.award !== undefined) expect(r!.award.image).toBe("recap-1-header");
    const map = r!.cards.find((c) => c.id === "S1" || c.id === "S13");
    if (map !== undefined) expect(map.image).toBe("recap-1-zone");
    if (process.env.AUTH_URL !== undefined) expect(r!.url).toMatch(/\/doomsday\/week$/);
  });

  it("catches up after downtime with one recap, and posts nothing while the Weekly recap is off", () => {
    const db = getDb();
    updateBotSettings(db, { recap: false }, ADMIN, 1);
    const r = runDueRecap(db, SUN2 + 7 * 86400 + 60, SITE);
    expect(r?.week).toBe(2);
    expect(
      db
        .select()
        .from(recaps)
        .all()
        .map((x) => [x.week, x.start, x.end]),
    ).toEqual([
      [1, expect.any(Number), SUN1],
      [2, SUN1, SUN2 + 7 * 86400],
    ]);
    expect(recapEvents()).toHaveLength(1);
    updateBotSettings(db, { recap: true }, ADMIN, 2);
  });

  it("previews the coming week without storing it", () => {
    const db = getDb();
    const before = db.select().from(recaps).all().length;
    expect(previewRecap(db, SUN2 + 8 * 86400, SITE).week).toBe(3);
    expect(db.select().from(recaps).all()).toHaveLength(before);
  });
});

describe("the week's input", () => {
  it("takes the feed days and sightings of the week only, and map zones by name; feed = false sends nothing", () => {
    const db = getDb();
    const w = assembleWeek(db, 9, t("2026-10-30T00:00:00Z"), t("2026-11-01T00:00:00Z"), {}, SITE);
    expect(w.days.map((d) => [d.guid, d.entry.levelTo])).toEqual([
      ["G-A", 30],
      ["G-V", 23],
    ]);
    expect(w.sightings.map((s) => s.zone)).toEqual(["Stranglethorn Vale"]);
    expect(w.zonesBefore).toEqual(["Duskwood"]);
    expect(w.after["G-V"]).toMatchObject({ name: "Ves Example", race: "Undead", level: 23 });
    expect(w.friends.map((f) => f.name)).toEqual(["Ada", "Nico"]);
    upload(db, file(24, t("2026-10-31T22:00:00Z"), "Duskwood", false), ADMIN, t("2026-10-31T23:00:00Z"), ADMIN);
    const off = assembleWeek(db, 9, t("2026-10-30T00:00:00Z"), t("2026-11-01T00:00:00Z"), {}, SITE);
    // "Share my activity" is gone (Nico, 2026-10-28): an older addon's feed = false keeps Ada's stored days.
    expect(off.days.map((d) => d.guid)).toEqual(["G-A", "G-V"]);
  });
});
