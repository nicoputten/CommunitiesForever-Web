import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type AccessList,
  battleTagKey,
  battleTagsOf,
  checkFile,
  fileOwner,
  mayAdmin,
  mayBlock,
  maySignIn,
  mayUpload,
  rejectionText,
  roleOf,
} from "@/core/access";
import { parseLua } from "@/core/lua";
import type { Dataset } from "@/core/model";
import { normalize } from "@/core/normalize";

function list(over: Partial<AccessList> = {}): AccessList {
  return {
    admin: "Nico#1000",
    members: new Set(["ada#1001", "bob#2002"]),
    guests: new Map([
      ["gus#3003", { mayUpload: false }],
      ["gwen#4004", { mayUpload: true }],
    ]),
    blocked: new Set<string>(),
    ...over,
  };
}

function file(body: string): Dataset {
  return normalize(parseLua(`return { schemaVersion = 1, ${body} }`));
}

const fixture = (p: string) => readFileSync(new URL(`../fixtures/${p}`, import.meta.url), "utf8");

describe("roles", () => {
  it("knows the admin, members and guests", () => {
    expect(roleOf("Nico#1000", list())).toBe("admin");
    expect(roleOf("Ada#1001", list())).toBe("member");
    expect(roleOf("Gus#3003", list())).toBe("guest");
    expect(roleOf("Eve#6666", list())).toBeUndefined();
    expect(roleOf(undefined, list())).toBeUndefined();
    expect(roleOf("  ", list())).toBeUndefined();
  });

  it("compares BattleTags without case", () => {
    expect(battleTagKey(" Ada#1001 ")).toBe("ada#1001");
    expect(roleOf("NICO#1000", list())).toBe("admin");
    expect(roleOf("aDa#1001", list())).toBe("member");
  });

  it("ranks admin over member over guest", () => {
    const l = list({ members: new Set(["nico#1000", "gus#3003"]) });
    expect(roleOf("Nico#1000", l)).toBe("admin");
    expect(roleOf("Gus#3003", l)).toBe("member");
  });

  it("has no admin without ADMIN_BATTLETAG", () => {
    const l = list({ admin: undefined });
    expect(roleOf("Nico#1000", l)).toBeUndefined();
    expect(mayAdmin("Nico#1000", l)).toBe(false);
  });
});

describe("blocks", () => {
  it("takes a blocked member or guest off the list", () => {
    const l = list({ blocked: new Set(["ada#1001", "gwen#4004"]) });
    expect(roleOf("Ada#1001", l)).toBeUndefined();
    expect(maySignIn("Ada#1001", l)).toBe(false);
    expect(mayUpload("Gwen#4004", l)).toBe(false);
    expect(maySignIn("Bob#2002", l)).toBe(true);
  });

  it("never blocks the admin", () => {
    const l = list({ blocked: new Set(["nico#1000"]) });
    expect(roleOf("Nico#1000", l)).toBe("admin");
    expect(mayBlock("nico#1000", l)).toBe(false);
    expect(mayBlock("Ada#1001", l)).toBe(true);
  });
});

describe("permissions", () => {
  it("lets everyone on the list sign in", () => {
    for (const tag of ["Nico#1000", "Ada#1001", "Gus#3003", "Gwen#4004"]) expect(maySignIn(tag, list())).toBe(true);
    expect(maySignIn("Eve#6666", list())).toBe(false);
  });

  it("lets admin, members and guests with may upload upload", () => {
    expect(mayUpload("Nico#1000", list())).toBe(true);
    expect(mayUpload("Bob#2002", list())).toBe(true);
    expect(mayUpload("Gwen#4004", list())).toBe(true);
    expect(mayUpload("Gus#3003", list())).toBe(false);
    expect(mayUpload("Eve#6666", list())).toBe(false);
  });

  it("gives only the admin the admin page", () => {
    expect(mayAdmin("Nico#1000", list())).toBe(true);
    expect(mayAdmin("Ada#1001", list())).toBe(false);
    expect(mayAdmin("Gwen#4004", list())).toBe(false);
  });
});

describe("checkFile", () => {
  const ada = file('self = { battleTag = "Ada#1001" }, settings = { clubId = 7 }');

  it("reads the owner from self.battleTag", () => {
    expect(fileOwner(ada)).toBe("Ada#1001");
    expect(fileOwner(file('self = { accountId = "9" }'))).toBeUndefined();
    expect(fileOwner(file(""))).toBeUndefined();
  });

  it("accepts the uploader's own file of the community", () => {
    expect(checkFile("Ada#1001", ada, "7", "Nico#1000")).toBeUndefined();
    expect(checkFile("ADA#1001", ada, "7", "Nico#1000")).toBeUndefined();
  });

  it("rejects someone else's file, naming its owner", () => {
    const r = checkFile("Bob#2002", ada, "7", "Nico#1000");
    expect(r).toEqual({ code: "not-your-file", owner: "Ada#1001" });
    expect(rejectionText(r!)).toContain("Ada#1001");
  });

  it("rejects a file without a BattleTag as not your file", () => {
    expect(
      checkFile("Ada#1001", file('self = { accountId = "9" }, settings = { clubId = 7 }'), "7", "Nico#1000"),
    ).toEqual({
      code: "not-your-file",
    });
  });

  it("rejects another community, or a file without one", () => {
    expect(checkFile("Ada#1001", ada, "8", "Nico#1000")).toEqual({ code: "other-community" });
    expect(checkFile("Ada#1001", file('self = { battleTag = "Ada#1001" }'), "7", "Nico#1000")).toEqual({
      code: "other-community",
    });
  });

  it("lets only the admin upload before the admin's first upload", () => {
    expect(checkFile("Ada#1001", ada, undefined, "Nico#1000")).toEqual({ code: "no-community-yet" });
    const nico = file('self = { battleTag = "Nico#1000" }, settings = { clubId = 9 }');
    expect(checkFile("Nico#1000", nico, undefined, "Nico#1000")).toBeUndefined();
  });

  it("holds the admin to their own file too, but not to the community", () => {
    expect(checkFile("Nico#1000", ada, "7", "Nico#1000")).toEqual({ code: "not-your-file", owner: "Ada#1001" });
    const nico = file('self = { battleTag = "Nico#1000" }, settings = { clubId = 9 }');
    expect(checkFile("Nico#1000", nico, "7", "Nico#1000")).toBeUndefined();
  });

  it("reads the community of every addon release", () => {
    for (const release of ["v0.3", "v0.4"]) {
      const d = normalize(parseLua(fixture(`addon/${release}/savedvariables.lua`)));
      expect(checkFile("Ada#1001", d, "40000001", "Nico#1000")).toBeUndefined();
    }
  });
});

describe("battleTagsOf", () => {
  it("lists self, people and presence once each, without account-only people", () => {
    const d = file(`
      self = { battleTag = "Ada#1001" },
      people = { ["Bob#2002"] = { version = 1 }, ["aid:55"] = { version = 1 } },
      presence = { G = { battleTag = "Cleo#3003", lastSeen = 1 }, H = { battleTag = "bob#2002", lastSeen = 1 } },
    `);
    expect(battleTagsOf(d).sort()).toEqual(["Ada#1001", "Bob#2002", "Cleo#3003"]);
  });

  it("strips escape sequences", () => {
    const d = file('presence = { G = { battleTag = "|cffff0000Cleo#3003|r", lastSeen = 1 } }');
    expect(battleTagsOf(d)).toEqual(["Cleo#3003"]);
  });

  it("finds everyone in the real beta file", () => {
    const d = normalize(parseLua(fixture("real/beta-2026-10.lua")));
    expect(battleTagsOf(d).sort()).toEqual(["Ada#1001", "Bob#2002", "Cleo#3003", "Dax#4004", "Esme#5005", "Finn#6006"]);
  });
});
