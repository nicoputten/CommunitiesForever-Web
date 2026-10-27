import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db } from "@/server/db";
import { feedDays, feedSharing, sightings } from "@/server/db/schema";
import { putGuest } from "@/server/access";
import { rebuild, upload } from "@/server/uploads";

// WEB-41: the recap's history, kept from every accepted upload: the feed per day per character (the copy with the
// latest activity wins), who shares it, and every sighting. A rebuild writes the same rows.

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
  });

  it("knows who doesn't share their activity, and keeps every sighting once", () => {
    upload(db, nico(600, 22, ", feed = false", 500), ADMIN, 1000, ADMIN);
    upload(db, nico(700, 23, ", feed = false", 650), ADMIN, 1100, ADMIN);
    upload(db, nico(800, 24, ", feed = false", 650), ADMIN, 1200, ADMIN);
    expect(
      db
        .select()
        .from(feedSharing)
        .all()
        .map((r) => [r.owner, r.shared]),
    ).toEqual([
      [ADMIN, true],
      ["Ada#1001", false],
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
});
