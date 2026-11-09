import { describe, expect, it } from "vitest";
import { buildItemSets } from "@/core/recipes/itemSets";
import type { SpellInfo } from "@/core/recipes/spellText";

// WEB-99: item sets from the client's ItemSet and ItemSetSpell rows (invented IDs and names, the real columns).

const spells: Record<number, SpellInfo> = {
  1: { description: "+$s1 Armor.", effects: [{ points: 200 }] },
  2: { description: "Increases damage done by up to $s1.", effects: [{ points: 23 }] },
};
const lookup = (id: number) => spells[id];

const setRow = (id: number, name: string, items: number[]) => {
  const row: Record<string, string> = { ID: String(id), Name_lang: name };
  for (let i = 0; i < 17; i++) row[`ItemID_${i}`] = String(items[i] ?? 0);
  return row;
};
const bonus = (id: number, set: number, spell: number, threshold: number) => ({
  ID: String(id),
  ItemSetID: String(set),
  SpellID: String(spell),
  Threshold: String(threshold),
});

describe("buildItemSets", () => {
  it("names pieces from the client, else cmangos; sorts bonuses by threshold", () => {
    const { sets, setOf } = buildItemSets({
      sets: [setRow(7, "Test Garb", [10, 11, 12])],
      spells: [bonus(2, 7, 2, 3), bonus(1, 7, 1, 2)],
      sparse: new Map([[10, { ID: "10", Display_lang: "Test Hood" }]]),
      templates: new Map([[11, { entry: 11, name: "Test Mantle" }]]),
      spellLookup: lookup,
    });
    expect(sets).toEqual([
      {
        id: 7,
        name: "Test Garb",
        items: [{ id: 10, name: "Test Hood" }, { id: 11, name: "Test Mantle" }, { id: 12 }],
        bonuses: [
          { threshold: 2, text: "+200 Armor." },
          { threshold: 3, text: "Increases damage done by up to 23." },
        ],
      },
    ]);
    expect(setOf(12)).toBe(7);
    expect(setOf(99)).toBeUndefined();
  });

  it("skips sets without a name or a piece, and pieces listed twice", () => {
    const { sets } = buildItemSets({
      sets: [setRow(1, "", [10]), setRow(2, "Empty", []), setRow(3, "Twice", [10, 10])],
      spells: [bonus(1, 3, 0, 2), bonus(2, 3, 1, 0)],
      sparse: new Map(),
      templates: new Map(),
      spellLookup: lookup,
    });
    expect(sets).toEqual([{ id: 3, name: "Twice", items: [{ id: 10 }], bonuses: [] }]);
  });
});
