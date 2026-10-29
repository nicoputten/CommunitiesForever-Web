import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isOwner, mayAdmin, mayBlock } from "@/core/access";
import { AccessError, addGuest, block, currentRole, loadAccessList, touchLastSeen, unblock } from "@/server/access";
import { loadAdminView } from "@/server/admin";
import {
  allDevices,
  appointAdmin,
  listAdmins,
  listLog,
  LOG_KEEP,
  logChange,
  OwnerOnlyError,
  removeAdmin,
  revokeAnyDevice,
} from "@/server/admins";
import { openDatabase, type Db } from "@/server/db";
import { createToken } from "@/server/uploader";
import { rebuild, upload } from "@/server/uploads";
import { storeCutoff } from "@/server/cutoff";

// WEB-64: co-admins. The owner (ADMIN_BATTLETAG) appoints and removes admins; admins run the group but can't do what
// only the owner may; nobody blocks the owner or an admin; every change goes in the log.

const OWNER = "Nico#1000";
const file = new TextEncoder().encode(
  `return { schemaVersion = 1, self = { battleTag = "${OWNER}", version = 1 }, settings = { clubId = 7 },
   people = { ["Ada#1001"] = { version = 1 }, ["Bob#2002"] = { version = 1 } } }`,
);

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = openDatabase(path.join(dir, "test.sqlite"));
  expect(upload(db, file, OWNER, 1000, OWNER).status).toBe("ok");
  touchLastSeen(db, "Ada#1001", 1000);
  touchLastSeen(db, "Bob#2002", 1000);
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const list = () => loadAccessList(db, OWNER);
const actions = () => listLog(db).map((e) => [e.by, e.action, e.target ?? null]);

describe("appointing admins", () => {
  it("the owner makes a friend an admin: role admin, not the owner, logged", () => {
    appointAdmin(db, "Ada#1001", OWNER, 2000, OWNER);
    expect(currentRole(db, "ada#1001", OWNER)).toBe("admin");
    expect(mayAdmin("Ada#1001", list())).toBe(true);
    expect(isOwner("Ada#1001", list())).toBe(false);
    expect(isOwner(OWNER, list())).toBe(true);
    expect(listAdmins(db)).toEqual([{ battleTag: "Ada#1001", addedBy: OWNER, addedAt: 2000 }]);
    expect(actions()).toEqual([[OWNER, "adminAppointed", "Ada#1001"]]);
  });

  it("an admin can't appoint or remove admins", () => {
    appointAdmin(db, "Ada#1001", OWNER, 2000, OWNER);
    expect(() => appointAdmin(db, "Bob#2002", "Ada#1001", 2100, OWNER)).toThrow(OwnerOnlyError);
    expect(() => removeAdmin(db, "Ada#1001", "Ada#1001", 2100, OWNER)).toThrow(OwnerOnlyError);
    expect(currentRole(db, "Bob#2002", OWNER)).toBe("member");
    expect(currentRole(db, "Ada#1001", OWNER)).toBe("admin");
  });

  it("only friends who have signed in, never the owner", () => {
    addGuest(db, "Gwen#4004", false, OWNER, 1100, OWNER);
    expect(() => appointAdmin(db, "Gwen#4004", OWNER, 2000, OWNER)).toThrow(/first sign-in/);
    expect(() => appointAdmin(db, "Stranger#9999", OWNER, 2000, OWNER)).toThrow(AccessError);
    expect(() => appointAdmin(db, OWNER, OWNER, 2000, OWNER)).toThrow(/owner/);
    expect(listAdmins(db)).toEqual([]);
  });

  it("removing an admin takes effect at the next request", () => {
    appointAdmin(db, "Ada#1001", OWNER, 2000, OWNER);
    removeAdmin(db, "Ada#1001", OWNER, 2100, OWNER);
    expect(currentRole(db, "Ada#1001", OWNER)).toBe("member");
    expect(mayAdmin("Ada#1001", list())).toBe(false);
    expect(actions()[0]).toEqual([OWNER, "adminRemoved", "Ada#1001"]);
  });

  it("admins survive a rebuild and the launch cut-off", () => {
    appointAdmin(db, "Ada#1001", OWNER, 2000, OWNER);
    storeCutoff(db, 3000, OWNER, 3000);
    rebuild(db);
    expect(currentRole(db, "Ada#1001", OWNER)).toBe("admin");
  });
});

describe("blocking", () => {
  it("nobody blocks the owner or an admin; the admin has to be removed first", () => {
    appointAdmin(db, "Ada#1001", OWNER, 2000, OWNER);
    expect(mayBlock(OWNER, list())).toBe(false);
    expect(mayBlock("Ada#1001", list())).toBe(false);
    expect(() => block(db, OWNER, "Ada#1001", 2100, OWNER)).toThrow("The owner can't be blocked.");
    expect(() => block(db, "Ada#1001", OWNER, 2100, OWNER)).toThrow(/Remove Ada as admin first/);
    removeAdmin(db, "Ada#1001", OWNER, 2200, OWNER);
    block(db, "Ada#1001", OWNER, 2300, OWNER);
    expect(currentRole(db, "Ada#1001", OWNER)).toBeUndefined();
    unblock(db, "Ada#1001");
  });

  it("an admin blocks a member", () => {
    appointAdmin(db, "Ada#1001", OWNER, 2000, OWNER);
    block(db, "Bob#2002", "Ada#1001", 2100, OWNER);
    expect(currentRole(db, "Bob#2002", OWNER)).toBeUndefined();
  });
});

describe("uploader devices", () => {
  it("the owner sees and revokes anyone's device; an admin can't", () => {
    appointAdmin(db, "Ada#1001", OWNER, 2000, OWNER);
    const { id } = createToken(db, "Bob#2002", "BOB-LAPTOP", null, "manual", 2000);
    expect(allDevices(db).map((d) => [d.battleTag, d.deviceName])).toEqual([["Bob#2002", "BOB-LAPTOP"]]);
    expect(() => revokeAnyDevice(db, id, "Ada#1001", 2100, OWNER)).toThrow(OwnerOnlyError);
    expect(allDevices(db)).toHaveLength(1);
    expect(revokeAnyDevice(db, id, OWNER, 2200, OWNER)).toBe(true);
    expect(allDevices(db)).toEqual([]);
    expect(listLog(db)[0]).toMatchObject({ action: "deviceRevoked", target: "BOB-LAPTOP", detail: "Bob#2002" });
  });
});

describe("the admin changes log", () => {
  it("keeps the newest 500, newest first", () => {
    for (let i = 0; i < LOG_KEEP + 3; i++) logChange(db, OWNER, "testPost", 1000 + i, undefined, `post ${i}`);
    const all = listLog(db, 1000);
    expect(all).toHaveLength(LOG_KEEP);
    expect(all[0]?.detail).toBe(`post ${LOG_KEEP + 2}`);
    expect(all.at(-1)?.detail).toBe("post 3");
  });

  it("the admin page shows it, devices for the owner only, and the Admins box", () => {
    appointAdmin(db, "Ada#1001", OWNER, 2000, OWNER);
    createToken(db, "Bob#2002", "BOB-LAPTOP", null, "manual", 2000);
    touchLastSeen(db, OWNER, 2400);
    const asAdmin = loadAdminView(db, 2500, OWNER, false);
    expect(asAdmin.devices).toEqual([]);
    expect(asAdmin.log.map((l) => l.parts.map((p) => p.text).join(""))).toEqual(["made Ada an admin"]);
    expect(asAdmin.admins.map((a) => [a.battleTag, a.rank, a.online])).toEqual([
      [OWNER, "owner", true],
      ["Ada#1001", "admin", false],
      ["Bob#2002", undefined, false],
    ]);
    expect(asAdmin.adminCount).toBe("1 owner · 1 admin");
    expect(loadAdminView(db, 2500, OWNER, true).devices.map((d) => d.deviceName)).toEqual(["BOB-LAPTOP"]);
  });
});
