import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import { normalize } from "@/core/normalize";
import { rollCall } from "@/core/views";
import { D, H, NOW, sample } from "./sample";

const names = (rows: { character: { name?: string } }[]) => rows.map((r) => r.character.name);

describe("roll call", () => {
  const call = rollCall(sample(), NOW);

  it("counts located characters (board: 9 of 10 located)", () => {
    expect(call.located).toBe(9);
    expect(call.total).toBe(10);
  });

  it("groups sightings into the last 24 hours and earlier, newest first", () => {
    expect(names(call.last24h)).toEqual(["Lia Thornwhisper", "Ves Doombringer", "Bob Example", "Tok Ironhide"]);
    expect(names(call.earlier)).toEqual([
      "Mira Sunstrider",
      "Grom Ashfeller",
      "Zul Kazrek",
      "Kel Dawnhammer",
      "Ruk Bloodhoof",
    ]);
  });

  it("gives each row its zone, data age and owner", () => {
    const [lia, , bob] = call.last24h;
    expect(lia?.sighting).toMatchObject({ zoneText: "Stranglethorn Vale", zone: "stv", seenAt: NOW - H, age: "live" });
    expect(lia?.person).toMatchObject({ displayName: "Femke", old: false });
    expect(bob?.sighting).toMatchObject({
      zoneText: "The Deadmines",
      zone: "westfall",
      zoneName: "Westfall",
      dungeon: { id: "dm", name: "The Deadmines", kind: "dungeon" },
      age: "live",
    });
  });

  it("shows via X and old data on the owner", () => {
    const mira = call.earlier.find((r) => r.character.name === "Mira Sunstrider");
    expect(mira?.person?.via).toEqual({ key: "Bob#2002", name: "Bob" });
    expect(mira?.person?.old).toBe(false);
    const ruk = call.earlier.find((r) => r.character.name === "Ruk Bloodhoof");
    expect(ruk?.person).toMatchObject({ displayName: "Jorrit", old: true, daysOld: 9, dataAge: "week" });
    expect(ruk?.person?.via).toEqual({ key: "Mira#1188", name: "Mira" });
    expect(ruk?.sighting.age).toBe("week");
  });

  it("lists unknown whereabouts and friends without the addon", () => {
    expect(call.unknown.map((u) => u.character.name)).toEqual(["Sela Moonbrook"]);
    expect(call.unknown[0]?.person?.displayName).toBe("Nico");
    expect(call.noAddon.map((p) => p.displayName)).toEqual(["Sanne"]);
    expect(call.people.map((p) => p.displayName)).toEqual(["Nico", "Bob", "Femke", "Jorrit", "Mira"]);
  });

  it("filters by person, last 24 hours, faction, level and age", () => {
    const d = sample();
    expect(names(rollCall(d, NOW, { person: "Bob#2002" }).last24h)).toEqual(["Bob Example", "Tok Ironhide"]);
    const recent = rollCall(d, NOW, { last24h: true });
    expect([recent.located, recent.total, recent.earlier.length, recent.unknown.length]).toEqual([4, 4, 0, 0]);
    const alliance = rollCall(d, NOW, { faction: "Alliance" });
    expect([...names(alliance.earlier), ...alliance.unknown.map((u) => u.character.name)]).toEqual([
      "Kel Dawnhammer",
      "Sela Moonbrook",
    ]);
    expect(rollCall(d, NOW, { minLevel: 30, maxLevel: 40 }).total).toBe(3);
    expect(names(rollCall(d, NOW, { ages: ["week"] }).earlier)).toEqual(["Kel Dawnhammer", "Ruk Bloodhoof"]);
    expect(rollCall(d, NOW, { ages: ["unknown"] }).unknown).toHaveLength(1);
  });

  it("shows and counts sighted characters of friends without the addon (stubs)", () => {
    const d = normalize(
      parseLua(`return { schemaVersion = 1,
        self = { battleTag = "Ada#1001", chars = { A = { name = "Ada Example", level = 6 } } },
        presence = { C1 = { battleTag = "Cleo#3003", lastSeen = ${NOW} }, C2 = { battleTag = "Cleo#3003", lastSeen = ${NOW} } },
        locations = { A = { zone = "Durotar", seenAt = ${NOW - 2 * D} }, C1 = { zone = "Mulgore", seenAt = ${NOW - H} },
                      X = { zone = "Somewhere New", seenAt = ${NOW - 3 * H} } } }`),
    );
    const stubs = rollCall(d, NOW);
    expect([stubs.located, stubs.total]).toEqual([3, 3]);
    expect(stubs.last24h.map((r) => [r.character.guid, r.character.hasRecord, r.person?.displayName])).toEqual([
      ["C1", false, "Cleo"],
      ["X", false, undefined],
    ]);
    expect(stubs.last24h[1]?.sighting.zone).toBe("elsewhere");
    expect(stubs.noAddon.map((p) => p.displayName)).toEqual(["Cleo"]);
    expect(stubs.unknown).toEqual([]);
  });
});
