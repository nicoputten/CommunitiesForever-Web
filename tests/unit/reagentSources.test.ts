import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/core/recipes/csv";
import { buildItemDatabase, CMANGOS_TABLES, DB2_TABLES, type ImportInput } from "@/core/recipes/build";
import { lootChances, zoneFinder } from "@/core/recipes/reagentSources";
import { readColumns, readRows, type SqlRow } from "@/core/recipes/sqlDump";

// WEB-98: where to get a reagent, from the item import's invented fixtures (tests/fixtures/items/README.md).

const DIR = path.join(__dirname, "../fixtures/items");
const csv = (file: string) => parseCsv(readFileSync(path.join(DIR, file), "utf8")).rows;

function input(): ImportInput {
  const db2: ImportInput["db2"] = {};
  for (const t of DB2_TABLES) db2[t] = csv(`forever/${t}.csv`);
  const sql = readFileSync(path.join(DIR, "cmangos.sql"), "utf8");
  const columns = readColumns(sql, CMANGOS_TABLES);
  const cmangos: ImportInput["cmangos"] = {};
  for (const t of CMANGOS_TABLES) cmangos[t] = readRows(sql, t, columns[t] ?? []);
  return { db2, era: { abilities: csv("era/SkillLineAbility.csv"), learn: csv("era/SpellEffect-learn.csv") }, cmangos };
}

const built = buildItemDatabase(input());
const data = { ...built, reagentSources: built.reagentSources ?? [] };
const of = (item: number) => data.reagentSources.filter((s) => s.itemId === item).map(({ itemId: _, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars

describe("reagent sources (import)", () => {
  it("vendor: spawned vendors first with their zone, then one that never spawns; a limited stock apart", () => {
    expect(of(5002).filter((s) => s.kind.startsWith("vendor"))).toEqual([
      { kind: "vendor", position: 1, name: "Test Thread Merchant", zone: "Test City" },
      { kind: "vendor", position: 2, name: "Test Hidden Merchant" },
    ]);
    expect(of(5011).filter((s) => s.kind.startsWith("vendor"))).toEqual([
      { kind: "vendor_limited", position: 1, name: "Test Leather Seller", zone: "Test Forest" },
    ]);
  });

  it("drop: group shares and references count, quest-only drops don't; farmable creatures first", () => {
    // Test Wolf: 40 % (its group's other row takes 60); Test Boss: 30 %; Test Wolf Pup: only for a quest.
    expect(of(5002).filter((s) => s.kind === "drop")).toEqual([
      { kind: "drop", position: 1, name: "Test Wolf", chance: 40 },
      { kind: "drop", position: 2, name: "Test Boss", chance: 30 },
    ]);
    // Test Wolf Elder (3 spawns) at 2 % before Test Boss (1 spawn) at 10 % through its reference table.
    expect(of(5013).filter((s) => s.kind === "drop")).toEqual([
      { kind: "drop", position: 1, name: "Test Wolf Elder", chance: 2 },
      { kind: "drop", position: 2, name: "Test Boss", chance: 10 },
    ]);
  });

  it("gathered: skinning names the creature type and levels; herb and ore nodes by their lock", () => {
    // Test Bear 20–22 at 50 %, Test Wolf 18–19 at 40 %; the pup's 5 % is too rare to count.
    expect(of(5011).filter((s) => s.kind === "skinning")).toEqual([
      { kind: "skinning", position: 1, creatureType: "Beast", minLevel: 18, maxLevel: 22 },
    ]);
    // A chest with a lockpicking lock is no herb node.
    expect(of(5012)).toEqual([{ kind: "herbalism", position: 1, name: "Test Bloom" }]);
    expect(of(5013).filter((s) => s.kind === "mining")).toEqual([{ kind: "mining", position: 1, name: "Test Vein" }]);
  });

  it("crafted: the obtainable recipes that make it", () => {
    expect(of(5001)).toEqual([{ kind: "crafted", position: 1, recipeId: 9001 }]);
  });

  it("none: a reagent nothing sells, drops or makes has no rows", () => {
    expect(data.reagents.some((r) => r.itemId === 5015)).toBe(true);
    expect(of(5015)).toEqual([]);
  });

  it("only items recipes use", () => {
    const used = new Set(data.reagents.map((r) => r.itemId));
    expect(data.reagentSources.every((s) => used.has(s.itemId))).toBe(true);
  });
});

describe("lootChances", () => {
  const row = (entry: number, item: number, chance: number, group = 0, ref = 1): SqlRow => ({
    entry,
    item,
    ChanceOrQuestChance: chance,
    groupid: group,
    mincountOrRef: ref,
  });

  it("splits what a group leaves among its rows with chance 0", () => {
    const out = lootChances([row(1, 10, 50, 1), row(1, 11, 0, 1), row(1, 12, 0, 1)], [], new Set([11, 12]));
    expect(out.get(1)).toEqual(
      new Map([
        [11, 25],
        [12, 25],
      ]),
    );
  });

  it("multiplies through nested references and stops at a loop", () => {
    const refs = [row(100, 0, 50, 0, -101), row(101, 10, 20), row(101, 0, 100, 0, -100)];
    const out = lootChances([row(1, 0, 100, 0, -100)], refs, new Set([10]));
    expect(out.get(1)?.get(10)).toBe(10);
  });

  it("leaves out quest-only drops and unwanted items", () => {
    expect(lootChances([row(1, 10, -100), row(1, 11, 50)], [], new Set([10])).size).toBe(0);
  });
});

describe("zoneFinder", () => {
  const zone = zoneFinder({
    AreaTable: csv("forever/AreaTable.csv"),
    UiMapAssignment: csv("forever/UiMapAssignment.csv"),
    Map: csv("forever/Map.csv"),
  });

  it("the smallest zone rectangle that holds the point; a subzone's doesn't count", () => {
    expect(zone(0, 50, 50)).toBe("Test City");
    expect(zone(0, 500, 500)).toBe("Test Forest");
    expect(zone(0, 5000, 5000)).toBeUndefined();
  });

  it("an instance by its map's name", () => {
    expect(zone(36, 0, 0)).toBe("Deadmines");
  });
});
