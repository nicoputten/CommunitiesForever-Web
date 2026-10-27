import { describe, expect, it } from "vitest";
import { DUNGEONS } from "@/core/gamedata";
import { roster, type RosterFilter, type RosterSort } from "@/core/views";
import { NOW, sample } from "./sample";

const names = (list: { name?: string }[]) => list.map((c) => c.name);

describe("roster", () => {
  const r = roster(sample(), NOW);
  const list = (filter: RosterFilter, sort: RosterSort = "level") =>
    names(roster(sample(), NOW, { filter, sort }).characters);

  it("counts everyone and every character (board: 6 friends · 10 characters)", () => {
    expect(r.counts).toEqual({ people: 6, characters: 10 });
    expect(r.noAddon.map((p) => p.displayName)).toEqual(["Sanne"]);
  });

  it("groups characters by friend, the uploader first, sorted by last played", () => {
    expect(r.friends.map((f) => f.person.displayName)).toEqual(["Nico", "Bob", "Femke", "Jorrit", "Mira"]);
    expect(names(r.friends[0]!.characters)).toEqual(["Ves Doombringer", "Grom Ashfeller", "Sela Moonbrook"]);
    expect(r.friends.find((f) => f.person.displayName === "Mira")?.person.via?.name).toBe("Bob");
  });

  it("describes each character as the cards show it", () => {
    const ves = r.characters.find((c) => c.name === "Ves Doombringer");
    expect(ves).toMatchObject({
      level: 39,
      className: "Warlock",
      classFile: "WARLOCK",
      raceName: "Undead",
      faction: "Horde",
      ruleset: "PvP",
      role: "dps",
      mainTreeName: "Destruction",
      ilvl: 34,
      ownerName: "Nico",
    });
    expect(ves?.professions.map((p) => [p.name, p.rank, p.max])).toEqual([
      ["Tailoring", 187, 225],
      ["Enchanting", 160, 225],
      ["Cooking", 75, 150],
    ]);
    const sela = r.characters.find((c) => c.name === "Sela Moonbrook");
    expect(sela?.ilvl).toBeUndefined();
    expect(sela?.sighting).toBeUndefined();
  });

  it("sorts the table", () => {
    expect(list({})).toEqual([
      "Mira Sunstrider",
      "Bob Example",
      "Ves Doombringer",
      "Lia Thornwhisper",
      "Tok Ironhide",
      "Ruk Bloodhoof",
      "Grom Ashfeller",
      "Kel Dawnhammer",
      "Zul Kazrek",
      "Sela Moonbrook",
    ]);
    expect(list({}, "name").slice(0, 3)).toEqual(["Bob Example", "Grom Ashfeller", "Kel Dawnhammer"]);
    expect(list({}, "ilvl").at(-1)).toBe("Sela Moonbrook");
    expect(list({}, "role").slice(0, 2)).toEqual(["Grom Ashfeller", "Kel Dawnhammer"]);
    expect(roster(sample(), NOW, { sort: "class" }).characters[0]?.className).toBe("Druid");
    expect(roster(sample(), NOW, { sort: "player" }).characters[0]?.ownerName).toBe("Bob");
  });

  it("sorts by the table's columns, both ways, missing values last (WEB-22)", () => {
    const sorted = (sort: RosterSort, dir?: "asc" | "desc") => roster(sample(), NOW, { sort, dir }).characters;
    const levels = sorted("level", "asc").map((c) => c.level);
    expect(levels).toEqual([...levels].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(names(sorted("name", "desc")).slice(0, 2)).toEqual(["Zul Kazrek", "Ves Doombringer"]);
    // Sela has no item level: last in both directions.
    expect(names(sorted("ilvl", "asc")).at(-1)).toBe("Sela Moonbrook");
    expect(names(sorted("ilvl", "desc")).at(-1)).toBe("Sela Moonbrook");
    const talents = sorted("talents").map((c) => c.mainTreeName);
    expect(talents.filter((t) => t !== undefined)).toEqual(
      [...talents.filter((t) => t !== undefined)].sort((a, b) => a!.localeCompare(b!)),
    );
    const zones = sorted("seen").map((c) => c.sighting?.zoneText);
    expect(zones.indexOf(undefined)).toBe(zones.length - zones.filter((z) => z === undefined).length);
    const known = zones.filter((z) => z !== undefined);
    expect(known).toEqual([...known].sort((a, b) => a!.localeCompare(b!)));
    // Race · class: class first, then race.
    const classes = sorted("class").map((c) => `${c.className} ${c.raceName}`);
    expect(classes[0]).toMatch(/^Druid /);
    expect(sorted("class", "desc")[0]?.className).toBe("Warrior");
  });

  it("filters by class, role, level range, profession, last played and person", () => {
    expect(list({ classFiles: ["WARLOCK"] })).toEqual(["Ves Doombringer", "Zul Kazrek"]);
    expect(list({ roles: ["tank"] })).toEqual(["Grom Ashfeller", "Kel Dawnhammer"]);
    expect(list({ minLevel: 30, maxLevel: 40 })).toEqual(["Ves Doombringer", "Lia Thornwhisper", "Tok Ironhide"]);
    expect(list({ profession: "197" })).toEqual(["Mira Sunstrider", "Ves Doombringer", "Lia Thornwhisper"]);
    expect(list({ playedWithinDays: 1 }, "lastPlayed")).toEqual([
      "Lia Thornwhisper",
      "Ves Doombringer",
      "Bob Example",
      "Tok Ironhide",
    ]);
    const bobOnly = roster(sample(), NOW, { filter: { person: "Bob#2002" } });
    expect(bobOnly.friends.map((f) => f.person.displayName)).toEqual(["Bob"]);
    expect(bobOnly.counts).toEqual({ people: 6, characters: 10 });
  });

  it("shows dungeon bands where at least two characters fit, raids excluded, for the whole group", () => {
    const { spread } = roster(sample(), NOW, { filter: { person: "Bob#2002" } });
    expect(spread.characters.map((c) => c.level)).toEqual([12, 15, 18, 24, 27, 33, 37, 39, 41, 60]);
    expect(spread.bands.length).toBeGreaterThan(0);
    for (const band of spread.bands) {
      const { min, max } = band.dungeon.typicalLevels;
      expect(band.fits.length).toBeGreaterThanOrEqual(2);
      expect(band.fits.every((c) => c.level! >= min && c.level! <= max)).toBe(true);
      expect(DUNGEONS.find((d) => d.id === band.dungeon.id)?.kind).toBe("dungeon");
    }
    const mins = spread.bands.map((b) => b.dungeon.typicalLevels.min);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
    expect(spread.bands.some((b) => b.dungeon.name === "Zul'Farrak")).toBe(false);
  });

  it("names the band with the most fits (board: Scarlet Monastery fits Ves, Lia, Tok, Bob, Ruk)", () => {
    expect(r.spread.best?.dungeon).toEqual({
      id: "sm",
      name: "Scarlet Monastery",
      typicalLevels: { min: 26, max: 45 },
    });
    expect(names(r.spread.best!.fits)).toEqual([
      "Bob Example",
      "Ves Doombringer",
      "Lia Thornwhisper",
      "Tok Ironhide",
      "Ruk Bloodhoof",
    ]);
  });

  it("answers the quick questions", () => {
    expect(names(r.quickAnswers.healers)).toEqual(["Lia Thornwhisper", "Tok Ironhide", "Sela Moonbrook"]);
    expect(names(r.quickAnswers.tanks)).toEqual(["Grom Ashfeller", "Kel Dawnhammer"]);
    expect(names(r.quickAnswers.level30to40)).toEqual(["Ves Doombringer", "Lia Thornwhisper", "Tok Ironhide"]);
    expect(names(r.quickAnswers.level60)).toEqual(["Mira Sunstrider"]);
  });

  it("searches names, owners and BattleTags without case or accents (WEB-21)", () => {
    expect(list({ search: "ves" })).toEqual(["Ves Doombringer"]);
    expect(list({ search: "  BOB " })).toEqual(["Bob Example", "Tok Ironhide"]);
    expect(list({ search: "#4410" })).toEqual(["Ruk Bloodhoof"]);
    expect(list({ search: "thörn" })).toEqual(["Lia Thornwhisper"]);
    expect(list({ search: "" })).toHaveLength(10);
    expect(list({ search: "nobody" })).toEqual([]);
  });

  it("sorts by profession: the chosen one's skill, else the best rank (WEB-21)", () => {
    expect(list({}, "profession").slice(0, 3)).toEqual(["Mira Sunstrider", "Tok Ironhide", "Bob Example"]);
    expect(list({}, "profession").at(-1)).toBe("Zul Kazrek");
    expect(list({ profession: "182" }, "profession")).toEqual(["Tok Ironhide", "Sela Moonbrook"]);
  });

  it("counts each friend's characters before the filter", () => {
    const nico = roster(sample(), NOW, { filter: { roles: ["tank"] } }).friends[0]!;
    expect([nico.characters.length, nico.total]).toEqual([1, 3]);
  });
});
