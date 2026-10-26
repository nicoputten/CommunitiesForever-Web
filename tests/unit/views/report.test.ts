import { describe, expect, it } from "vitest";
import { diff } from "@/core/diff";
import { parseLua } from "@/core/lua";
import { merge } from "@/core/merge";
import { normalize } from "@/core/normalize";
import { sessionReport, shortAge, uploadReport } from "@/core/views";
import { D, H, NOW } from "./sample";

const upload = (body: string) => normalize(parseLua(`return { schemaVersion = 1, ${body} }`));

// Nico's upload after a session: Ves levels twice and gains Tailoring and item level, Tok reaches the First Aid cap,
// Femke's Zul is new, Bob sent nothing new, Mira's data came via Bob, Sanne has no addon.
const before = upload(`
  self = { battleTag = "Nico#2201", version = ${NOW - 2 * D}, chars = {
    V = { name = "Ves Doombringer", level = 37, ilvl = 31, updatedAt = ${NOW - 2 * D},
          professions = { [197] = { name = "Tailoring", rank = 150, max = 225 } } } } },
  people = {
    ["Bob#2002"] = { version = ${NOW - 9 * D}, chars = {
      T = { name = "Tok Ironhide", level = 33, updatedAt = ${NOW - 9 * D}, professions = { [129] = { rank = 210, max = 225 } } } } },
    ["Mira#1188"] = { version = ${NOW - 5 * D}, via = "Bob#2002", chars = { M = { name = "Mira Sunstrider", level = 60, ilvl = 58 } } },
    ["Femke#3307"] = { version = ${NOW - 3 * D}, chars = { L = { name = "Lia Thornwhisper", level = 35 } } } },
  presence = { S = { battleTag = "Sanne#5150", lastSeen = 1 } },
  locations = { V = { zone = "Durotar", seenAt = ${NOW - 2 * D} } }`);

const file = upload(`
  self = { battleTag = "Nico#2201", version = ${NOW}, chars = {
    V = { name = "Ves Doombringer", level = 39, ilvl = 34, updatedAt = ${NOW},
          professions = { [197] = { name = "Tailoring", rank = 187, max = 225 } } } } },
  people = {
    ["Bob#2002"] = { version = ${NOW - 5 * D}, chars = {
      T = { name = "Tok Ironhide", level = 33, updatedAt = ${NOW - 5 * D}, professions = { [129] = { rank = 225, max = 225 } } } } },
    ["Mira#1188"] = { version = ${NOW - 2 * D}, via = "Bob#2002", chars = { M = { name = "Mira Sunstrider", level = 60, ilvl = 57 } } },
    ["Femke#3307"] = { version = ${NOW - H}, chars = {
      L = { name = "Lia Thornwhisper", level = 37, updatedAt = ${NOW - H} },
      Z = { name = "Zul Kazrek", level = 15, classFile = "WARLOCK", updatedAt = ${NOW - H} } } } },
  presence = { S = { battleTag = "Sanne#5150", lastSeen = 1 } },
  locations = { V = { zone = "Stranglethorn Vale", seenAt = ${NOW - 2 * H} }, L = { zone = "Stranglethorn Vale", seenAt = ${NOW - H} },
                Z = { zone = "Durotar", seenAt = ${NOW - 3 * H} } }`);

describe("upload summary (diff)", () => {
  const summary = diff(before, merge(before, file));

  it("lists item level gains, not losses", () => {
    expect(summary.itemLevelGains).toEqual([
      { guid: "V", owner: "Nico#2201", name: "Ves Doombringer", from: 31, to: 34 },
    ]);
  });

  it("marks a rank that reached its cap", () => {
    expect(summary.professionGains.map((g) => [g.name, g.from, g.to, g.max, g.capReached])).toEqual([
      ["Tok Ironhide", 210, 225, 225, true],
      ["Ves Doombringer", 150, 187, 225, false],
    ]);
  });

  it("says who sent new data, nothing new or has no addon, with via", () => {
    // Bob's record is newer than the stored one; a re-upload of the same state would make it "unchanged".
    expect(summary.senders).toEqual([
      { key: "Nico#2201", displayName: "Nico", isUploader: true, status: "newer", dataAt: NOW },
      { key: "Femke#3307", displayName: "Femke", isUploader: false, status: "newer", dataAt: NOW - H },
      {
        key: "Mira#1188",
        displayName: "Mira",
        isUploader: false,
        status: "newer",
        dataAt: NOW - 2 * D,
        via: "Bob#2002",
        viaName: "Bob",
      },
      { key: "Bob#2002", displayName: "Bob", isUploader: false, status: "newer", dataAt: NOW - 5 * D },
      { key: "Sanne#5150", displayName: "Sanne", isUploader: false, status: "noAddon" },
    ]);
    const again = diff(merge(before, file), merge(before, file));
    expect(again.senders.map((s) => s.status)).toEqual(["unchanged", "unchanged", "unchanged", "unchanged", "noAddon"]);
  });

  it("counts for the report header", () => {
    expect(summary.counts).toEqual({
      levelsGained: 4,
      skillGains: 2,
      itemLevelGains: 1,
      newCharacters: 1,
      sightings: 3,
      peopleWithNewData: 4,
    });
  });
});

describe("session report", () => {
  const summary = diff(before, merge(before, file));
  const report = uploadReport(summary, NOW);

  it("orders level ups by levels gained", () => {
    expect(report.levelUps.map((l) => [l.name, l.from, l.to, l.gained])).toEqual([
      ["Ves Doombringer", 37, 39, 2],
      ["Lia Thornwhisper", 35, 37, 2],
    ]);
    expect(report.skillGains.map((g) => g.name)).toEqual(["Tok Ironhide", "Ves Doombringer"]);
    expect(report.newCharacters.map((c) => c.name)).toEqual(["Zul Kazrek"]);
  });

  it("measures each sender's data age at upload time", () => {
    expect(report.senders.map((s) => [s.displayName, s.status, s.age, s.ageAtUpload, s.old])).toEqual([
      ["Nico", "newer", "live", 0, false],
      ["Femke", "newer", "live", H, false],
      ["Mira", "newer", "recent", 2 * D, false],
      ["Bob", "newer", "days", 5 * D, false],
      ["Sanne", "noAddon", "unknown", undefined, false],
    ]);
    const later = uploadReport(summary, NOW + 3 * D);
    expect(later.senders.find((s) => s.displayName === "Bob")).toMatchObject({ age: "week", old: true });
  });

  it("groups sightings by zone, newest first", () => {
    expect(
      report.sightings.map((z) => [z.sighting.zoneText, z.sighting.seenAt, z.characters.map((c) => c.name)]),
    ).toEqual([
      ["Stranglethorn Vale", NOW - H, ["Lia Thornwhisper", "Ves Doombringer"]],
      ["Durotar", NOW - 3 * H, ["Zul Kazrek"]],
    ]);
    expect(report.sightings[0]?.sighting).toMatchObject({ zone: "stv", zoneName: "Stranglethorn Vale" });
    expect(report.nothingNew).toBe(false);
  });

  it("knows when an upload brought nothing new", () => {
    const state = merge(before, file);
    expect(uploadReport(diff(state, state), NOW).nothingNew).toBe(true);
  });
});

describe("session report page (WEB-20)", () => {
  const state = merge(before, file);
  const page = sessionReport(diff(before, state), NOW, state, "Nico", false);

  it("has the board's four counters, singular where one", () => {
    expect(page.counters).toEqual([
      { value: 4, label: "levels gained" },
      { value: 2, label: "skill gains" },
      { value: 1, label: "new character" },
      { value: 3, label: "new sightings" },
    ]);
    expect(page.friendsWithNewData).toBe(4);
  });

  it("level ups: badge, and bars as shares of level 60", () => {
    expect(page.levelUps[0]).toMatchObject({
      name: "Ves Doombringer",
      badge: "LEVEL UP ×2",
      fromShare: 37 / 60,
      toShare: 39 / 60,
    });
  });

  it("new faces: owner, class, level and the upload's own sighting", () => {
    expect(page.newFaces).toEqual([
      {
        guid: "Z",
        name: "Zul Kazrek",
        ownName: "Zul Kazrek",
        classFile: "WARLOCK",
        line: "Femke's new Warlock · level 15 · Durotar",
      },
    ]);
  });

  it("skill gains on the 300 scale, with the profession name from the game data when the addon left it out", () => {
    expect(page.skillGains.map((g) => [g.name, g.profession, g.from, g.to, g.capReached, g.toShare])).toEqual([
      ["Tok Ironhide", "First Aid", 210, 225, true, 225 / 300],
      ["Ves Doombringer", "Tailoring", 150, 187, false, 187 / 300],
    ]);
  });

  it("who sent data, as the chips say it", () => {
    expect(page.senders.map((s) => [s.text, s.age, s.quiet])).toEqual([
      ["Nico · just now", "live", false],
      ["Femke · 1 h", "live", false],
      ["Mira · 2 days, via Bob", "recent", false],
      ["Bob · 5 days", "days", false],
      ["Sanne · no addon", undefined, true],
    ]);
    const again = sessionReport(diff(state, state), NOW + 9 * D, state, "Nico", false);
    expect(again.senders[3]).toMatchObject({ text: "Bob · nothing new (14 days)", age: "week", quiet: true });
    expect(again.nothingNew).toBe(true);
  });

  it("sightings per zone, full names", () => {
    expect(page.sightings.map((s) => [s.characters.map((c) => c.name), s.place])).toEqual([
      [["Lia Thornwhisper", "Ves Doombringer"], "Stranglethorn Vale"],
      [["Zul Kazrek"], "Durotar"],
    ]);
    expect(page.gear).toEqual([{ guid: "V", name: "Ves Doombringer", ownName: "Ves Doombringer", from: 31, to: 34 }]);
  });

  it("first upload: counts characters with a record and their owners; a stub is named after its owner", () => {
    const first = sessionReport(diff(undefined, state), NOW, state, "Nico", true);
    expect([first.first, first.characters, first.friends]).toEqual([true, 5, 4]);
    expect(first.newFaces.at(-1)).toMatchObject({
      name: "Sanne's character",
      line: "Sanne's new character · Location unknown",
    });
    expect(first.newFaces.at(-1)?.ownName).toBeUndefined();
  });

  it("names removed characters and works without current data", () => {
    const without = upload(`self = { battleTag = "Nico#2201", version = ${NOW + D}, chars = {} }`);
    const after = merge(state, without);
    const gone = sessionReport(diff(state, after), NOW + D, undefined, "Nico", false);
    expect(gone.removed).toEqual(["Ves Doombringer"]);
  });
});

describe("shortAge", () => {
  it("says just now, minutes, hours and days", () => {
    expect([0, 4 * 60, 5 * 60, H, 23 * H, D, 2 * D].map(shortAge)).toEqual([
      "just now",
      "just now",
      "5 min",
      "1 h",
      "23 h",
      "1 day",
      "2 days",
    ]);
  });
});
