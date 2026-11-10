import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { beforeRosters } from "./beforeRosters";
import { targetOf } from "@/core/doomsday/hunt";
import { dayStart } from "@/core/doomsday/rules";
import { logParts } from "@/core/views/admin";
import { listLog, OwnerOnlyError } from "@/server/admins";
import { openDatabase, type Db } from "@/server/db";
import { characters, feats, huntCensusFetch, missionSettings } from "@/server/db/schema";
import {
  doomsdayHunt,
  type Fetch,
  fetchCensus,
  huntCensusInfo,
  huntPlanAt,
  huntTargetsFor,
  importCensus,
  latestCensus,
  missionPoolPage,
  pinHunt,
  runDueCensus,
} from "@/server/hunt";
import { doomsdaySchedule } from "@/server/missionPool";
import { upload } from "@/server/uploads";

// WEB-108: the Hunt on the server: the daily census from Everloot (a fake fetch, never the network), its fallback and
// the owner's import, the owner's switches and pins, and the Hunt kills of an upload with their feats. The realm zone
// is the default, Europe/Paris (CET in November), reset 19:00. Every census number is made up.

const OWNER = "Nico#1000";
const S = { offset: 3600, reset: 68400 };
const TODAY = 20766; // Mon 9 Nov
const NOW = dayStart(TODAY, S) + 3600;
const KEY = "evl_test_key_not_real";

const lua = (body: string) => new TextEncoder().encode(`return { schemaVersion = 2, ${body} }`);
/** Nico's file: Ves (Horde) with a feed day; Ada's relayed record with Mira (Alliance). */
const file = (version: number, vesFeed = "") =>
  lua(`
    self = { battleTag = "${OWNER}", displayName = "Nico", version = ${version},
      chars = { V = { name = "Ves Example", classFile = "WARLOCK", faction = "Horde", level = 40, updatedAt = ${version} } }
      ${vesFeed !== "" ? `, feed = { [${TODAY}] = { V = { at = ${version}, ${vesFeed} } } }` : ""} },
    people = { ["Ada#1001"] = { displayName = "Ada", version = ${version},
      chars = { M = { name = "Mira Example", classFile = "MAGE", faction = "Alliance", level = 60, updatedAt = ${version} } } } },
    settings = { clubId = 1, clubName = "Friends" },
  `);

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = beforeRosters(openDatabase(path.join(dir, "test.sqlite")));
  expect(upload(db, file(NOW - 100), OWNER, NOW - 100, OWNER).status).toBe("ok");
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const logText = () =>
  listLog(db).map((e) => [e.by, ...logParts(e, (t) => t)].map((p) => (typeof p === "string" ? p : p.text)).join(""));

/** A fake Everloot: one population answer per faction and class, every valid target at `count`. */
function everloot(count = 100, calls: { url: string; auth?: string }[] = []): Fetch {
  return async (url, init) => {
    calls.push({ url, auth: init.headers.authorization });
    const q = new URL(url).searchParams;
    const faction = q.get("faction")!;
    const cls = q.get("class")!.toUpperCase();
    const races =
      faction === "Alliance"
        ? ["Human", "Dwarf", "Night Elf", "Gnome", "Skyborne"]
        : ["Orc", "Undead", "Tauren", "Troll", "Skyborne"];
    return {
      ok: true,
      status: 200,
      json: async () => ({
        tool: "population",
        answer: {
          dataAsOf: "2026-11-09T20:00:00.000Z",
          page: {
            window: { id: "week", from: "2026-11-03T20:00:00.000Z", to: "2026-11-09T20:00:00.000Z" },
            characters: 16400,
            installs: 13,
            rule: { roundTo: 5 },
            cells: races.map((race) => ({ slice: "raceClass", faction, race, class: cls, count })),
          },
        },
      }),
    };
  };
}

describe("the census", () => {
  it("asks Everloot's population tool once per hunted faction and class, with the key as a Bearer token", async () => {
    const calls: { url: string; auth?: string }[] = [];
    const census = await fetchCensus(everloot(100, calls), KEY);
    expect(calls).toHaveLength(18);
    expect(calls.every((c) => c.auth === `Bearer ${KEY}`)).toBe(true);
    expect(calls[0]!.url).toBe("https://everloot.app/api/tools/population?faction=Alliance&class=Warrior&window=week");
    expect(Object.keys(census.counts)).toHaveLength(56);
    expect(census).toMatchObject({ characters: 16400, installs: 13, roundTo: 5, source: "everloot" });
  });

  it("stops at Everloot's limit (429) and says so without the key", async () => {
    let n = 0;
    const limited: Fetch = async (url, init) => {
      if (++n === 3) return { ok: false, status: 429, json: async () => ({}) };
      return everloot()(url, init);
    };
    await expect(fetchCensus(limited, KEY)).rejects.toThrow("Everloot census: HTTP 429");
    expect(n).toBe(3);
  });

  it("runs once per realm day, before the draw, and the free days are drawn with it", async () => {
    const free = huntPlanAt(db, NOW).find((d) => d.n === TODAY + 5)!.pick;
    expect(await runDueCensus(db, NOW, everloot(100, []), KEY)).toBe(true);
    expect(await runDueCensus(db, NOW + 60, everloot(100, []), KEY)).toBe(false);
    expect(latestCensus(db)!.census.counts["4:3"]).toBe(100);
    expect(huntCensusInfo(db, NOW)).toMatchObject({ stale: false, characters: 16400, source: "everloot" });
    // A target the new census skips (under 30) leaves the free days, never today or tomorrow.
    const skipped = everloot(100);
    const one: Fetch = async (url, init) => {
      const r = await skipped(url, init);
      const body = (await r.json()) as {
        answer: { page: { cells: { race: string; class: string; count: number }[] } };
      };
      for (const c of body.answer.page.cells)
        if (`${c.race}:${c.class}` === `${targetOf(free.Alliance)!.race}:${targetOf(free.Alliance)!.classFile}`)
          c.count = 5;
      return { ...r, json: async () => body };
    };
    const locked = huntPlanAt(db, NOW + 86400).filter((d) => d.locked && d.n >= TODAY + 1);
    expect(await runDueCensus(db, NOW + 86400, one, KEY)).toBe(true);
    const plan = huntPlanAt(db, NOW + 86400);
    for (const d of locked) expect(plan.find((x) => x.n === d.n)!.pick).toEqual(d.pick);
    for (const d of plan.filter((x) => !x.locked)) expect(d.pick.Alliance).not.toBe(free.Alliance);
  });

  it("a failed fetch keeps the last stored census, marks it stale and logs it (never the key)", async () => {
    await runDueCensus(db, NOW, everloot(100), KEY);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const down: Fetch = async () => {
      throw new Error("connect ECONNREFUSED");
    };
    expect(await runDueCensus(db, NOW + 86400, down, KEY)).toBe(true);
    expect(latestCensus(db)!.census.counts["4:3"]).toBe(100);
    expect(huntCensusInfo(db, NOW + 86400)!.stale).toBe(true);
    expect(
      db
        .select()
        .from(huntCensusFetch)
        .all()
        .map((r) => r.ok),
    ).toEqual([true, false]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("using the last stored census");
    expect(String(warn.mock.calls[0]![0])).not.toContain(KEY);
    // Without any census the draw still has a quarry every day.
    expect(huntPlanAt(db, NOW + 86400).every((d) => d.pick.Alliance !== undefined && d.pick.Horde !== undefined)).toBe(
      true,
    );
  });

  it("the owner's import: stored with its date and logged; anyone else is refused", () => {
    const json = JSON.stringify({ characters: 9000, counts: { "4:3": 230, "8:8": 270 } });
    expect(() => importCensus(db, "Ada#1001", json, NOW, OWNER)).toThrow(OwnerOnlyError);
    expect(() => importCensus(db, OWNER, "{", NOW, OWNER)).toThrow("That isn't JSON. Nothing was changed.");
    importCensus(db, OWNER, json, NOW, OWNER);
    expect(latestCensus(db)).toMatchObject({ at: NOW, census: { source: "import", counts: { "4:3": 230 } } });
    expect(logText()).toEqual([`${OWNER}imported the Everloot census`]);
  });
});

describe("the owner's switches and pins", () => {
  it("a target switched off (WEB-109's mission setting hunt:<race>:<class>) leaves the free days; the grid shows it", () => {
    const stored = doomsdayHunt(db, NOW).next; // stores the plan
    const key = stored.find((d) => d.n === TODAY + 4)!.pick.Alliance!;
    db.insert(missionSettings)
      .values({ id: `hunt:${key}`, off: true, often: "normal", changedAt: NOW, changedBy: OWNER })
      .run();
    const plan = huntPlanAt(db, NOW);
    expect(plan.find((d) => d.n === TODAY + 1)!.pick).toEqual(stored.find((d) => d.n === TODAY + 1)!.pick);
    for (const d of plan.filter((x) => !x.locked)) expect(d.pick.Alliance).not.toBe(key);
    const cell = huntTargetsFor(db, OWNER, NOW, OWNER)
      .view.factions.Alliance.races.flatMap((r) => r.cells)
      .find((c) => c.key === key)!;
    expect(cell.state).toBe("off");
    expect(() => huntTargetsFor(db, "Ada#1001", NOW, OWNER)).toThrow(OwnerOnlyError);
  });

  it("a pin goes into the schedule as ids; today and tomorrow refuse it", () => {
    const n = TODAY + 3;
    pinHunt(db, OWNER, n, "Alliance", "95:11", NOW, OWNER);
    const day = doomsdaySchedule(db, NOW + 5)!.days![String(n)]!;
    expect(day.hunt!.Alliance).toEqual({ race: 95, class: 11 });
    expect(doomsdaySchedule(db, NOW + 5)!.days![String(n)]!.pool).toBe(6);
    for (const locked of [TODAY, TODAY + 1])
      expect(() => pinHunt(db, OWNER, locked, "Alliance", "95:11", NOW, OWNER)).toThrow("That day is locked.");
    expect(() => pinHunt(db, OWNER, n, "Horde", "95:11", NOW, OWNER)).toThrow("That target doesn't fit that Hunt.");
    pinHunt(db, OWNER, n, "Alliance", undefined, NOW + 10, OWNER);
    expect(logText()).toEqual([
      `${OWNER}unpinned the quarry on Thu 12`,
      `${OWNER}pinned Skyborne Druid as the quarry on Thu 12`,
    ]);
  });
});

describe("Hunt kills from an upload", () => {
  it("today's quarry bagged: The Hunt today, the friend's trophies and the First quarry feat", () => {
    const quarry = huntPlanAt(db, NOW).find((d) => d.n === TODAY)!.pick.Alliance!;
    const t = targetOf(quarry)!;
    // The Hunt kill is an honorable kill (CF-55 pvpKills) with CF-118's ids next to the tokens.
    const hunts = `pvpKills = { { t = ${NOW + 60}, zone = "Ashenvale", name = "Foe Example", race = "${t.raceToken}", class = "${t.classFile}", raceId = ${t.raceId}, classId = ${t.classId} } }`;
    expect(upload(db, file(NOW + 120, hunts), OWNER, NOW + 120, OWNER).status).toBe("ok");
    const data = doomsdayHunt(db, NOW + 180);
    const nico = data.friends.find((f) => f.owner === OWNER)!;
    expect(nico).toMatchObject({ todayDone: true, todayKill: { at: NOW + 60, zone: "Ashenvale", quarry: true } });
    expect(nico.trophies).toMatchObject({ distinct: 1, quarries: 1, hunted: "Alliance" });
    expect(data.hunt).toMatchObject({ bagged: 1, total: 2 });
    expect(data.hunt.quarry.Alliance!.target.key).toBe(quarry);
    expect(data.week).toEqual([{ owner: OWNER, days: 1 }]);
    expect(data.next).toHaveLength(7);
    const held = db
      .select()
      .from(feats)
      .all()
      .filter((f) => f.kind === "hunt");
    expect(held.map((f) => [f.guid, f.key, f.fields.target])).toEqual([["V", "hunt:f.huntFirst", t.name]]);
  });

  it("an older addon's feed without pvpKills still reads, and has no Hunt kills", () => {
    expect(upload(db, file(NOW + 120, "quests = { Durotar = 2 }"), OWNER, NOW + 120, OWNER).status).toBe("ok");
    expect(doomsdayHunt(db, NOW + 180).friends.every((f) => !f.todayDone && f.bagged.length === 0)).toBe(true);
  });
});

describe("the Mission pool page v2", () => {
  it("one call fills it for the owner: tiles, cards, 14 days with their Hunt, the quarry, the targets", () => {
    expect(() => missionPoolPage(db, "Ada#1001", NOW, OWNER)).toThrow(OwnerOnlyError);
    const page = missionPoolPage(db, OWNER, NOW, OWNER);
    expect(page.tiles).toHaveLength(6);
    expect(page.cards).toHaveLength(10);
    expect(page.days).toHaveLength(14);
    expect(page.days[0]!.n).toBe(TODAY);
    expect(page.days[0]!.hunt.targets.Alliance).toBeDefined();
    expect(page.quarry.Alliance!.target.key).toBe(page.days[0]!.hunt.targets.Alliance!.key);
    expect(page.next).toHaveLength(7);
    expect(page.targets.factions.Horde.total).toBe(28);
  });
});

describe("the group's factions (WEB-112)", () => {
  const factionsAsked = (calls: { url: string }[]) => [
    ...new Set(calls.map((c) => new URL(c.url).searchParams.get("faction"))),
  ];

  it("both factions (Ves Horde, Mira Alliance): both Hunts, 18 census calls", async () => {
    const calls: { url: string }[] = [];
    await runDueCensus(db, NOW, everloot(100, calls), KEY);
    expect(calls).toHaveLength(18);
    expect(factionsAsked(calls)).toEqual(["Alliance", "Horde"]);
    const page = missionPoolPage(db, OWNER, NOW, OWNER);
    expect(page.hunters).toEqual(["Horde", "Alliance"]);
    expect(Object.keys(page.quarry).sort()).toEqual(["Alliance", "Horde"]);
    expect(doomsdayHunt(db, NOW).hunters).toEqual(["Horde", "Alliance"]);
  });

  it("one faction (only Ves, Horde): only the Alliance targets, 9 census calls, both still drawn", async () => {
    db.delete(characters).where(eq(characters.guid, "M")).run();
    const calls: { url: string }[] = [];
    await runDueCensus(db, NOW, everloot(100, calls), KEY);
    expect(calls).toHaveLength(9);
    expect(factionsAsked(calls)).toEqual(["Alliance"]);
    const page = missionPoolPage(db, OWNER, NOW, OWNER);
    expect(page.hunters).toEqual(["Horde"]);
    expect(Object.keys(page.quarry)).toEqual(["Alliance"]);
    const hunt = doomsdayHunt(db, NOW);
    expect(Object.keys(hunt.hunt.quarry)).toEqual(["Alliance"]);
    expect(Object.keys(hunt.hunt.tomorrow)).toEqual(["Alliance"]);
    // The addon's schedule keeps both Hunts: the unused faction is drawn without a census, every target alike.
    expect(huntPlanAt(db, NOW).every((d) => d.pick.Alliance !== undefined && d.pick.Horde !== undefined)).toBe(true);
  });

  it("no character known: both, as before", async () => {
    db.delete(characters).run();
    const calls: { url: string }[] = [];
    await runDueCensus(db, NOW, everloot(100, calls), KEY);
    expect(calls).toHaveLength(18);
    expect(missionPoolPage(db, OWNER, NOW, OWNER).hunters).toEqual(["Horde", "Alliance"]);
  });
});
