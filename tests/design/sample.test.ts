import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkFile } from "@/core/access";
import { diff } from "@/core/diff";
import { parseLua } from "@/core/lua";
import { merge } from "@/core/merge";
import { normalize } from "@/core/normalize";
import { E2E } from "../../playwright.config";
import { ADMIN, sampleSavedVariables, type SampleDay } from "./sample";

// The design checks' sample upload must stay a file the site accepts from the admin.
describe("design sample data", () => {
  it("parses, normalizes and is the admin's own file", () => {
    const data = normalize(parseLua(sampleSavedVariables()));
    expect(checkFile(ADMIN, data, undefined, ADMIN)).toBeUndefined();
    expect(data.community.name).toBe("Doombringers");
    const named = Object.values(data.characters).filter((c) => c.hasRecord);
    expect(named.map((c) => c.name).sort()).toEqual([
      "Bob Example",
      "Grom Ashfeller",
      "Kel Dawnhammer",
      "Lia Thornwhisper",
      "Mira Sunstrider",
      "Ruk Bloodhoof",
      "Sela Moonbrook",
      "Tok Ironhide",
      "Ves Doombringer",
      "Zul Kazrek",
    ]);
    expect(data.characters["Player-1-0000A001"]?.mainTreeName).toBe("Destruction");
  });
});

// WEB-21: files to upload by hand (tests/fixtures/sample/README.md), made from the same sample on consecutive days.
// `UPDATE_SAMPLE_FILES=1 npm test -- tests/design/sample.test.ts` writes them again after the sample changes.
const SAMPLE_DIR = path.join(process.cwd(), "tests/fixtures/sample");
/** 2026-10-26 20:00 UTC: day 3's evening; day 2 and day 1 are the two evenings before. */
const SAMPLE_FILES_NOW = 1793044800;
/** The BattleTag in the "yours" files, to be replaced with your own before uploading. */
const PLACEHOLDER = "YourName#1234";
const DAYS: SampleDay[] = [1, 2, 3];
const FILES = [
  { who: "e2e-admin", self: E2E.admin },
  { who: "yours", self: PLACEHOLDER },
].flatMap((f) => DAYS.map((day) => ({ ...f, day, name: `${f.who}-day${day}.lua` })));

describe("sample upload files", () => {
  for (const f of FILES) {
    it(`${f.name} is the sample of day ${f.day} for ${f.self}`, () => {
      const text = sampleSavedVariables({ self: f.self, now: SAMPLE_FILES_NOW, day: f.day });
      const file = path.join(SAMPLE_DIR, f.name);
      if (process.env.UPDATE_SAMPLE_FILES === "1") {
        mkdirSync(SAMPLE_DIR, { recursive: true });
        writeFileSync(file, text);
      }
      expect(existsSync(file), `${f.name} is missing: run with UPDATE_SAMPLE_FILES=1`).toBe(true);
      expect(readFileSync(file, "utf8").replace(/\r\n/g, "\n")).toBe(text);
      const data = normalize(parseLua(text));
      expect(checkFile(f.self, data, undefined, f.self)).toBeUndefined();
      expect(data.community).toMatchObject({ id: "40000001", name: "Doombringers" });
    });
  }

  it("each day has something to report: level ups, skill gains, sightings, a new character", () => {
    const day = (d: SampleDay) => normalize(parseLua(sampleSavedVariables({ self: E2E.admin, now: SAMPLE_FILES_NOW, day: d })));
    const one = day(1);
    const two = merge(one, day(2));
    const r2 = diff(one, two);
    const r3 = diff(two, merge(two, day(3)));
    for (const r of [r2, r3]) {
      expect(r.levelUps.length).toBeGreaterThan(0);
      expect(r.professionGains.length).toBeGreaterThan(0);
      expect(r.sightings.length).toBeGreaterThan(0);
    }
    expect(r2.newCharacters.map((c) => c.name)).toEqual(["Tok Ironhide"]);
    expect(r3.newCharacters).toEqual([]);
  });
});
