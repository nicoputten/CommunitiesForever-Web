import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLua, type LuaTable } from "@/core/lua";

// Every fixture parses to the shape normalize (WEB-04) starts from: the `global` table of CommunitiesForeverDB.
function read(path: string): string {
  return readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8");
}

describe("fixtures parse", () => {
  it.each(["addon/v0.3/savedvariables.lua", "addon/v0.4/savedvariables.lua"])("%s: return of global", (path) => {
    const chunk = parseLua(read(path));
    expect(chunk.globals).toEqual({});
    const global = chunk.returned as LuaTable;
    expect(Object.keys(global).sort()).toEqual([
      "locations",
      "people",
      "presence",
      "runs",
      "schemaVersion",
      "self",
      "settings",
    ]);
    expect(global.schemaVersion).toBe(1);
    expect((global.self as LuaTable).battleTag).toBe("Ada#1001");
    expect(Object.keys((global.people as LuaTable)["Bob#2002"] as LuaTable)).toContain("chars");
    expect(global.runs).toEqual({});
    expect((global.settings as LuaTable).sendInterval).toBe(0.2);
  });

  it("real/beta-2026-10.lua: CommunitiesForeverDB as the game writes it", () => {
    const chunk = parseLua(read("real/beta-2026-10.lua"));
    expect(chunk.returned).toBeUndefined();
    expect(Object.keys(chunk.globals)).toEqual(["CommunitiesForeverDB"]);
    const db = chunk.globals.CommunitiesForeverDB as LuaTable;
    expect(Object.keys(db)).toEqual(["profileKeys", "global"]);

    const global = db.global as LuaTable;
    expect(Object.keys(global).sort()).toEqual(["locations", "presence", "schemaVersion", "self", "settings"]);
    expect(global.schemaVersion).toBe(1);

    const self = global.self as LuaTable;
    expect(self.battleTag).toBe("Ada#1001");
    expect(self.accountId).toBe("0a1b2c3d4e5f");
    const char = (self.chars as LuaTable)["Player-6842-0000A001"] as LuaTable;
    expect(char).toMatchObject({
      guid: "Player-6842-0000A001",
      name: "Ada Example",
      realm: "CAMWOW EU4 Realm 2 PvP",
      classFile: "WARLOCK",
      level: 6,
      mainTree: 1,
      lastPlayed: 1792615003,
    });
    expect(char.talents).toEqual([
      { name: "Affliction", points: 1 },
      { name: "Demonology", points: 0 },
      { name: "Destruction", points: 0 },
    ]);
    expect((char.professions as LuaTable)["186"]).toEqual({ max: 75, name: "Mining", rank: 3 });
    expect((char.quests as LuaTable)["808"]).toEqual({ dungeon: false, title: "Minshina's Skull", area: "Durotar" });
    expect(Object.keys(char.quests as LuaTable)).toHaveLength(12);

    const settings = global.settings as LuaTable;
    expect(settings.clubId).toBe(400000001);
    expect((settings.window as LuaTable).height).toBe(509.1666259765625);
    expect((settings.dungeonTree as LuaTable).groups).toEqual({});
    expect(Object.keys(global.presence as LuaTable)).toHaveLength(6);
    expect(Object.keys(global.locations as LuaTable)).toHaveLength(3);
  });
});
