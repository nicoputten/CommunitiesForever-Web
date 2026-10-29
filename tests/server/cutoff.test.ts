import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Recap } from "@/core/recap/types";
import { listMembers, putGuest } from "@/server/access";
import { clearCutoff, storeCutoff } from "@/server/cutoff";
import { openDatabase, type Db } from "@/server/db";
import { botEvents, doomsdayGoals, feats, feedDays, recaps, sightings, uploads } from "@/server/db/schema";
import { getBotSettings, setTimeZone, updateBotSettings } from "@/server/discord";
import { latestRecap, recapByNumber, storedRecaps } from "@/server/recap";
import { getRun, listRuns, planRunFor } from "@/server/runs";
import { loadState, rebuild, upload } from "@/server/uploads";

// WEB-62: the launch cut-off. Beta uploads before it count only for who may sign in; launch uploads after it lose
// what dates from before it (a beta character carried along is ignored). Runs, recaps and feats from before it are
// hidden, never deleted, and come back on Undo. Settings, links and the like are untouched; no events are made.

const ADMIN = "Nico#1000";
const BETA = 1_790_000_000;
const CUTOFF = 1_793_800_000;
const LAUNCH = CUTOFF + 3600;
const day = (t: number) => Math.floor(t / 86400);

/** Nico's file: Ves (beta, played at `vesPlayed`) and, at launch, Grom; Ada's relayed record with Mira. */
function file(at: number, opts: { vesPlayed: number; grom?: boolean; goals?: boolean }) {
  return new TextEncoder().encode(`return { schemaVersion = 2,
    self = { battleTag = "${ADMIN}", displayName = "Nico", version = ${at}, chars = {
      V = { name = "Ves Example", classFile = "WARLOCK", level = 30, updatedAt = ${opts.vesPlayed}, lastPlayed = ${opts.vesPlayed} },
      ${opts.grom ? `G = { name = "Grom Example", classFile = "WARRIOR", level = 1, updatedAt = ${at}, lastPlayed = ${at} },` : ""} },
      feed = { [${day(at)}] = { ${opts.grom ? "G" : "V"} = { at = ${at}, levelFrom = 1, levelTo = 2 } } },
      ${opts.goals ? `goals = { days = { [${day(at)}] = { set = { "d.quests10" }, done = { ["d.quests10"] = ${at} }, at = ${at} } }, weeks = {} },` : ""} },
    people = { ["Ada#1001"] = { displayName = "Ada", version = ${at},
      chars = { M = { name = "Mira Example", classFile = "MAGE", level = 60, updatedAt = ${opts.vesPlayed}, lastPlayed = ${opts.vesPlayed} } } } },
    locations = { V = { zone = "Duskwood", seenAt = ${opts.vesPlayed} } },
    settings = { clubId = 1, clubName = "Friends" } }`);
}

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

const recap = (week: number, start: number) =>
  db
    .insert(recaps)
    .values({
      week,
      start,
      end: start + 7 * 86400,
      computedAt: start,
      data: { week } as unknown as Recap,
      snapshot: {},
    })
    .run();

/** The beta: two uploads (Mira reaches 60 between them: a feat), a run, a recap; then the cut-off and a rebuild. */
function betaThenCutoff() {
  upload(db, file(BETA, { vesPlayed: BETA }), ADMIN, BETA, ADMIN);
  upload(db, file(BETA + 100, { vesPlayed: BETA + 100, goals: true }), ADMIN, BETA + 100, ADMIN);
  const beta = planRunFor(db, { dungeonId: "dm", startsAt: BETA + 86400, organiser: ADMIN, source: "website" }, BETA);
  const launch = planRunFor(
    db,
    { dungeonId: "rfc", startsAt: LAUNCH + 86400, organiser: ADMIN, source: "website" },
    BETA,
  );
  recap(1, BETA);
  return { beta: (beta as { id: number }).id, launch: (launch as { id: number }).id };
}

describe("the launch cut-off", () => {
  it("forgets the beta without deleting anything, keeps who may sign in, and Undo brings it back", () => {
    putGuest(db, "Gus#3003", true, ADMIN, BETA);
    updateBotSettings(db, { recap: false }, ADMIN, BETA);
    setTimeZone(db, ADMIN, "Europe/Amsterdam", "picked", BETA);
    const runs = betaThenCutoff();
    const before = {
      characters: Object.keys(loadState(db)!.data.characters).sort(),
      feed: db.select().from(feedDays).all().length,
      uploads: db.select().from(uploads).all().length,
      events: db.select().from(botEvents).all().length,
    };
    expect(before.characters).toEqual(["M", "V"]);

    storeCutoff(db, CUTOFF, ADMIN, CUTOFF);
    rebuild(db, ADMIN);
    // The roster is empty; the history, feats and Doomsday from before are gone from view.
    expect(loadState(db)).toBeUndefined();
    expect(db.select().from(feedDays).all()).toEqual([]);
    expect(db.select().from(sightings).all()).toEqual([]);
    expect(db.select().from(doomsdayGoals).all()).toEqual([]);
    expect(db.select().from(feats).all()).toEqual([]);
    // Who may sign in stays: members from the beta uploads, the guest list; settings untouched.
    expect(listMembers(db).map((m) => m.battleTag)).toEqual(expect.arrayContaining([ADMIN, "Ada#1001"]));
    expect(getBotSettings(db).recap).toBe(false);
    // Nothing deleted, nothing posted.
    expect(db.select().from(uploads).all().length).toBe(before.uploads);
    expect(db.select().from(botEvents).all().length).toBe(before.events);
    // Runs that started before it are hidden; one planned for after launch stays.
    expect(listRuns(db).map((r) => r.id)).toEqual([runs.launch]);
    expect(getRun(db, runs.beta)).toBeUndefined();
    // Recaps restart: the beta one is hidden, the next is week 1 again.
    expect(storedRecaps(db)).toEqual([]);
    expect(latestRecap(db)).toBeUndefined();
    recap(2, LAUNCH);
    expect(recapByNumber(db, 1)?.start).toBe(LAUNCH);

    // A launch upload: Grom is new; Ves and Mira, last played in the beta, stay out.
    upload(db, file(LAUNCH, { vesPlayed: BETA + 100, grom: true }), ADMIN, LAUNCH, ADMIN);
    expect(Object.keys(loadState(db)!.data.characters)).toEqual(["G"]);
    // The site's first upload after the cut-off: everything in it is already had, no feat posts.
    expect(db.select().from(botEvents).all().length).toBe(before.events);

    // Undo: everything back as it was, plus the launch upload.
    clearCutoff(db);
    rebuild(db, ADMIN);
    expect(Object.keys(loadState(db)!.data.characters).sort()).toEqual(["G", "M", "V"]);
    expect(
      listRuns(db)
        .map((r) => r.id)
        .sort(),
    ).toEqual([runs.beta, runs.launch].sort());
    expect(storedRecaps(db).map((r) => r.week)).toEqual([1, 2]);
    expect(db.select().from(doomsdayGoals).all().length).toBeGreaterThan(0);
  });
});
