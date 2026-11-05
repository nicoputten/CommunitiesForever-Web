import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dayStart, draw } from "@/core/doomsday/rules";
import { storeCutoff } from "@/server/cutoff";
import { openDatabase, type Db } from "@/server/db";
import { botEvents, doomsdayGoals, members, uploads } from "@/server/db/schema";
import { updateBotSettings } from "@/server/discord";
import { doomsdayFor } from "@/server/doomsdayEngine";
import { runDueDoomsday } from "@/server/doomsdayPosts";
import { recordGoals } from "@/server/history";
import { readAllGoals } from "@/core/doomsday/record";
import { parseLua } from "@/core/lua";
import {
  communityState,
  getUpload,
  listUploads,
  loadState,
  rebuildUploadsWithoutCommunity,
  upload,
  type UploadResult,
} from "@/server/uploads";

// WEB-84: at launch no in-game community could be made, and the bot posted the admin's Doomsday progress from a file
// without `settings.clubId`. Without a community a character is left out of the site and Doomsday; the addon keeps
// tracking, so once a community or guild is picked that day's progress counts at once.

const ADMIN = "Nico#1000";
const CET = 3600;
/** Doomsday day 20767 (Tue 10 Nov 2026) starts at 19:00 CET. */
const DAY = 20767;
const T = dayStart(DAY, { offset: CET, reset: 68400 });
const GUILD = 11;
const dailies = draw(DAY).dailies;

/**
 * The owner's own file at `at`: one character and today's goals, `done` of the 3 dailies done. `club` undefined: no
 * community or guild picked in the addon (no `settings.clubId`).
 */
function file(at: number, done: number, club?: number, tag = ADMIN, name = "Nico") {
  const set = [...dailies, draw(DAY).skirmish!].map((id) => `"${id}"`).join(", ");
  const doneLua = dailies
    .slice(0, done)
    .map((id, i) => `["${id}"] = ${T + 100 + i}`)
    .join(", ");
  return new TextEncoder().encode(`return { schemaVersion = 2,
    self = { battleTag = "${tag}", displayName = "${name}", version = ${at},
      chars = { ${name}1 = { name = "${name} Example", classFile = "WARLOCK", faction = "Horde", level = 40, updatedAt = ${at} } },
      goals = { days = { [${DAY}] = { set = { ${set} }, swapped = {}, done = { ${doneLua} }, at = ${at} } }, weeks = {}, streak = 1, best = 1 } },
    ${club !== undefined ? `settings = { clubId = ${club}, clubName = "The Guild" },` : "settings = {},"} }`);
}

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = openDatabase(path.join(dir, "test.sqlite"));
  updateBotSettings(db, { doomsdayBoard: true, doomsdayLadder: true }, ADMIN, T - 3600);
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const up = (bytes: Uint8Array, at: number, user = ADMIN): UploadResult => upload(db, bytes, user, at, ADMIN);
const boards = () =>
  db
    .select()
    .from(botEvents)
    .all()
    .filter((e) => e.type.startsWith("doomsday"));
const nicoToday = (at: number) =>
  doomsdayFor(db, at)
    ?.friends.find((f) => f.name === "Nico")
    ?.today?.goals.filter((g) => g.doneAt !== undefined).length;

describe("no community: left out (WEB-84)", () => {
  it("refuses the admin's file without a community before one is set: no site data, no Doomsday, no board", () => {
    const r = up(file(T + 600, 3), T + 600);
    expect(r).toMatchObject({ status: "rejected", rejection: { code: "other-community", none: true } });
    expect(r.reason).toBe("This file has no community: pick the community or guild in the addon, then upload again.");
    expect(loadState(db)).toBeUndefined();
    expect(db.select().from(doomsdayGoals).all()).toEqual([]);
    expect(db.select().from(members).all()).toEqual([]);
    expect(communityState(db, ADMIN)).toEqual({});
    expect(doomsdayFor(db, T + 700)).toBeUndefined();
    runDueDoomsday(db, T + 700);
    runDueDoomsday(db, T + 86400 + 60);
    expect(boards()).toEqual([]);
    // The history and the report say why.
    expect(listUploads(db, 20, ADMIN)[0]).toMatchObject({ rejection: "other-community", none: true });
    expect(getUpload(db, r.id, ADMIN)).toMatchObject({ rejection: "other-community", none: true });
  });

  it("refuses the admin's file without a community once one is set, and keeps what came before", () => {
    expect(up(file(T + 600, 1, GUILD), T + 600).status).toBe("ok");
    const before = db.select().from(doomsdayGoals).all();
    const r = up(file(T + 900, 3), T + 900);
    expect(r.rejection).toEqual({ code: "other-community", none: true });
    expect(db.select().from(doomsdayGoals).all()).toEqual(before);
    expect(nicoToday(T + 1000)).toBe(1);
    expect(communityState(db, ADMIN).id).toBe(String(GUILD));
  });

  it("refuses a friend's file without a community too", () => {
    expect(up(file(T + 600, 0, GUILD), T + 600).status).toBe("ok");
    db.insert(members).values({ key: "ada#1001", battleTag: "Ada#1001", firstUpload: 1 }).run();
    const r = up(file(T + 700, 2, undefined, "Ada#1001", "Ada"), T + 700, "Ada#1001");
    expect(r.rejection).toEqual({ code: "other-community", none: true });
    expect(doomsdayFor(db, T + 800)?.friends.map((f) => f.name)).toEqual(["Nico"]);
  });
});

describe("a community picked later the same day (WEB-84)", () => {
  it("counts that day's progress from the first file with the community", () => {
    expect(up(file(T + 600, 2), T + 600).status).toBe("rejected");
    expect(doomsdayFor(db, T + 700)).toBeUndefined();
    // Later that day the guild is picked in the addon; the same day's goals come along.
    expect(up(file(T + 3600, 3, GUILD), T + 3600).status).toBe("ok");
    expect(nicoToday(T + 3700)).toBe(3);
    runDueDoomsday(db, T + 86400 + 60);
    expect(boards().length).toBeGreaterThan(0);
  });

  it("takes the very same file again once the community is picked (a file refused for the community is retried)", () => {
    const bytes = file(T + 600, 2);
    expect(up(bytes, T + 600).status).toBe("rejected");
    // Still no community in the file: still refused, never taken on a retry.
    expect(up(bytes, T + 700).rejection).toEqual({ code: "other-community", none: true });
    expect(loadState(db)).toBeUndefined();
  });
});

describe("an old database (WEB-84)", () => {
  /** What a site before WEB-84 stored for the admin's file without a community: accepted, with its goals. */
  function acceptedTheOldWay(bytes: Uint8Array, at: number): number {
    const { id } = up(bytes, at);
    const goals = readAllGoals(parseLua(new TextDecoder().decode(bytes)));
    db.transaction((tx) => recordGoals(tx, goals, id));
    db.update(uploads).set({ status: "ok", rejection: null, reason: null }).where(eq(uploads.id, id)).run();
    return id;
  }

  it("refuses the admin's file without a community again at start, once, and keeps the community's files", () => {
    const old = acceptedTheOldWay(file(T + 600, 3), T + 600);
    expect(db.select().from(doomsdayGoals).all().length).toBeGreaterThan(0);
    expect(up(file(T + 3600, 1, GUILD), T + 3600).status).toBe("ok");

    expect(rebuildUploadsWithoutCommunity(db, ADMIN)).toBe(true);
    expect(getUpload(db, old, ADMIN)).toMatchObject({ status: "rejected", rejection: "other-community", none: true });
    // Only the guild file's goals count now.
    expect(nicoToday(T + 3700)).toBe(1);
    expect(communityState(db, ADMIN).id).toBe(String(GUILD));
    // Nothing left to repair: the next start changes nothing.
    expect(rebuildUploadsWithoutCommunity(db, ADMIN)).toBe(false);
  });

  it("leaves a database without such uploads alone, beta uploads before the cut-off too", () => {
    expect(rebuildUploadsWithoutCommunity(db, ADMIN)).toBe(false);
    acceptedTheOldWay(file(T - 86400, 0), T - 86400);
    storeCutoff(db, T, ADMIN, T);
    expect(up(file(T + 600, 1, GUILD), T + 600).status).toBe("ok");
    // The beta upload of no community is before the cut-off: it isn't read for Doomsday, so no rebuild.
    expect(rebuildUploadsWithoutCommunity(db, ADMIN)).toBe(false);
  });
});
