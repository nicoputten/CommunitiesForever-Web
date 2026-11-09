import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import type { ItemDatabase } from "@/core/recipes/build";
import { openDatabase, type Db } from "@/server/db";
import { bossDrops, dungeonBosses } from "@/server/db/schema";
import { addonLootFile, dungeonBossViews } from "@/server/bossViews";
import { writeItemDatabase } from "@/server/itemDb";

// WEB-96: the bosses and boss drops the item import writes, and what the dungeon page and the addon's loot file read.
// Invented data.

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-bosses-"));
  db = openDatabase(path.join(dir, "test.sqlite"));
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const META = { build: "1.60.1.70862", era: "1.15.9.70576", cmangos: "0123456789abcdef0123456789abcdef01234567" };

function data(): ItemDatabase {
  return {
    items: [
      { id: 7001, name: "Test Blade", quality: 3, iconName: "inv_sword_test", classId: 2, subclassId: 7 },
      { id: 7002, name: "Pattern: Test Robe", quality: 2, classId: 9, subclassId: 2 },
    ],
    recipes: [],
    reagents: [],
    sources: [],
    sets: [],
    bosses: [
      { id: 9001, name: "Test Brute", dungeonId: "dm", position: 1, final: false, optional: false },
      { id: 9003, name: "Test Captain", dungeonId: "dm", position: 2, final: true, optional: false },
      { id: 9002, name: "Test Cook", dungeonId: "dm", position: 3, final: false, optional: true },
      { id: 9102, name: "Test Champion", dungeonId: "sm", wingId: "armory", position: 1, final: true, optional: false },
      { id: 9101, name: "Test Ghost", dungeonId: "sm", wingId: "graveyard", position: 1, final: true, optional: false },
    ],
    bossDrops: [
      { bossId: 9003, itemId: 7001, position: 1, chance: 36, classId: 2, subclassId: 7, classes: 9 },
      {
        bossId: 9003,
        itemId: 7002,
        position: 2,
        chance: 0.4,
        classId: 9,
        subclassId: 2,
        recipeId: 20001,
        skill: 150,
        line: 185,
      },
      { bossId: 9003, itemId: 7999, position: 3, chance: 2, questId: 300 },
    ],
  };
}

describe("dungeon bosses", () => {
  it("are written with the import, in one go; the same data again changes nothing", () => {
    expect(writeItemDatabase(db, data(), META, 100)).toEqual({ changed: true });
    expect(db.select().from(dungeonBosses).all()).toHaveLength(5);
    expect(db.select().from(bossDrops).all()).toHaveLength(3);
    expect(writeItemDatabase(db, data(), META, 200)).toEqual({ changed: false });

    // A new import replaces them.
    const next = data();
    next.bosses = next.bosses.slice(0, 1);
    next.bossDrops = [];
    expect(writeItemDatabase(db, next, META, 300)).toEqual({ changed: true });
    expect(
      db
        .select()
        .from(dungeonBosses)
        .all()
        .map((b) => b.id),
    ).toEqual([9001]);
    expect(db.select().from(bossDrops).all()).toEqual([]);
  });

  it("a dungeon's bosses in order with final and optional, and their drops with the item", () => {
    writeItemDatabase(db, data(), META, 100);
    const dm = dungeonBossViews(db, "dm");
    expect(dm.map((b) => [b.position, b.name, b.final, b.optional, b.drops.length])).toEqual([
      [1, "Test Brute", false, false, 0],
      [2, "Test Captain", true, false, 3],
      [3, "Test Cook", false, true, 0],
    ]);
    expect(dm[1]!.drops).toEqual([
      {
        bossId: 9003,
        itemId: 7001,
        position: 1,
        chance: 36,
        classId: 2,
        subclassId: 7,
        classes: 9,
        name: "Test Blade",
        quality: 3,
        iconName: "inv_sword_test",
        item: data().items[0],
      },
      {
        bossId: 9003,
        itemId: 7002,
        position: 2,
        chance: 0.4,
        classId: 9,
        subclassId: 2,
        recipeId: 20001,
        skill: 150,
        line: 185,
        name: "Pattern: Test Robe",
        quality: 2,
        iconName: null,
        item: data().items[1],
      },
      // An item the items table doesn't have: no name or tooltip.
      { bossId: 9003, itemId: 7999, position: 3, chance: 2, questId: 300, name: null, quality: null, iconName: null },
    ]);
  });

  it("a wing's bosses, or all of the dungeon's wing by wing", () => {
    writeItemDatabase(db, data(), META, 100);
    expect(dungeonBossViews(db, "sm", "armory").map((b) => b.name)).toEqual(["Test Champion"]);
    expect(dungeonBossViews(db, "sm").map((b) => [b.wingId, b.name])).toEqual([
      ["graveyard", "Test Ghost"],
      ["armory", "Test Champion"],
    ]);
    expect(dungeonBossViews(db, "rfc")).toEqual([]);
  });

  it("the addon's loot file from the last import; none before one", () => {
    expect(addonLootFile(db)).toBeUndefined();
    writeItemDatabase(db, data(), META, 100);
    const lua = addonLootFile(db)!;
    expect(lua).toContain(`-- build ${META.build}.`);
    expect(addonLootFile(db)).toBe(lua);
    const value = parseLua(lua.replace("local _, ns = ...\nns.LootData = {", "LootData = {")).globals.LootData as {
      dungeons: Record<string, { id: number; drops: unknown }[]>;
    };
    expect(Object.keys(value.dungeons)).toEqual(["dm", "smgy", "smarm"]);
    expect(value.dungeons.dm!.map((b) => b.id)).toEqual([9001, 9003, 9002]);
  });
});
