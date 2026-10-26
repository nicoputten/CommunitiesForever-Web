import { describe, expect, it } from "vitest";
import {
  isFiltered,
  parseRosterQuery,
  professionOptions,
  professionSlug,
  roster,
  rosterFilter,
  rosterSearch,
} from "@/core/views";
import { NOW, sample } from "./sample";

describe("roster query (URL state)", () => {
  it("reads the URL and writes it back the same", () => {
    const q = parseRosterQuery({
      q: "ves",
      class: "mage,WARLOCK",
      role: "heal",
      level: "30-39",
      prof: "tailoring",
      sort: "level",
    });
    expect(q).toEqual({
      search: "ves",
      classes: ["MAGE", "WARLOCK"],
      roles: ["heal"],
      level: "30-39",
      profession: "197",
      sort: "level",
    });
    // Classes in the table's order, so equal views have equal URLs.
    expect(rosterSearch(q)).toBe("?q=ves&class=mage,warlock&role=heal&level=30-39&prof=tailoring&sort=level");
  });

  it("ignores what it does not know and drops defaults", () => {
    const q = parseRosterQuery({
      class: "bard,mage",
      role: "x",
      level: "7",
      prof: "juggling",
      sort: "evil",
      q: ["a", "b"],
    });
    expect(q).toEqual({ search: "a", classes: ["MAGE"], roles: [], sort: "lastPlayed" });
    expect(rosterSearch(parseRosterQuery({}))).toBe("");
    expect(isFiltered(parseRosterQuery({ sort: "level" }))).toBe(false);
    expect(isFiltered(parseRosterQuery({ q: "x" }))).toBe(true);
  });

  it("names professions by slug, unknown skill lines by ID", () => {
    expect(professionSlug("129")).toBe("first-aid");
    expect(parseRosterQuery({ prof: "first-aid" }).profession).toBe("129");
    expect(professionSlug("999")).toBe("999");
    expect(parseRosterQuery({ prof: "999" }).profession).toBe("999");
  });

  it("turns into the view model's filter", () => {
    expect(rosterFilter(parseRosterQuery({ level: "60", role: "tank,dps" }))).toEqual({
      roles: ["tank", "dps"],
      minLevel: 60,
      maxLevel: 60,
    });
    expect(rosterFilter(parseRosterQuery({}))).toEqual({});
  });

  it("offers the professions in the data", () => {
    const options = professionOptions(roster(sample(), NOW).characters);
    expect(options.map((o) => o.name)).toContain("Tailoring");
    expect(options.map((o) => o.name)).toEqual([...options.map((o) => o.name)].sort());
  });
});

describe("roster query order", () => {
  it("writes classes and roles in the table's order, however they were picked", () => {
    expect(
      rosterSearch({ search: "", classes: ["WARLOCK", "PRIEST"], roles: ["dps", "tank"], sort: "lastPlayed" }),
    ).toBe("?class=priest,warlock&role=tank,dps");
  });
});
