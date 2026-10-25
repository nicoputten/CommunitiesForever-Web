import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import { normalize } from "@/core/normalize";
import { coverage, professions } from "@/core/views";
import { NOW, sample } from "./sample";

describe("professions", () => {
  const view = professions(sample(), NOW);
  const byName = (name: string) => view.professions.find((p) => p.name === name)!;

  it("rates coverage: covered ≥ 225, thin 175–224, gap < 175 or nobody", () => {
    expect([coverage(300), coverage(225), coverage(224), coverage(175), coverage(174), coverage(undefined)]).toEqual([
      "covered",
      "covered",
      "thin",
      "thin",
      "gap",
      "gap",
    ]);
  });

  it("sums up the group (board: 4 covered, 3 thin, 5 gaps)", () => {
    expect(view.covered.map((p) => p.name)).toEqual(["Enchanting", "Tailoring", "First Aid", "Fishing"]);
    expect(view.thin.map((p) => p.name)).toEqual(["Herbalism", "Leatherworking", "Skinning"]);
    expect(view.gaps.map((p) => [p.name, p.best])).toEqual([
      ["Alchemy", 160],
      ["Blacksmithing", 120],
      ["Engineering", 70],
      ["Mining", 142],
      ["Cooking", 150],
    ]);
    expect(view.empty).toBe(false);
  });

  it("lists every character per profession, the best starred", () => {
    expect(byName("Tailoring").entries.map((e) => [e.character.name, e.rank, e.max, e.best])).toEqual([
      ["Mira Sunstrider", 300, 300, true],
      ["Lia Thornwhisper", 205, 225, false],
      ["Ves Doombringer", 187, 225, false],
    ]);
    expect(byName("Cooking")).toMatchObject({ kind: "secondary", status: "gap", best: 150 });
  });

  it("builds the character × profession matrix, characters without professions last", () => {
    expect(view.matrix.columns.map((c) => c.name)).toEqual([
      "Alchemy",
      "Blacksmithing",
      "Enchanting",
      "Engineering",
      "Herbalism",
      "Leatherworking",
      "Mining",
      "Skinning",
      "Tailoring",
      "Cooking",
      "First Aid",
      "Fishing",
    ]);
    expect(view.matrix.rows.map((r) => [r.character.name, r.none])).toEqual([
      ["Mira Sunstrider", false],
      ["Bob Example", false],
      ["Ves Doombringer", false],
      ["Lia Thornwhisper", false],
      ["Tok Ironhide", false],
      ["Ruk Bloodhoof", false],
      ["Grom Ashfeller", false],
      ["Kel Dawnhammer", false],
      ["Sela Moonbrook", false],
      ["Zul Kazrek", true],
    ]);
    expect(view.matrix.rows[0]?.cells["197"]).toEqual({ rank: 300, max: 300 });
    expect(view.matrix.rows[0]?.cells["171"]).toBeUndefined();
  });

  it("stars every character tied for the best, and keeps a skill line the table does not know", () => {
    const d = normalize(
      parseLua(`return { schemaVersion = 1, self = { battleTag = "Ada#1001", chars = {
        A = { name = "Ada Example", level = 20, professions = { [186] = { rank = 100, max = 150 }, [999] = { name = "Camping", rank = 20 } } },
        B = { name = "Ada Alt", level = 10, professions = { [186] = { rank = 100, max = 150 }, [171] = { name = "Alchemy" } } } } } }`),
    );
    const v = professions(d, NOW);
    expect(v.professions.find((p) => p.name === "Mining")?.entries.map((e) => e.best)).toEqual([true, true]);
    expect(v.professions.find((p) => p.name === "Alchemy")).toMatchObject({ status: "gap", entries: [] });
    expect(v.professions.at(-1)).toMatchObject({ skillLine: "999", name: "Camping", status: "gap", best: 20 });
    expect(v.matrix.columns.at(-1)).toEqual({ skillLine: "999", name: "Camping" });
  });

  it("knows when nobody has a profession yet", () => {
    const d = normalize(
      parseLua('return { schemaVersion = 1, self = { battleTag = "Ada#1001", chars = { A = {} } } }'),
    );
    const v = professions(d, NOW);
    expect(v.empty).toBe(true);
    expect(v.gaps).toHaveLength(12);
    expect(v.matrix.rows.map((r) => r.none)).toEqual([true]);
  });
});
