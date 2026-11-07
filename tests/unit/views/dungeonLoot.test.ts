import { describe, expect, it } from "vitest";
import { chanceText, lootTypeText, usable } from "@/core/loot";
import { recordCharacters, peopleViews } from "@/core/views/characters";
import { bossesLoot, type BossInput } from "@/core/views/dungeonLoot";
import { NOW, sample } from "./sample";

// WEB-102 (board DL04): the Bosses & loot box's view model on the design prompt's group (sample.ts: Nico plays Ves
// the warlock, Grom the warrior and Sela the druid; Ves and Lia know Cooking).

const data = sample();
const characters = recordCharacters(data, NOW);
const people = peopleViews(data, NOW);
const NICO = people.find((p) => p.displayName === "Nico")!.battleTag!;

const drop = (itemId: number, chance: number, over: Partial<BossInput["drops"][number]> = {}) => ({
  itemId,
  chance,
  name: `Item ${itemId} name`,
  quality: 2,
  iconName: "inv_misc_questionmark",
  ...over,
});

const BOSSES: BossInput[] = [
  {
    id: 1,
    name: "Rhahk'Zor",
    final: false,
    optional: false,
    drops: [drop(872, 77, { classId: 2, subclassId: 5, inventoryType: 17 })],
  },
  {
    id: 7,
    name: "Cookie",
    final: false,
    optional: true,
    drops: [
      drop(5197, 41, { classId: 2, subclassId: 4, inventoryType: 13 }),
      drop(728, 12, {
        classId: 9,
        subclassId: 5,
        recipeId: 2795,
        skill: 75,
        line: 185,
        name: "Recipe: Westfall Stew",
        quality: 1,
      }),
      drop(5056, 100, { classId: 12, subclassId: 0, questId: 214, name: null, iconName: null, quality: null }),
    ],
  },
];

describe("Bosses & loot", () => {
  const view = bossesLoot({ bosses: BOSSES, characters, viewer: NICO, known: [], professions: [] });

  it("numbers the bosses in the client's order, optional ones marked, each with an anchor", () => {
    expect(view.bosses.map((b) => [b.n, b.name, b.optional, b.anchor])).toEqual([
      [1, "Rhahk'Zor", false, "boss-1"],
      [2, "Cookie", true, "boss-7"],
    ]);
  });

  it("gives each drop its name, quality, type line and chance; a quest drop its tag", () => {
    expect(view.bosses[0]!.rows[0]).toEqual({
      itemId: 872,
      name: "Item 872 name",
      quality: "uncommon",
      icon: "inv_misc_questionmark",
      type: "Two-Hand · Mace",
      chance: "77%",
      drop: { classId: 2, subclassId: 5 },
      quest: false,
    });
    const quest = view.bosses[1]!.rows[2]!;
    expect([quest.name, quest.quality, quest.type, quest.quest, quest.icon]).toEqual([
      "Item 5056",
      "common",
      "Quest item",
      true,
      undefined,
    ]);
  });

  it("a recipe nobody knows: its drawer, the tag and who has the profession", () => {
    const professions = [
      { guid: "Player-1-VES", skillLineId: 185, skill: 75 },
      { guid: "Player-1-LIA", skillLineId: 185, skill: 150 },
      // Under the 75 the recipe needs: can't learn it yet.
      { guid: "Player-1-KEL", skillLineId: 185, skill: 40 },
      { guid: "Player-1-BOB", skillLineId: 164, skill: 200 },
    ];
    const recipe = bossesLoot({ bosses: BOSSES, characters, viewer: NICO, known: [], professions }).bosses[1]!.rows[1]!;
    expect(recipe.type).toBe("Recipe · Cooking");
    expect(recipe.recipe).toEqual({
      known: false,
      href: "/professions/cooking?recipe=2795",
      requires: "Requires Cooking (75)",
      canLearn: [
        { guid: "Player-1-LIA", name: "Lia Thornwhisper", skill: "Cooking 150", colorToken: "--priest" },
        { guid: "Player-1-VES", name: "Ves Doombringer", skill: "Cooking 75", colorToken: "--warlock-text" },
      ],
    });
    const known = bossesLoot({
      bosses: BOSSES,
      characters,
      viewer: NICO,
      known: [{ guid: "Player-1-LIA", recipeId: 2795 }],
      professions,
    }).bosses[1]!.rows[1]!;
    expect(known.recipe).toMatchObject({ known: true, canLearn: [] });
  });

  it("offers your characters for Usable by, the most recently played first", () => {
    expect(view.characters.map((c) => [c.name, c.classFile])).toEqual([
      ["Ves Doombringer", "WARLOCK"],
      ["Grom Ashfeller", "WARRIOR"],
      ["Sela Moonbrook", "DRUID"],
    ]);
  });

  it("dims what the picked class can never use: a warlock no mace, a warrior every mace", () => {
    const mace = view.bosses[0]!.rows[0]!.drop;
    expect(usable("WARLOCK", mace)).toBe(false);
    expect(usable("WARRIOR", mace)).toBe(true);
    expect(usable("WARLOCK", view.bosses[1]!.rows[2]!.drop)).toBe(true);
  });
});

describe("loot type lines and chances (as the addon's DungeonLoot.typeText)", () => {
  it("names armor, weapons and others", () => {
    expect(lootTypeText({ classId: 4, subclassId: 2 }, 7)).toBe("Leather · Legs");
    expect(lootTypeText({ classId: 4, subclassId: 1 }, 16)).toBe("Back");
    expect(lootTypeText({ classId: 4, subclassId: 0 }, 11)).toBe("Finger");
    expect(lootTypeText({ classId: 4, subclassId: 6 }, 14)).toBe("Shield");
    expect(lootTypeText({ classId: 2, subclassId: 15 }, 13)).toBe("Dagger");
    expect(lootTypeText({ classId: 2, subclassId: 10 }, 17)).toBe("Staff");
    expect(lootTypeText({ classId: 2, subclassId: 7 }, 13)).toBe("One-Hand · Sword");
    expect(lootTypeText({ classId: 2, subclassId: 8 })).toBe("Two-Hand · Sword");
    expect(lootTypeText({ classId: 2, subclassId: 0 })).toBe("Axe");
    expect(lootTypeText({ classId: 9, subclassId: 99 })).toBe("Recipe");
    expect(lootTypeText({ classId: 15 })).toBe("Miscellaneous");
    expect(lootTypeText({})).toBe("");
  });

  it("rounds chances, under 1 % as <1%", () => {
    expect([chanceText(36.4), chanceText(0.5), chanceText(0), chanceText(99.6)]).toEqual(["36%", "<1%", "", "100%"]);
  });
});
