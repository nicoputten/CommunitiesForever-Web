import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import { canonical } from "@/core/merge";
import { normalize } from "@/core/normalize";
import {
  mayHaveProbe,
  newestPerFriend,
  probeEntry,
  probeFile,
  probeFileName,
  probeFriendsText,
  probeSummary,
  readProbe,
} from "@/core/probe";

// WEB-82: the addon's hidden launch probe in `global.probe`. Made-up values in the shape the addon writes: per client
// flavour, per item `{ status, detail, at, build, ... }`.

/** A sample probe section as the game writes it. */
const PROBE = `{
    ["era"] = {
      ["C_Map.GetBestMapForUnit"] = { ["status"] = "ok", ["detail"] = "1411", ["at"] = 1793800000, ["build"] = "1.15.8" },
      ["GetGuildRosterInfo"] = { ["status"] = "error", ["detail"] = "attempt to call a nil value", ["at"] = 1793800001, ["build"] = "1.15.8", ["n"] = 2 },
      ["C_Club.GetSubscribedClubs"] = { ["status"] = "empty", ["at"] = 1793800002, ["build"] = "1.15.8" },
    },
  }`;

const golden = readFileSync(new URL("../fixtures/addon/v0.4/savedvariables.lua", import.meta.url), "utf8");
/** The golden fixture with a probe section added as the last key of `global`. */
const withProbe = golden.replace(/\n}\s*$/, `\n  probe = ${PROBE},\n}\n`);

describe("readProbe", () => {
  it("reads the probe section of a file written as the game does", () => {
    const text = `CommunitiesForeverDB = { ["global"] = { ["schemaVersion"] = 2, ["probe"] = ${PROBE} } }`;
    expect(readProbe(parseLua(text))).toEqual({
      era: {
        "C_Map.GetBestMapForUnit": { status: "ok", detail: "1411", at: 1793800000, build: "1.15.8" },
        GetGuildRosterInfo: {
          status: "error",
          detail: "attempt to call a nil value",
          at: 1793800001,
          build: "1.15.8",
          n: 2,
        },
        "C_Club.GetSubscribedClubs": { status: "empty", at: 1793800002, build: "1.15.8" },
      },
    });
  });

  it("is undefined for every file without one", () => {
    expect(readProbe(parseLua(golden))).toBeUndefined();
    expect(readProbe(parseLua("CommunitiesForeverDB = { global = { schemaVersion = 2 } }"))).toBeUndefined();
    expect(readProbe(parseLua("Other = { probe = { a = 1 } }"))).toBeUndefined();
  });

  it("finds the probe in the fixture-style file too", () => {
    expect(withProbe).not.toBe(golden);
    expect(readProbe(parseLua(withProbe))).toMatchObject({ era: { GetGuildRosterInfo: { status: "error" } } });
  });
});

describe("normalize with a probe section (rule 4)", () => {
  it("reads the same dataset as without it", () => {
    expect(canonical(normalize(parseLua(withProbe)))).toBe(canonical(normalize(parseLua(golden))));
  });
});

describe("mayHaveProbe", () => {
  it("lets through any file with the word, and only those", () => {
    expect(mayHaveProbe(withProbe)).toBe(true);
    expect(mayHaveProbe(golden)).toBe(false);
  });
});

describe("newestPerFriend", () => {
  const up = (id: number, uploadedBy: string) => ({ id, uploadedBy, uploadedAt: id * 100 });
  it("takes each friend's newest upload with a probe and reads no older file of theirs", () => {
    const asked: number[] = [];
    const withIt = new Set([5, 4, 2, 1]);
    const picked = newestPerFriend(
      [up(6, "Bob#2002"), up(5, "bob#2002"), up(4, "Ada#1001"), up(3, "Cy#3003"), up(2, "Bob#2002"), up(1, "Ada#1001")],
      (t) => t.toLowerCase(),
      (u) => {
        asked.push(u.id);
        return withIt.has(u.id);
      },
    );
    expect(picked.map((u) => u.id)).toEqual([5, 4]);
    expect(asked).toEqual([6, 5, 4, 3]);
  });
});

describe("the summary and the file", () => {
  it("counts friends and takes the newest time", () => {
    expect(probeSummary([])).toEqual({ friends: 0 });
    expect(
      probeSummary([
        { id: 2, uploadedBy: "A#1", uploadedAt: 50 },
        { id: 9, uploadedBy: "B#2", uploadedAt: 90 },
      ]),
    ).toEqual({
      friends: 2,
      newestAt: 90,
    });
    expect(probeFriendsText(1)).toBe("1 friend");
    expect(probeFriendsText(3)).toBe("3 friends");
  });

  it("writes one entry per friend, by display name, with ISO times", () => {
    const file = probeFile(
      [
        probeEntry({ id: 7, uploadedBy: "Zed#9", uploadedAt: 1793800000 }, "Zed", { era: {} }),
        probeEntry({ id: 3, uploadedBy: "Ada#1001", uploadedAt: 1793700000 }, "Ada", { era: { x: { status: "ok" } } }),
      ],
      1793810000,
    );
    expect(file).toEqual({
      exportedAt: "2026-11-04T16:33:20.000Z",
      friends: [
        {
          displayName: "Ada",
          battleTag: "Ada#1001",
          uploadedAt: "2026-11-03T10:00:00.000Z",
          uploadId: 3,
          probe: { era: { x: { status: "ok" } } },
        },
        {
          displayName: "Zed",
          battleTag: "Zed#9",
          uploadedAt: "2026-11-04T13:46:40.000Z",
          uploadId: 7,
          probe: { era: {} },
        },
      ],
    });
    expect(probeFileName(1793810000)).toBe("probe-results-2026-11-04.json");
  });
});
