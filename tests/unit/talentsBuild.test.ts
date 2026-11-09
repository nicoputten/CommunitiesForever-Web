import { describe, expect, it } from "vitest";
import type { SpellInfo } from "@/core/recipes/spellText";
import { buildTalentTrees, type TalentTable } from "@/core/talents/build";

// WEB-100: the talent tree import (src/core/talents/build.ts) on a small made-up class tree shaped like the Forever
// client's (build 1.60.1: one TraitTree per class, three trees side by side on a 600-unit grid, rows gated 5 points
// apart by node groups with a TraitCond). IDs, names and texts are invented.

type Rows = Record<string, string>[];
const row = (o: Record<string, string | number>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) as Record<string, string>;

const TREE = 900;
const LEFT = [1000, 5000, 9000];
const TOP = 2000;

interface NodeSpec {
  id: number;
  tree: number;
  col: number;
  row: number;
  ranks: number;
  spell: number;
  /** Position override (a stray node). */
  x?: number;
  y?: number;
}

const NODES: NodeSpec[] = [
  { id: 1, tree: 0, col: 1, row: 1, ranks: 5, spell: 501 },
  { id: 2, tree: 0, col: 2, row: 2, ranks: 3, spell: 502 },
  { id: 3, tree: 1, col: 1, row: 1, ranks: 2, spell: 503 },
  { id: 4, tree: 2, col: 1, row: 1, ranks: 5, spell: 504 },
  { id: 5, tree: 2, col: 3, row: 2, ranks: 1, spell: 505, y: TOP + 600 - 10 }, // 10 off the line: still row 2
  { id: 6, tree: 2, col: 2, row: 3, ranks: 1, spell: 506 },
  { id: 7, tree: 2, col: 0, row: 0, ranks: 1, spell: 507, x: 102800, y: 5740 }, // off the grid
  { id: 8, tree: 1, col: 4, row: 7, ranks: 1, spell: 508 },
];

function tables(over: Partial<Record<TalentTable, Rows>> = {}): Partial<Record<TalentTable, Rows>> {
  const t: Partial<Record<TalentTable, Rows>> = {
    SkillRaceClassInfo: [row({ ID: 1, SkillID: 354, ClassMask: 256 })],
    SkillLineXTraitTree: [row({ ID: 1, SkillLineID: 354, TraitTreeID: TREE })],
    TalentTab: [
      row({ ID: 301, Name_lang: "Destruction", Description_lang: "", OrderIndex: 2, ClassMask: 256 }),
      row({ ID: 302, Name_lang: "Affliction", Description_lang: "Curses.", OrderIndex: 0, ClassMask: 256 }),
      row({ ID: 303, Name_lang: "Demonology", Description_lang: "", OrderIndex: 1, ClassMask: 256 }),
    ],
    TraitNode: NODES.map((n) =>
      row({
        ID: n.id,
        TraitTreeID: TREE,
        PosX: n.x ?? LEFT[n.tree]! + (n.col - 1) * 600,
        PosY: n.y ?? TOP + (n.row - 1) * 600,
      }),
    ),
    TraitNodeEntry: NODES.map((n) => row({ ID: 100 + n.id, TraitDefinitionID: 200 + n.id, MaxRanks: n.ranks })),
    TraitNodeXTraitNodeEntry: NODES.map((n) =>
      row({ ID: 300 + n.id, TraitNodeID: n.id, TraitNodeEntryID: 100 + n.id, _Index: 0 }),
    ),
    TraitDefinition: NODES.map((n) =>
      row({
        ID: 200 + n.id,
        SpellID: n.spell,
        OverrideName_lang: n.id === 6 ? "Renamed" : "",
        OverrideDescription_lang: "",
      }),
    ),
    // Trees: groups 10, 11, 12 (no condition); a smaller condition-less group inside tree 0; row gates per tree.
    TraitNodeGroupXTraitNode: [
      ...NODES.map((n) => row({ ID: 400 + n.id, TraitNodeGroupID: 10 + n.tree, TraitNodeID: n.id })),
      row({ ID: 450, TraitNodeGroupID: 19, TraitNodeID: 1 }),
      row({ ID: 451, TraitNodeGroupID: 20, TraitNodeID: 2 }),
      row({ ID: 452, TraitNodeGroupID: 21, TraitNodeID: 5 }),
      row({ ID: 453, TraitNodeGroupID: 22, TraitNodeID: 6 }),
      row({ ID: 454, TraitNodeGroupID: 23, TraitNodeID: 8 }),
    ],
    TraitNodeGroupXTraitCond: [
      row({ ID: 1, TraitCondID: 31, TraitNodeGroupID: 20 }),
      row({ ID: 2, TraitCondID: 31, TraitNodeGroupID: 21 }),
      row({ ID: 3, TraitCondID: 32, TraitNodeGroupID: 22 }),
      row({ ID: 4, TraitCondID: 36, TraitNodeGroupID: 23 }),
    ],
    TraitCond: [
      row({ ID: 31, SpentAmountRequired: 5 }),
      row({ ID: 32, SpentAmountRequired: 10 }),
      row({ ID: 36, SpentAmountRequired: 30 }),
    ],
  };
  return { ...t, ...over };
}

const SPELLS: Record<number, SpellInfo> = {
  501: { name: "Sharp Mind", description: "Increases your spell damage by $s1%.", effects: [{ points: 2 }] },
  502: { name: "Quick Hands", description: "Reduces the cast time by $/1000;S1 sec.", effects: [{ points: 100 }] },
  504: { name: "Ember", description: "", effects: [] },
  505: { name: "Burn", description: "A burst of fire.", effects: [] },
  506: { name: "Old Name", description: "Deals $s1 damage.", effects: [{ points: 50 }] },
};
const spells = (id: number) => SPELLS[id];

describe("talents: import (WEB-100)", () => {
  it("builds a class's three trees left to right with names, grid places, gates and texts per rank", () => {
    const [warlock, ...rest] = buildTalentTrees(tables(), spells);
    expect(rest).toEqual([]);
    expect(warlock).toMatchObject({ classFile: "WARLOCK", traitTreeId: TREE, columns: 4, rows: 7 });
    expect(warlock!.trees.map((t) => t.name)).toEqual(["Affliction", "Demonology", "Destruction"]);
    expect(warlock!.trees[0]!.description).toBe("Curses.");
    expect(warlock!.trees[2]).not.toHaveProperty("description");

    const [sharp, quick] = warlock!.trees[0]!.talents;
    expect(sharp).toEqual({
      id: 1,
      name: "Sharp Mind",
      spellId: 501,
      maxRanks: 5,
      row: 1,
      column: 1,
      posX: 1000,
      posY: 2000,
      texts: [
        "Increases your spell damage by 2%.",
        "Increases your spell damage by 4%.",
        "Increases your spell damage by 6%.",
        "Increases your spell damage by 8%.",
        "Increases your spell damage by 10%.",
      ],
    });
    expect(quick).toMatchObject({
      row: 2,
      column: 2,
      gate: 5,
      texts: [
        "Reduces the cast time by 0.1 sec.",
        "Reduces the cast time by 0.2 sec.",
        "Reduces the cast time by 0.3 sec.",
      ],
    });
  });

  it("puts a talent in tree order, places a node near a grid line and leaves a stray node off the grid", () => {
    const destruction = buildTalentTrees(tables(), spells)[0]!.trees[2]!;
    expect(destruction.talents.map((t) => [t.id, t.row, t.column])).toEqual([
      [4, 1, 1],
      [5, 2, 3],
      [6, 3, 2],
      [7, undefined, undefined],
    ]);
    expect(destruction.talents[0]!.texts).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(destruction.talents[1]).toMatchObject({ name: "Burn", texts: ["A burst of fire."] });
    expect(destruction.talents[2]).toMatchObject({ name: "Renamed", gate: 10, texts: ["Deals 50 damage."] });
    // No spell data: no name, no text, still a talent with its ranks.
    expect(destruction.talents[3]).not.toHaveProperty("name");
    const demonology = buildTalentTrees(tables(), spells)[0]!.trees[1]!;
    expect(demonology.talents.map((t) => [t.id, t.row, t.column, t.gate])).toEqual([
      [3, 1, 1, undefined],
      [8, 7, 4, 30],
    ]);
  });

  it("skips a class whose trees it can't tell apart, and a tree of no known class", () => {
    const twoTrees = tables();
    twoTrees.TraitNodeGroupXTraitNode = twoTrees.TraitNodeGroupXTraitNode!.map((r) =>
      r.TraitNodeGroupID === "12" ? { ...r, TraitNodeGroupID: "11" } : r,
    );
    expect(buildTalentTrees(twoTrees, spells)).toEqual([]);
    expect(buildTalentTrees(tables({ SkillRaceClassInfo: [] }), spells)).toEqual([]);
    expect(buildTalentTrees({}, spells)).toEqual([]);
  });

  it("leaves out a talent without a spell or with impossible ranks", () => {
    const t = tables();
    t.TraitNodeEntry = t.TraitNodeEntry!.map((r) => (r.ID === "101" ? { ...r, MaxRanks: "9" } : r));
    t.TraitDefinition = t.TraitDefinition!.map((r) => (r.ID === "202" ? { ...r, SpellID: "0" } : r));
    expect(buildTalentTrees(t, spells)[0]!.trees[0]!.talents).toEqual([]);
  });
});
