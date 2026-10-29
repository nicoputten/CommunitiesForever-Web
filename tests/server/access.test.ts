import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AccessError,
  addGuest,
  block,
  currentRole,
  listBlocks,
  listGuests,
  listLastSeen,
  listMembers,
  putGuest,
  removeGuest,
  touchLastSeen,
  unblock,
} from "@/server/access";
import { loadAdminView } from "@/server/admin";
import { openDatabase, type Db } from "@/server/db";
import { uploads } from "@/server/db/schema";
import { loadState, rebuild, upload, UploadForbiddenError } from "@/server/uploads";

const ADMIN = "Nico#1000";
const lua = (body: string) => new TextEncoder().encode(`return { schemaVersion = 1, ${body} }`);
const own = (tag: string, club: number | undefined, extra = "") =>
  lua(
    `self = { battleTag = "${tag}", version = 1 }, ${club !== undefined ? `settings = { clubId = ${club} },` : ""} ${extra}`,
  );

const nicoFile = own(
  ADMIN,
  7,
  `presence = { B = { battleTag = "Bob#2002", lastSeen = 5 } }, people = { ["Ada#1001"] = { version = 1 } }`,
);

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

const up = (file: Uint8Array, user: string, now = 1000) => upload(db, file, user, now, ADMIN);
const role = (tag: string) => currentRole(db, tag, ADMIN);

describe("membership", () => {
  it("makes every BattleTag of an accepted upload a member", () => {
    expect(role("Bob#2002")).toBeUndefined();
    expect(up(nicoFile, ADMIN).status).toBe("ok");
    expect(listMembers(db).map((m) => m.battleTag)).toEqual(["Ada#1001", "Bob#2002", ADMIN]);
    expect(role("Bob#2002")).toBe("member");
    expect(role("ada#1001")).toBe("member");
    expect(role(ADMIN)).toBe("admin");
  });

  it("keeps a member who is gone from newer data", () => {
    up(nicoFile, ADMIN);
    up(own(ADMIN, 7, "people = {}"), ADMIN, 2000);
    expect(role("Bob#2002")).toBe("member");
  });

  it("adds no members from a rejected upload", () => {
    up(nicoFile, ADMIN);
    const r = up(own("Bob#2002", 8, `presence = { C = { battleTag = "Cleo#3003", lastSeen = 1 } }`), "Bob#2002");
    expect(r.status).toBe("rejected");
    expect(role("Cleo#3003")).toBeUndefined();
  });

  it("rebuilds members from the uploads", () => {
    up(nicoFile, ADMIN);
    up(own("Bob#2002", 7, `presence = { C = { battleTag = "Cleo#3003", lastSeen = 1 } }`), "Bob#2002");
    const before = listMembers(db);
    expect(rebuild(db, ADMIN)).toEqual({ ok: 2, rejected: 0 });
    expect(listMembers(db)).toEqual(before);
    expect(before.find((m) => m.battleTag === "Cleo#3003")?.firstUpload).toBe(2);
  });
});

describe("upload rules", () => {
  it("lets only the admin upload before the admin's first upload", () => {
    putGuest(db, "Gwen#4004", true, ADMIN);
    const r = up(own("Gwen#4004", 7), "Gwen#4004");
    expect(r).toMatchObject({ status: "rejected", rejection: { code: "no-community-yet" } });
    expect(up(nicoFile, ADMIN).status).toBe("ok");
    expect(up(own("Gwen#4004", 7), "Gwen#4004", 1001).status).toBe("ok");
  });

  it("refuses, and stores nothing, from someone who may not upload", () => {
    up(nicoFile, ADMIN);
    putGuest(db, "Gus#3003", false, ADMIN);
    expect(() => up(own("Gus#3003", 7), "Gus#3003")).toThrow(UploadForbiddenError);
    expect(() => up(own("Eve#6666", 7), "Eve#6666")).toThrow(UploadForbiddenError);
    block(db, "Bob#2002", ADMIN, 1000, ADMIN);
    expect(() => up(own("Bob#2002", 7), "Bob#2002")).toThrow(UploadForbiddenError);
    expect(db.select().from(uploads).all()).toHaveLength(1);
  });

  it("rejects someone else's file as not your file, and changes nothing", () => {
    up(nicoFile, ADMIN);
    const before = loadState(db)?.data;
    const r = up(own("Ada#1001", 7, `presence = { X = { battleTag = "Xan#9009", lastSeen = 1 } }`), "Bob#2002");
    expect(r).toMatchObject({ status: "rejected", rejection: { code: "not-your-file", owner: "Ada#1001" } });
    expect(r.reason).toContain("Ada#1001");
    expect(loadState(db)?.data).toEqual(before);
    expect(role("Xan#9009")).toBeUndefined();
  });

  it("rejects a file of another community", () => {
    up(nicoFile, ADMIN);
    const r = up(own("Bob#2002", 8), "Bob#2002");
    expect(r).toMatchObject({ status: "rejected", rejection: { code: "other-community" } });
    expect(db.select().from(uploads).all()[1]).toMatchObject({ rejection: "other-community", community: "8" });
  });

  it("follows the community of the admin's newest upload", () => {
    up(nicoFile, ADMIN);
    up(own(ADMIN, 8, "people = {}"), ADMIN, 2000);
    expect(up(own("Bob#2002", 7), "Bob#2002").rejection).toEqual({ code: "other-community" });
    expect(up(own("Bob#2002", 8, "people = {}"), "Bob#2002").status).toBe("ok");
  });

  it("does not let a file rejected as someone else's block its owner", () => {
    up(nicoFile, ADMIN);
    const ada = own("Ada#1001", 7);
    expect(up(ada, "Bob#2002").status).toBe("rejected");
    expect(up(ada, "Ada#1001")).toMatchObject({ status: "ok", duplicate: false });
    expect(up(ada, "Ada#1001")).toMatchObject({ status: "ok", duplicate: true });
    expect(up(ada, "Bob#2002")).toMatchObject({
      status: "rejected",
      duplicate: true,
      rejection: { code: "not-your-file" },
    });
  });

  it("gives the same statuses on rebuild", () => {
    up(nicoFile, ADMIN);
    up(own("Bob#2002", 7), "Bob#2002");
    up(own("Bob#2002", 8), "Bob#2002");
    up(own("Ada#1001", 7), "Bob#2002");
    const statuses = () =>
      db.select({ s: uploads.status, r: uploads.rejection }).from(uploads).orderBy(uploads.id).all();
    const before = statuses();
    expect(rebuild(db, ADMIN)).toEqual({ ok: 2, rejected: 2 });
    expect(statuses()).toEqual(before);
  });

  it("checks own file and community on rebuild for a file the site could not read before", () => {
    up(nicoFile, ADMIN);
    // As stored by an older site that could not read the file (e.g. a newer schema): rejected, checks not run yet.
    db.insert(uploads)
      .values({
        uploadedAt: 1100,
        uploadedBy: "Bob#2002",
        sha256: "x",
        size: 1,
        raw: gzipSync(own("Ada#1001", 7, `presence = { X = { battleTag = "Xan#9009", lastSeen = 1 } }`)),
        status: "rejected",
        reason: "This file is from a newer addon.",
      })
      .run();
    expect(rebuild(db, ADMIN)).toEqual({ ok: 1, rejected: 1 });
    expect(db.select().from(uploads).all()[1]).toMatchObject({ status: "rejected", rejection: "not-your-file" });
    expect(role("Xan#9009")).toBeUndefined();
  });
});

describe("blocks", () => {
  it("blocks at once and survives a rebuild", () => {
    up(nicoFile, ADMIN);
    expect(block(db, "bob#2002", ADMIN, 1500, ADMIN)).toEqual({
      battleTag: "bob#2002",
      blockedAt: 1500,
      blockedBy: ADMIN,
    });
    expect(role("Bob#2002")).toBeUndefined();
    rebuild(db, ADMIN);
    expect(role("Bob#2002")).toBeUndefined();
    expect(listMembers(db).find((m) => m.battleTag === "Bob#2002")).toMatchObject({ blocked: true });
    expect(listBlocks(db)).toHaveLength(1);
    expect(unblock(db, "Bob#2002")).toBe(true);
    expect(role("Bob#2002")).toBe("member");
  });

  it("never blocks the admin", () => {
    expect(() => block(db, "NICO#1000", ADMIN, 1000, ADMIN)).toThrow(AccessError);
    expect(listBlocks(db)).toEqual([]);
  });

  it("keeps the first block", () => {
    block(db, "Bob#2002", ADMIN, 1000, ADMIN);
    expect(block(db, "Bob#2002", ADMIN, 2000, ADMIN).blockedAt).toBe(1000);
  });
});

describe("guest list", () => {
  it("adds, changes and removes guests", () => {
    expect(putGuest(db, " Gus#3003 ", false, ADMIN, 100)).toEqual({
      battleTag: "Gus#3003",
      mayUpload: false,
      addedAt: 100,
      addedBy: ADMIN,
    });
    expect(role("gus#3003")).toBe("guest");
    expect(putGuest(db, "GUS#3003", true, "Other#1", 200)).toMatchObject({
      mayUpload: true,
      addedAt: 100,
      addedBy: ADMIN,
    });
    expect(listGuests(db)).toHaveLength(1);
    expect(removeGuest(db, "Gus#3003")).toBe(true);
    expect(removeGuest(db, "Gus#3003")).toBe(false);
    expect(role("Gus#3003")).toBeUndefined();
  });

  it("refuses what is not a BattleTag", () => {
    for (const bad of ["", "Gus", "Gus#", "#1234", "Gus Smith#1234", "Gus#12a"]) {
      expect(() => putGuest(db, bad, false, ADMIN)).toThrow(AccessError);
    }
  });
});

describe("admin page (WEB-18)", () => {
  it("adds a guest, refusing the admin, members, guests already listed and non-BattleTags", () => {
    up(nicoFile, ADMIN);
    expect(addGuest(db, "Gwen#4004", true, ADMIN, 1000, ADMIN)).toMatchObject({
      battleTag: "Gwen#4004",
      mayUpload: true,
    });
    expect(() => addGuest(db, "gwen#4004", false, ADMIN, 1000, ADMIN)).toThrow(
      "Gwen#4004 is already on the guest list.",
    );
    expect(() => addGuest(db, "bob#2002", false, ADMIN, 1000, ADMIN)).toThrow("Bob#2002 is already a member.");
    expect(() => addGuest(db, "nico#1000", false, ADMIN, 1000, ADMIN)).toThrow("That's you, the admin.");
    expect(() => addGuest(db, "Gwen", false, ADMIN, 1000, ADMIN)).toThrow(AccessError);
    expect(listGuests(db)).toHaveLength(1);
  });

  it("writes last seen at most once every 5 minutes (WEB-64: online)", () => {
    touchLastSeen(db, "Bob#2002", 1000);
    touchLastSeen(db, "bob#2002", 1000 + 299);
    expect(listLastSeen(db).get("bob#2002")).toBe(1000);
    touchLastSeen(db, "Bob#2002", 1000 + 300);
    expect(listLastSeen(db).get("bob#2002")).toBe(1300);
  });

  it("lists members with the upload that added them, guests and blocks", () => {
    up(nicoFile, ADMIN);
    addGuest(db, "Gwen#4004", false, ADMIN, 1100, ADMIN);
    block(db, "Bob#2002", ADMIN, 1200, ADMIN);
    touchLastSeen(db, ADMIN, 1300);
    const view = loadAdminView(db, 1300 + 7200, ADMIN);
    expect(view.members.map((m) => [m.battleTag, m.rank, m.blocked, m.seen])).toEqual([
      [ADMIN, "owner", false, "Last seen 2 h ago"],
      ["Ada#1001", undefined, false, "Not seen yet"],
      ["Bob#2002", undefined, true, "Not seen yet"],
    ]);
    expect(view.members[1]?.added).toEqual({ text: "Added by Nico's upload", uploadId: 1, at: 1000 });
    expect(view.guests).toMatchObject([{ battleTag: "Gwen#4004", mayUpload: false, added: "Added by Nico" }]);
    expect(view.blocks).toMatchObject([{ battleTag: "Bob#2002", blocked: "Blocked by Nico", blockedAt: 1200 }]);
  });
});
