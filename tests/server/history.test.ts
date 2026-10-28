import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db } from "@/server/db";
import { doomsdayGoals, doomsdayStatus, feedDays, sightings } from "@/server/db/schema";
import { putGuest } from "@/server/access";
import { rebuild, upload } from "@/server/uploads";

// WEB-41: the recap's history, kept from every accepted upload: the feed per day per character (the copy with the
// latest activity wins) and every sighting. WEB-55: Doomsday goals per friend, day and week (the newer `at` wins).
// A rebuild writes the same rows.

const ADMIN = "Nico#1000";
const lua = (body: string) => new TextEncoder().encode(`return { schemaVersion = 1, ${body} }`);

/** Nico's file: own feed for day 20744 (Ves), Ada's relayed feed, and where Ves was seen. */
const nico = (at: number, levelTo: number, adaFeed = "", seenAt = 500) =>
  lua(`
    self = { battleTag = "${ADMIN}", version = ${at}, chars = { ["G-V"] = { name = "Ves Example", level = ${levelTo}, updatedAt = ${at} } },
      feed = { [20744] = { ["G-V"] = { at = ${at}, levelFrom = 20, levelTo = ${levelTo} } } } },
    people = { ["Ada#1001"] = { version = 1, chars = { ["G-A"] = { name = "Ada Example", level = 30, updatedAt = 1 } }${adaFeed} } },
    locations = { ["G-V"] = { zone = "The Barrens", seenAt = ${seenAt} } },
    settings = { clubId = 7, clubName = "Friends" },
  `);

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = openDatabase(path.join(dir, "test.sqlite"));
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const days = () =>
  db
    .select()
    .from(feedDays)
    .all()
    .map((r) => [r.day, r.guid, r.owner, r.at, r.data.levelTo]);

describe("history", () => {
  it("keeps the feed day with the latest activity, from any upload", () => {
    expect(upload(db, nico(600, 22), ADMIN, 1000, ADMIN).status).toBe("ok");
    expect(days()).toEqual([[20744, "G-V", ADMIN, 600, 22]]);
    // An older copy of the same day (a relay that came late) doesn't replace it.
    expect(upload(db, nico(550, 21), ADMIN, 1100, ADMIN).status).toBe("ok");
    expect(days()).toEqual([[20744, "G-V", ADMIN, 600, 22]]);
    expect(upload(db, nico(700, 23), ADMIN, 1200, ADMIN).status).toBe("ok");
    expect(days()).toEqual([[20744, "G-V", ADMIN, 700, 23]]);
    // An equal copy keeps the stored one (as the addon's Feed.merge): a relay can't wipe newer fields.
    expect(upload(db, nico(700, 24), ADMIN, 1300, ADMIN).status).toBe("ok");
    expect(days()).toEqual([[20744, "G-V", ADMIN, 700, 23]]);
  });

  it("keeps a friend's stored days when an older addon sends feed = false, and every sighting once", () => {
    upload(
      db,
      nico(600, 22, ', feed = { [20744] = { ["G-A"] = { at = 590, levelTo = 30 } } }', 500),
      ADMIN,
      1000,
      ADMIN,
    );
    upload(db, nico(700, 23, ", feed = false", 650), ADMIN, 1100, ADMIN);
    upload(db, nico(800, 24, ", feed = false", 650), ADMIN, 1200, ADMIN);
    expect(days()).toEqual([
      [20744, "G-V", ADMIN, 800, 24],
      [20744, "G-A", "Ada#1001", 590, 30],
    ]);
    expect(
      db
        .select()
        .from(sightings)
        .all()
        .map((r) => [r.guid, r.zone, r.seenAt]),
    ).toEqual([
      ["G-V", "The Barrens", 500],
      ["G-V", "The Barrens", 650],
    ]);
  });

  it("takes nothing from a rejected upload, and a rebuild writes the same rows", () => {
    putGuest(db, "Gus#3003", true, ADMIN, 1);
    upload(db, nico(600, 22), ADMIN, 1000, ADMIN);
    // Someone else's file: rejected, nothing from it.
    expect(upload(db, nico(900, 30), "Gus#3003", 1100, ADMIN).status).toBe("rejected");
    upload(db, nico(700, 23, ', feed = { [20745] = { ["G-A"] = { at = 650, levelTo = 31 } } }'), ADMIN, 1200, ADMIN);
    const seen = () =>
      db
        .select()
        .from(sightings)
        .all()
        .map(({ guid, zone, seenAt, sourceUpload }) => [guid, zone, seenAt, sourceUpload]);
    const before = { days: days(), sightings: seen() };
    expect(before.days).toEqual([
      [20744, "G-V", ADMIN, 700, 23],
      [20745, "G-A", "Ada#1001", 650, 31],
    ]);
    rebuild(db, ADMIN);
    expect({ days: days(), sightings: seen() }).toEqual(before);
  });

  describe("Doomsday goals (WEB-55)", () => {
    /** Ada's relayed goals: day 20744 with d.quests10 done at `doneAt`, the copy changed at `at`. */
    const adaGoals = (at: number, doneAt: number, streak = 2) =>
      `, goals = { days = { [20744] = { set = { "d.quests10", "d.level", "d.dungeon", "hunt", "p.loneWolf" },
          swapped = { ["d.quests10"] = "d.shared3" }, done = { ["d.quests10"] = ${doneAt} }, at = ${at} } },
        weeks = { [2964] = { set = { "w.days3", "w.quests50", "w.cap", "b.kills50" }, done = {}, at = ${at} } },
        streak = { n = ${streak}, last = 20744 }, best = 5, pool = 1, reset = 68400 }`;
    const goals = () =>
      db
        .select()
        .from(doomsdayGoals)
        .all()
        .map((r) => [r.owner, r.period, r.n, r.at, Object.keys(r.data.done)]);
    const status = () =>
      db
        .select()
        .from(doomsdayStatus)
        .all()
        .map((r) => [r.owner, r.streak, r.best, r.pool, r.reset, r.at]);

    it("stores each day and week, the newer at wins, and false sends nothing", () => {
      upload(db, nico(600, 22, adaGoals(700, 650)), ADMIN, 1000, ADMIN);
      expect(goals()).toEqual([
        ["Ada#1001", "day", 20744, 700, ["d.quests10"]],
        ["Ada#1001", "week", 2964, 700, []],
      ]);
      expect(status()).toEqual([["Ada#1001", 2, 5, 1, 68400, 700]]);
      const day = db.select().from(doomsdayGoals).all()[0]!.data;
      expect(day.swapped).toEqual({ "d.quests10": "d.shared3" });
      expect(day.set).toHaveLength(5);

      // An older copy relayed late changes nothing.
      upload(db, nico(650, 22, adaGoals(690, 600, 1)), ADMIN, 1100, ADMIN);
      expect(goals()[0]![3]).toBe(700);
      expect(status()[0]![1]).toBe(2);
      // An older addon's goals = false: nothing sent, the stored goals stay.
      upload(db, nico(700, 23, ", goals = false"), ADMIN, 1200, ADMIN);
      expect(goals()).toHaveLength(2);
      // A newer copy wins.
      upload(db, nico(800, 24, adaGoals(900, 650, 3)), ADMIN, 1300, ADMIN);
      expect(goals()[0]![3]).toBe(900);
      expect(status()[0]![1]).toBe(3);
    });

    it("cleans and caps as the addon does", () => {
      const long = "x".repeat(25);
      upload(
        db,
        nico(
          600,
          22,
          `, goals = { days = { [20744] = { set = { "a", "b", "c", "d", "e", "f", "${long}", 7 },
            done = { a = -1, b = 5, ["${long}"] = 6 }, at = -3 }, [3] = { set = { "a" } } },
            weeks = { [99] = { set = {} } }, streak = -1, best = "x", reset = 90000 }`,
        ),
        ADMIN,
        1000,
        ADMIN,
      );
      const rows = db.select().from(doomsdayGoals).all();
      expect(rows.map((r) => [r.period, r.n, r.at])).toEqual([["day", 20744, null]]);
      expect(rows[0]!.data).toEqual({ set: ["a", "b", "c", "d", "e"], swapped: {}, done: { b: 5 } });
      expect(status()).toEqual([["Ada#1001", null, null, null, null, null]]);
    });

    it("a rebuild writes the same rows", () => {
      upload(db, nico(600, 22, adaGoals(700, 650)), ADMIN, 1000, ADMIN);
      upload(db, nico(800, 24, adaGoals(900, 650, 3)), ADMIN, 1300, ADMIN);
      const before = { goals: goals(), status: status() };
      rebuild(db, ADMIN);
      expect({ goals: goals(), status: status() }).toEqual(before);
    });
  });
});
