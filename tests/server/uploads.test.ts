import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonical } from "@/core/merge";
import { dataDir, openDatabase, type Db } from "@/server/db";
import { characters, locations, people, uploads } from "@/server/db/schema";
import {
  displayNames,
  getUpload,
  listUploads,
  loadState,
  MAX_UPLOAD_BYTES,
  rebuild,
  upload,
  UploadTooLargeError,
} from "@/server/uploads";

const fixture = (p: string) => readFileSync(new URL(`../fixtures/${p}`, import.meta.url));
const lua = (body: string) => new TextEncoder().encode(`return { schemaVersion = 1, ${body} }`);

let dir: string;
let db: Db;

beforeEach(() => {
  // Ada is the admin: these tests are about storing and merging, tests/server/access.test.ts about who may upload.
  vi.stubEnv("ADMIN_BATTLETAG", "Ada#1001");
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = openDatabase(path.join(dir, "test.sqlite"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Derived tables as comparable text. */
function derived(d: Db): string {
  return canonical({
    state: loadState(d)?.data,
    characters: d.select().from(characters).orderBy(characters.guid).all(),
    locations: d.select().from(locations).orderBy(locations.guid).all(),
  });
}

const day1 = lua(`
  self = { battleTag = "Ada#1001", version = 100, chars = {
    A = { name = "Ada Example", level = 10, updatedAt = 100, professions = { [186] = { name = "Mining", rank = 50, max = 75 } } },
    Old = { name = "Old Alt", level = 5, updatedAt = 90 },
    Same = { name = "Same Alt", level = 7, updatedAt = 80 } } },
  locations = { A = { zone = "Durotar", seenAt = 100 } },
  settings = { clubId = 1, clubName = "Friends" },
`);
const day2 = lua(`
  self = { battleTag = "Ada#1001", version = 200, chars = {
    A = { name = "Ada Example", level = 12, updatedAt = 200,
          professions = { [186] = { name = "Mining", rank = 80, max = 150 }, [185] = { name = "Cooking", rank = 1, max = 75 } } },
    Same = { name = "Same Alt", level = 7, updatedAt = 80 } } },
  presence = { B = { battleTag = "Bob#2002", lastSeen = 190 } },
  locations = { A = { zone = "The Barrens", seenAt = 200 }, B = { zone = "Mulgore", seenAt = 190 } },
`);

describe("database", () => {
  it("reads DATA_DIR, by default a folder next to the repo (not in it: next dev watches the project)", () => {
    expect(dataDir({})).toBe("../CommunitiesForever-Web-data");
    expect(dataDir({ DATA_DIR: "/data" })).toBe("/data");
  });

  it("migrates a file opened again without changes", () => {
    upload(db, day1, "Ada#1001", 1000);
    db.$client.close();
    db = openDatabase(path.join(dir, "test.sqlite"));
    expect(db.select().from(uploads).all()).toHaveLength(1);
  });
});

describe("upload", () => {
  it("stores the raw file and fills the derived tables", () => {
    const file = fixture("real/beta-2026-10.lua");
    const result = upload(db, file, "Ada#1001", 1000);
    expect(result).toMatchObject({ id: 1, status: "ok", duplicate: false });
    expect(result.summary?.newPeople.map((p) => p.key)).toEqual([
      "Ada#1001",
      "Bob#2002",
      "Cleo#3003",
      "Dax#4004",
      "Esme#5005",
      "Finn#6006",
    ]);
    expect(result.summary?.newCharacters).toHaveLength(7);

    const row = db.select().from(uploads).get();
    expect(row).toMatchObject({ uploadedAt: 1000, uploadedBy: "Ada#1001", size: file.byteLength, status: "ok" });
    expect(row?.schemaVersion).toBe(1);
    expect(row?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(gunzipSync(row!.raw).equals(file)).toBe(true);
    expect(row?.summary).toEqual(result.summary);

    expect(db.select().from(people).all()).toHaveLength(6);
    const own = db.select().from(characters).where(eq(characters.guid, "Player-6842-0000A001")).get();
    expect(own).toMatchObject({ owner: "Ada#1001", updatedAt: 1792614961, sourceUpload: 1, via: null });
    expect(own?.data.mainTreeName).toBe("Affliction");
  });

  it("treats the same file again as a no-op", () => {
    const first = upload(db, day1, "Ada#1001", 1000);
    const before = derived(db);
    const again = upload(db, day1, "Ada#1001", 2000);
    expect(again).toEqual({ ...first, duplicate: true });
    expect(db.select().from(uploads).all()).toHaveLength(1);
    expect(derived(db)).toBe(before);
  });

  it("stores a file that does not parse as rejected and changes nothing else", () => {
    upload(db, day1, "Ada#1001", 1000);
    const before = derived(db);
    const result = upload(db, new TextEncoder().encode("CommunitiesForeverDB = {\n  oops\n"), "Ada#1001", 2000);
    expect(result).toMatchObject({ id: 2, status: "rejected", duplicate: false, unreadable: "damaged" });
    expect(result.reason).toMatch(/^line 2, column 3: /);
    expect(db.select().from(uploads).where(eq(uploads.id, 2)).get()).toMatchObject({
      status: "rejected",
      reason: result.reason,
      schemaVersion: null,
      summary: null,
    });
    expect(derived(db)).toBe(before);
  });

  it("stores a newer schema as rejected with its version", () => {
    const result = upload(db, new TextEncoder().encode("return { schemaVersion = 3 }"), "Ada#1001", 1000);
    expect(result.reason).toContain("schema version 3");
    expect(result).toMatchObject({ unreadable: "newer-format", schemaVersion: 3 });
    expect(db.select().from(uploads).get()).toMatchObject({
      status: "rejected",
      schemaVersion: 3,
      unreadable: "newer-format",
    });
    expect(loadState(db)).toBeUndefined();
  });

  it("refuses a file over the limit without storing it", () => {
    expect(() => upload(db, new Uint8Array(MAX_UPLOAD_BYTES + 1), "Ada#1001")).toThrow(UploadTooLargeError);
    expect(db.select().from(uploads).all()).toHaveLength(0);
  });

  it("merges a later upload and summarizes what changed", () => {
    upload(db, day1, "Ada#1001", 1000);
    const result = upload(db, day2, "Ada#1001", 2000);
    expect(result.summary).toEqual({
      newPeople: [{ key: "Bob#2002", displayName: "Bob" }],
      newCharacters: [{ guid: "B", owner: "Bob#2002", hasRecord: false }],
      removedCharacters: [{ guid: "Old", owner: "Ada#1001", name: "Old Alt" }],
      levelUps: [{ guid: "A", owner: "Ada#1001", name: "Ada Example", from: 10, to: 12 }],
      professionGains: [
        {
          guid: "A",
          owner: "Ada#1001",
          name: "Ada Example",
          skillLine: "185",
          profession: "Cooking",
          to: 1,
          max: 75,
          capReached: false,
        },
        {
          guid: "A",
          owner: "Ada#1001",
          name: "Ada Example",
          skillLine: "186",
          profession: "Mining",
          from: 50,
          to: 80,
          max: 150,
          capReached: false,
        },
      ],
      itemLevelGains: [],
      sightings: [
        {
          guid: "A",
          owner: "Ada#1001",
          name: "Ada Example",
          zone: "The Barrens",
          seenAt: 200,
          previousZone: "Durotar",
        },
        { guid: "B", owner: "Bob#2002", zone: "Mulgore", seenAt: 190 },
      ],
      senders: [
        { key: "Ada#1001", displayName: "Ada", isUploader: true, status: "newer", dataAt: 200 },
        { key: "Bob#2002", displayName: "Bob", isUploader: false, status: "noAddon" },
      ],
      counts: {
        levelsGained: 2,
        skillGains: 2,
        itemLevelGains: 0,
        newCharacters: 1,
        sightings: 2,
        peopleWithNewData: 1,
      },
    });
    const sources = Object.fromEntries(
      db
        .select()
        .from(characters)
        .all()
        .map((c) => [c.guid, c.sourceUpload]),
    );
    expect(sources).toEqual({ A: 2, B: 2, Same: 1 });
    expect(loadState(db)?.data.community).toEqual({ id: "1", name: "Friends" });
  });

  it("does not bring a removed character back from an older file uploaded later", () => {
    upload(db, day2, "Ada#1001", 1000);
    upload(db, day1, "Ada#1001", 2000);
    expect(Object.keys(loadState(db)!.data.characters).sort()).toEqual(["A", "B", "Same"]);
  });
});

describe("rebuild", () => {
  it("recomputes the same derived state and summaries as uploading one by one", () => {
    upload(db, fixture("addon/v0.3/savedvariables.lua"), "Ada#1001", 1000);
    upload(db, fixture("addon/v0.4/savedvariables.lua"), "Ada#1001", 1001);
    upload(db, day1, "Ada#1001", 1002);
    upload(db, day2, "Ada#1001", 1003);
    const state = derived(db);
    const rows = canonical(db.select().from(uploads).all());

    expect(rebuild(db)).toEqual({ ok: 4, rejected: 0 });
    expect(derived(db)).toBe(state);
    expect(canonical(db.select().from(uploads).all())).toBe(rows);
  });

  it("reads rejected uploads again", () => {
    upload(db, day1, "Ada#1001", 1000);
    // As if the file had been rejected by an older site version.
    db.update(uploads).set({ status: "rejected", reason: "old site", summary: null }).run();
    expect(rebuild(db)).toEqual({ ok: 1, rejected: 0 });
    expect(db.select().from(uploads).get()).toMatchObject({ status: "ok", reason: null });
    expect(loadState(db)?.data.characters.A?.level).toBe(10);
  });

  it("empties the derived tables when no upload is ok", () => {
    upload(db, new TextEncoder().encode("nonsense"), "Ada#1001", 1000);
    expect(rebuild(db)).toEqual({ ok: 0, rejected: 1 });
    expect(loadState(db)).toBeUndefined();
  });
});

describe("upload screen (WEB-19)", () => {
  it("marks another addon's file as not our ledger", () => {
    const result = upload(db, new TextEncoder().encode("QuestieConfig = { global = {} }"), "Ada#1001", 1000);
    expect(result).toMatchObject({ status: "rejected", unreadable: "not-ledger", uploadedAt: 1000 });
  });

  it("gives a duplicate the earlier upload's time and an accepted upload the uploader's previous one", () => {
    const first = upload(db, day1, "Ada#1001", 1000);
    expect(first.previousUploadAt).toBeUndefined();
    expect(upload(db, day1, "Ada#1001", 1500)).toMatchObject({ duplicate: true, uploadedAt: 1000 });
    expect(upload(db, day2, "Ada#1001", 2000)).toMatchObject({ uploadedAt: 2000, previousUploadAt: 1000 });
  });

  it("names the owner again for a duplicate that was not the uploader's file", () => {
    upload(db, day1, "Ada#1001", 1000);
    vi.stubEnv("ADMIN_BATTLETAG", "Bob#2002");
    const first = upload(db, day1, "Bob#2002", 1100);
    expect(first.rejection).toEqual({ code: "not-your-file", owner: "Ada#1001" });
    expect(upload(db, day1, "Bob#2002", 1200)).toMatchObject({
      duplicate: true,
      rejection: { code: "not-your-file", owner: "Ada#1001" },
    });
  });

  it("lists everyone's uploads newest first, marking the first accepted one", () => {
    upload(db, new TextEncoder().encode("nope"), "Ada#1001", 900);
    upload(db, day1, "Ada#1001", 1000);
    upload(db, day2, "Ada#1001", 2000);
    const list = listUploads(db);
    expect(list.map((u) => [u.id, u.status, u.first])).toEqual([
      [3, "ok", false],
      [2, "ok", true],
      [1, "rejected", false],
    ]);
    expect(list[2]).toMatchObject({ uploadedBy: "Ada#1001", unreadable: "damaged" });
    expect(list[0]?.summary?.counts.levelsGained).toBe(2);
    expect(listUploads(db, 1)).toHaveLength(1);
    expect(getUpload(db, 2)).toEqual(list[1]);
    expect(getUpload(db, 99)).toBeUndefined();
  });

  it("keeps the unreadable reason through a rebuild", () => {
    upload(db, new TextEncoder().encode("return { schemaVersion = 3 }"), "Ada#1001", 1000);
    db.update(uploads).set({ unreadable: null }).run();
    rebuild(db);
    expect(getUpload(db, 1)).toMatchObject({ unreadable: "newer-format", schemaVersion: 3 });
  });

  it("knows display names by BattleTag", () => {
    upload(db, day1, "Ada#1001", 1000);
    expect(displayNames(db).get("ada#1001")).toBe("Ada");
  });
});
