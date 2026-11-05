import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { currentRole, listMembers } from "@/server/access";
import { openDatabase, type Db } from "@/server/db";
import { doomsdayGoals, doomsdayStatus, feedDays } from "@/server/db/schema";
import { loadState, rebuild, upload } from "@/server/uploads";

// WEB-86: Ves runs the addon in the guild but is nobody's Battle.net friend, so files store them as "aid:0a1b". They
// show by their first character's name. A later file (the addon's CF-90 shares each player's BattleTag over the guild)
// keys them by BattleTag with their account ID: one person from then on, with their history, and a member (WEB-85).

const ADMIN = "Nico#1000";
const lua = (body: string) => new TextEncoder().encode(`return { schemaVersion = 1, ${body} }`);
const roster = `members = { N = { name = "Nico Example", seenAt = 100 }, V = { name = "Ves Doombringer", seenAt = 100 } },`;

/** Nico's file before CF-90: Ves under the aid: key, with a feed day and Doomsday goals. */
const before = (v: number) =>
  lua(`
    self = { battleTag = "${ADMIN}", version = ${v}, chars = { N = { name = "Nico Example", updatedAt = ${v} } } },
    people = { ["aid:0a1b"] = { version = 1, chars = { V = { name = "Ves Doombringer", updatedAt = 1 } },
      feed = { [20744] = { V = { at = 10, levelFrom = 1, levelTo = 2 } } },
      goals = { days = { [20744] = { set = { "d.level" }, done = {}, at = 10 } }, weeks = {}, streak = 1 } } },
    locations = { V = { zone = "Durotar", seenAt = 5 } },
    settings = { clubId = 7 },
    ${roster}
  `);
/** Nico's file after CF-90: Ves by BattleTag, carrying their account ID, with a newer goal for the same day. */
const after = (v: number) =>
  lua(`
    self = { battleTag = "${ADMIN}", version = ${v}, chars = { N = { name = "Nico Example", updatedAt = ${v} } } },
    people = { ["Ves#4321"] = { aid = "0a1b", version = 2, chars = { V = { name = "Ves Doombringer", updatedAt = 2 } },
      feed = { [20745] = { V = { at = 20, levelFrom = 2, levelTo = 3 } } },
      goals = { days = { [20744] = { set = { "d.level" }, done = { "d.level" }, at = 20 } }, weeks = {}, streak = 2 } } },
    settings = { clubId = 7 },
    ${roster}
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

const up = (file: Uint8Array, now: number) => upload(db, file, ADMIN, now, ADMIN);
const people = () =>
  Object.values(loadState(db)?.data.people ?? {})
    .map((p) => [p.key, p.displayName])
    .sort();
const history = () => ({
  feed: db
    .select({ owner: feedDays.owner, day: feedDays.day })
    .from(feedDays)
    .all()
    .map((r) => `${r.owner} ${r.day}`)
    .sort(),
  goals: db
    .select({ owner: doomsdayGoals.owner, at: doomsdayGoals.at })
    .from(doomsdayGoals)
    .all()
    .map((r) => `${r.owner} ${r.at}`),
  status: db
    .select({ owner: doomsdayStatus.owner, streak: doomsdayStatus.streak })
    .from(doomsdayStatus)
    .all()
    .map((r) => `${r.owner} ${r.streak}`)
    .sort(),
});

describe("a guild member known only by account ID", () => {
  it("shows by character name, then a later file links their BattleTag and they become a member", () => {
    expect(up(before(1), 1000).status).toBe("ok");
    expect(people()).toEqual([
      [ADMIN, "Nico"],
      ["aid:0a1b", "Ves Doombringer"],
    ]);
    expect(loadState(db)?.data.characters.V?.owner).toBe("aid:0a1b");
    // No BattleTag to sign in with: no access yet.
    expect(listMembers(db).map((m) => m.battleTag)).toEqual([ADMIN]);
    expect(history()).toEqual({
      feed: ["aid:0a1b 20744"],
      goals: ["aid:0a1b 10"],
      status: ["aid:0a1b 1"],
    });

    expect(up(after(2), 2000).status).toBe("ok");
    expect(people()).toEqual([
      [ADMIN, "Nico"],
      ["Ves#4321", "Ves"],
    ]);
    expect(loadState(db)?.data.characters.V?.owner).toBe("Ves#4321");
    expect(currentRole(db, "Ves#4321", ADMIN)).toBe("member");
    // Their history moved over: one row per day and period, the newer goal kept.
    expect(history()).toEqual({
      feed: ["Ves#4321 20744", "Ves#4321 20745"],
      goals: ["Ves#4321 20"],
      status: ["Ves#4321 2"],
    });

    // An older file keyed by aid: afterwards changes nothing, and a rebuild comes to the same.
    expect(up(before(3), 3000).status).toBe("ok");
    expect(people()).toEqual([
      [ADMIN, "Nico"],
      ["Ves#4321", "Ves"],
    ]);
    expect(history()).toEqual({
      feed: ["Ves#4321 20744", "Ves#4321 20745"],
      goals: ["Ves#4321 20"],
      status: ["Ves#4321 2"],
    });
    rebuild(db, ADMIN);
    expect(people()).toEqual([
      [ADMIN, "Nico"],
      ["Ves#4321", "Ves"],
    ]);
    expect(history()).toEqual({
      feed: ["Ves#4321 20744", "Ves#4321 20745"],
      goals: ["Ves#4321 20"],
      status: ["Ves#4321 2"],
    });
    expect(currentRole(db, "Ves#4321", ADMIN)).toBe("member");
  });
});
