import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLASS_IDS, ARMOR_BY_CLASS, WEAPONS_BY_CLASS, usable } from "@/core/loot";
import { RUNNABLE_DUNGEONS } from "@/core/gamedata";
import { FIT_BELOW, dungeonFit } from "@/core/levelFit";
import { BEFORE_START, NO_BOSS_FOR, runGroup, runProgress } from "@/core/runProgress";

// WEB-102, WEB-97: the addon's golden cases (tests/fixtures/addon-golden/README.md), unchanged. The site's rules must
// give exactly what the addon's Dungeons.lua, DungeonLoot.lua and RunProgress.lua give.

/* eslint-disable @typescript-eslint/no-explicit-any */
const golden = (name: string): any =>
  JSON.parse(readFileSync(path.join(__dirname, "../fixtures/addon-golden", name), "utf8"));

describe("dungeon-fit-cases.json", () => {
  const file = golden("dungeon-fit-cases.json");
  it("has the same margin", () => expect(file.fitBelow).toBe(FIT_BELOW));
  for (const c of file.cases)
    it(`level ${c.level} in ${c.dungeon ?? ""} ${c.min}-${c.max}: ${c.fit}`, () => {
      // A case with a dungeon is that wing's range: the site's must be the same (the client's Group Finder).
      if (c.dungeon !== undefined) {
        const d = RUNNABLE_DUNGEONS.find((x) => x.addonId === c.dungeon)!;
        expect(d.typicalLevels).toEqual({ min: c.min, max: c.max });
      }
      expect(dungeonFit(c.level, c.min, c.max)).toBe(c.fit);
    });
});

describe("loot-usable-cases.json", () => {
  const file = golden("loot-usable-cases.json");
  it("has the same class IDs and tables", () => {
    expect(file.classIds).toEqual(CLASS_IDS);
    expect(file.armorByClass).toEqual(ARMOR_BY_CLASS);
    expect(file.weaponsByClass).toEqual(WEAPONS_BY_CLASS);
  });
  for (const c of file.cases) {
    const drop = {
      classId: c.cls,
      subclassId: c.sub,
      ...(c.classes !== undefined ? { classes: c.classes } : {}),
      ...(c.quest !== undefined ? { questId: c.quest } : {}),
    };
    it(`${c.class} ${c.cls}:${c.sub}${c.classes !== undefined ? ` mask ${c.classes}` : ""}${c.quest !== undefined ? " quest" : ""}`, () =>
      expect(usable(c.class, drop)).toBe(c.usable));
  }
});

describe("run-progress-cases.json", () => {
  const file = golden("run-progress-cases.json");
  it("has the same windows", () => {
    expect(file.beforeStart).toBe(BEFORE_START);
    expect(file.noBossFor).toBe(NO_BOSS_FOR);
  });
  for (const c of file.cases)
    it(c.name, () => {
      const p = runProgress(
        {
          startsAt: c.run.startsAt,
          cancelled: c.run.state === "cancelled",
          group: runGroup(c.run.answers, c.run.organiser?.guid),
        },
        c.bosses ?? file.bosses,
        c.kills.map((k: any) => ({ guid: k.guid, encounterId: k.encounterID, at: k.at })),
        c.now,
        c.resetAt,
      );
      const got: Record<string, unknown> = {
        state: p.state,
        done: p.done,
        total: p.total,
        cleared: p.cleared,
        skipped: [...p.skipped].sort((a, b) => a - b),
        visible: p.visible,
      };
      if (p.label !== undefined) got.label = p.label;
      if (p.firstKill !== undefined) got.firstKill = p.firstKill;
      expect(got).toEqual(c.expect);
    });
});
