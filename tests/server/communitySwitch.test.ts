import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canonical } from "@/core/merge";
import { currentRole, putGuest, touchLastSeen } from "@/server/access";
import { appointAdmin, listLog, OwnerOnlyError } from "@/server/admins";
import { latestSwitch, listSwitches } from "@/server/communitySwitch";
import { storeCutoff } from "@/server/cutoff";
import { openDatabase, type Db } from "@/server/db";
import { communitySwitches, doomsdayGoals, feats, feedDays, sightings, uploads } from "@/server/db/schema";
import {
  communityState,
  getUpload,
  listUploads,
  loadState,
  rebuild,
  switchCommunity,
  undoSwitchCommunity,
  upload,
  type UploadResult,
} from "@/server/uploads";

// WEB-83: the owner moves the site to another in-game community (the guild at launch, a real community later)
// without hiding anything. A switch makes the community "not set"; the owner's next upload sets the new one.

const OWNER = "Nico#1000";
const T0 = 1_794_000_000;
/** Two days later: the community era, so its feed days are other days than the guild's. */
const LATER = T0 + 2 * 86400;
const GUILD = 11;
const COMMUNITY = 22;
const day = (t: number) => Math.floor(t / 86400);

/** Someone's own file of community `club`, with one character (`guid`) played at `at`, a feed day and a goal. */
function file(tag: string, name: string, club: number, guid: string, at: number, level = 10) {
  return new TextEncoder().encode(`return { schemaVersion = 2,
    self = { battleTag = "${tag}", displayName = "${name}", version = ${at}, chars = {
      ${guid} = { name = "${name} Example", classFile = "WARRIOR", level = ${level}, updatedAt = ${at}, lastPlayed = ${at} } },
      feed = { [${day(at)}] = { ${guid} = { at = ${at}, levelFrom = ${level - 1}, levelTo = ${level} } } },
      goals = { days = { [${day(at)}] = { set = { "d.quests10" }, done = { ["d.quests10"] = ${at} }, at = ${at} } }, weeks = {} } },
    locations = { ${guid} = { zone = "Duskwood", seenAt = ${at} } },
    settings = { clubId = ${club}, clubName = "${club === GUILD ? "The Guild" : "The Community"}" } }`);
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

const up = (bytes: Uint8Array, user: string, at: number): UploadResult => upload(db, bytes, user, at, OWNER);
const code = (r: UploadResult) => r.rejection?.code ?? r.status;
const statuses = () => db.select({ s: uploads.status, r: uploads.rejection }).from(uploads).orderBy(uploads.id).all();
const derived = () => ({
  state: canonical(loadState(db)?.data),
  feed: db.select().from(feedDays).all().length,
  goals: db.select().from(doomsdayGoals).all().length,
  sightings: db.select().from(sightings).all().length,
  feats: db.select().from(feats).all().length,
});

/** The guild era: the owner and Ada upload from the guild; Ada is a member. */
function guildEra() {
  expect(code(up(file(OWNER, "Nico", GUILD, "N1", T0), OWNER, T0))).toBe("ok");
  // The owner's file names nobody else, so Ada and Bob are guests who may upload.
  putGuest(db, "Ada#1001", true, OWNER, T0);
  putGuest(db, "Bob#2002", true, OWNER, T0);
  expect(code(up(file("Ada#1001", "Ada", GUILD, "A1", T0 + 10), "Ada#1001", T0 + 10))).toBe("ok");
}

describe("switching the community (WEB-83)", () => {
  it("guild → switch → the owner's community upload: guild files refused, community files taken, guild history kept", () => {
    guildEra();
    expect(communityState(db, OWNER)).toEqual({ id: String(GUILD), name: "The Guild" });
    const before = derived();

    expect(switchCommunity(db, OWNER, T0 + 100, OWNER)).toBe(true);
    // Nothing is hidden by the switch itself.
    expect(derived()).toEqual(before);
    expect(communityState(db, OWNER).pending).toMatchObject({ setBy: OWNER, setAt: T0 + 100 });

    // Until the owner uploads, friends wait: "no community yet", from either community.
    const bobEarly = file("Bob#2002", "Bob", COMMUNITY, "B1", LATER + 150);
    expect(code(up(bobEarly, "Bob#2002", LATER + 150))).toBe("no-community-yet");
    expect(code(up(file("Ada#1001", "Ada", GUILD, "A1", LATER + 160, 11), "Ada#1001", LATER + 160))).toBe(
      "no-community-yet",
    );

    // The owner's upload from the community sets it.
    expect(code(up(file(OWNER, "Nico", COMMUNITY, "N1", LATER + 200, 11), OWNER, LATER + 200))).toBe("ok");
    expect(communityState(db, OWNER)).toEqual({ id: String(COMMUNITY), name: "The Community" });

    // A friend still on the guild is refused; one on the community is taken, also when sending the same file again.
    expect(code(up(file("Ada#1001", "Ada", GUILD, "A1", LATER + 300, 12), "Ada#1001", LATER + 300))).toBe(
      "other-community",
    );
    expect(code(up(bobEarly, "Bob#2002", LATER + 310))).toBe("ok");
    expect(code(up(file("Ada#1001", "Ada", COMMUNITY, "A1", LATER + 320, 12), "Ada#1001", LATER + 320))).toBe("ok");

    // The guild's history is all still there: characters, feed days, Doomsday goals, sightings, members.
    const state = loadState(db)?.data;
    expect(Object.keys(state?.characters ?? {}).sort()).toEqual(["A1", "B1", "N1"]);
    const feedDaysFromGuild = db
      .select({ upload: feedDays.sourceUpload })
      .from(feedDays)
      .all()
      .filter((r) => r.upload === 1 || r.upload === 2);
    // Both guild-era feed days (the owner's and Ada's), from the guild uploads.
    expect(feedDaysFromGuild).toHaveLength(2);
    expect(db.select().from(doomsdayGoals).all().length).toBeGreaterThanOrEqual(before.goals);
    expect(currentRole(db, "Ada#1001", OWNER)).toBeDefined();

    // A rebuild gives the same statuses and the same data.
    const after = { statuses: statuses(), derived: derived() };
    rebuild(db, OWNER);
    expect({ statuses: statuses(), derived: derived() }).toEqual(after);
    expect(statuses().map((s) => s.r ?? s.s)).toEqual([
      // Bob's early file was replaced by the same file sent again (taken).
      "ok",
      "ok",
      "no-community-yet",
      "ok",
      "other-community",
      "ok",
      "ok",
    ]);
  });

  it("keeps the guild uploads in the rebuild: they count as they did before the switch", () => {
    guildEra();
    const guild = derived();
    switchCommunity(db, OWNER, T0 + 100, OWNER);
    rebuild(db, OWNER);
    expect(derived()).toEqual(guild);
    expect(statuses().map((s) => s.s)).toEqual(["ok", "ok"]);
  });

  it("is the owner's only: admins and members are refused and nothing changes", () => {
    guildEra();
    touchLastSeen(db, "Ada#1001", T0);
    appointAdmin(db, "Ada#1001", OWNER, T0 + 20, OWNER);
    expect(currentRole(db, "Ada#1001", OWNER)).toBe("admin");
    expect(() => switchCommunity(db, "Ada#1001", T0 + 100, OWNER)).toThrow(OwnerOnlyError);
    expect(() => switchCommunity(db, "Bob#2002", T0 + 100, OWNER)).toThrow(OwnerOnlyError);
    expect(listSwitches(db)).toEqual([]);
    switchCommunity(db, OWNER, T0 + 100, OWNER);
    expect(() => undoSwitchCommunity(db, "Ada#1001", T0 + 110, OWNER)).toThrow(OwnerOnlyError);
    expect(listSwitches(db)).toHaveLength(1);
  });

  it("logs the switch and its undo in Admin changes", () => {
    guildEra();
    switchCommunity(db, OWNER, T0 + 100, OWNER);
    undoSwitchCommunity(db, OWNER, T0 + 110, OWNER);
    expect(listLog(db).map((e) => [e.by, e.action])).toEqual([
      [OWNER, "communitySwitchUndone"],
      [OWNER, "communitySwitched"],
    ]);
  });

  it("does nothing while the community isn't set (a new site, or a switch waiting for the owner)", () => {
    expect(switchCommunity(db, OWNER, T0, OWNER)).toBe(false);
    guildEra();
    expect(switchCommunity(db, OWNER, T0 + 100, OWNER)).toBe(true);
    expect(switchCommunity(db, OWNER, T0 + 110, OWNER)).toBe(false);
    expect(listSwitches(db)).toHaveLength(1);
  });

  it("Undo before the owner's next upload: the switch goes, and files refused meanwhile count again", () => {
    guildEra();
    switchCommunity(db, OWNER, T0 + 100, OWNER);
    expect(code(up(file("Ada#1001", "Ada", GUILD, "A1", T0 + 160, 11), "Ada#1001", T0 + 160))).toBe("no-community-yet");
    expect(undoSwitchCommunity(db, OWNER, T0 + 170, OWNER)).toBe(true);
    expect(latestSwitch(db)).toBeUndefined();
    expect(communityState(db, OWNER)).toEqual({ id: String(GUILD), name: "The Guild" });
    expect(statuses().map((s) => s.s)).toEqual(["ok", "ok", "ok"]);
    expect(loadState(db)?.data.characters.A1?.level).toBe(11);
  });

  it("offers no Undo once the owner has uploaded from the new community", () => {
    guildEra();
    switchCommunity(db, OWNER, T0 + 100, OWNER);
    up(file(OWNER, "Nico", COMMUNITY, "N1", T0 + 200, 11), OWNER, T0 + 200);
    expect(communityState(db, OWNER).pending).toBeUndefined();
    expect(undoSwitchCommunity(db, OWNER, T0 + 210, OWNER)).toBe(false);
    expect(listSwitches(db)).toHaveLength(1);
  });

  it("switches again later (community → another), each switch applying to the uploads after it on rebuild", () => {
    guildEra();
    switchCommunity(db, OWNER, T0 + 100, OWNER);
    up(file(OWNER, "Nico", COMMUNITY, "N1", T0 + 200, 11), OWNER, T0 + 200);
    switchCommunity(db, OWNER, T0 + 300, OWNER);
    expect(code(up(file(OWNER, "Nico", 33, "N1", T0 + 400, 12), OWNER, T0 + 400))).toBe("ok");
    expect(code(up(file("Ada#1001", "Ada", COMMUNITY, "A1", T0 + 410, 12), "Ada#1001", T0 + 410))).toBe(
      "other-community",
    );
    const live = { statuses: statuses(), derived: derived() };
    rebuild(db, OWNER);
    expect({ statuses: statuses(), derived: derived() }).toEqual(live);
    expect(loadState(db)?.data.characters.N1?.level).toBe(12);
  });

  it("still holds the owner to the community without a switch (WEB-74)", () => {
    guildEra();
    expect(code(up(file(OWNER, "Nico", COMMUNITY, "N1", T0 + 200, 11), OWNER, T0 + 200))).toBe("other-community");
  });

  it("works with the launch cut-off: a cut-off after a switch starts the community anew as before", () => {
    guildEra();
    switchCommunity(db, OWNER, T0 + 100, OWNER);
    up(file(OWNER, "Nico", COMMUNITY, "N1", T0 + 200, 11), OWNER, T0 + 200);
    storeCutoff(db, T0 + 300, OWNER, T0 + 300);
    rebuild(db, OWNER);
    expect(communityState(db, OWNER).id).toBeUndefined();
    expect(code(up(file(OWNER, "Nico", GUILD, "N1", T0 + 400, 12), OWNER, T0 + 400))).toBe("ok");
  });
});

describe("the refusal's words after a switch (WEB-83)", () => {
  it("says 'first upload' before the owner's first upload, 'next upload' after a switch, live and on rebuild", () => {
    putGuest(db, "Ada#1001", true, OWNER, T0);
    const first = up(file("Ada#1001", "Ada", GUILD, "A1", T0 - 10), "Ada#1001", T0 - 10);
    expect(first.rejection).toEqual({ code: "no-community-yet" });
    expect(first.reason).toBe("The admin has not uploaded yet; until then only the admin can upload.");
    up(file(OWNER, "Nico", GUILD, "N1", T0), OWNER, T0);
    switchCommunity(db, OWNER, T0 + 100, OWNER);
    const waiting = up(file("Ada#1001", "Ada", GUILD, "A1", T0 + 160, 11), "Ada#1001", T0 + 160);
    expect(waiting.rejection).toEqual({ code: "no-community-yet", next: true });
    expect(waiting.reason).toBe("The admin has not uploaded from the new community yet; upload again after that.");
    const lines = () => listUploads(db, 20, OWNER).map((u) => [u.id, u.rejection ?? null, u.next ?? false]);
    const expected = [
      [waiting.id, "no-community-yet", true],
      [2, null, false],
      [first.id, "no-community-yet", false],
    ];
    expect(lines()).toEqual(expected);
    expect(getUpload(db, waiting.id, OWNER)?.next).toBe(true);
    rebuild(db, OWNER);
    expect(lines()).toEqual(expected);
    const reasons = db.select({ reason: uploads.reason }).from(uploads).orderBy(uploads.id).all();
    expect(reasons.map((r) => r.reason)).toEqual([first.reason, null, waiting.reason]);
  });
});

describe("an old database without switches (rule 4: WEB-83 adds only a table)", () => {
  it("reads the community and rebuilds exactly as before", () => {
    guildEra();
    expect(db.select().from(communitySwitches).all()).toEqual([]);
    const live = { statuses: statuses(), derived: derived() };
    rebuild(db, OWNER);
    expect({ statuses: statuses(), derived: derived() }).toEqual(live);
    expect(communityState(db, OWNER)).toEqual({ id: String(GUILD), name: "The Guild" });
    expect(code(up(file("Bob#2002", "Bob", COMMUNITY, "B1", T0 + 50), "Bob#2002", T0 + 50))).toBe("other-community");
  });
});
