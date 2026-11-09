import { describe, expect, it } from "vitest";
import type { ClassTalentsRecord, TalentRecord } from "@/core/talents/build";
import { pointsText, talentTooltips } from "@/core/views/talentTooltip";

// WEB-100: which tooltip each talent tree gets (B with the grid when the synced nodes name the talents, else A).
// A made-up class: tree 1 has two talents, tree 2 one, tree 3 three (one off the grid). Names and texts invented.

function talent(
  id: number,
  row: number | undefined,
  column: number | undefined,
  maxRanks: number,
  gate?: number,
): TalentRecord {
  const t: TalentRecord = {
    id,
    name: `Talent ${String.fromCharCode(64 + id)}`,
    spellId: 1000 + id,
    maxRanks,
    posX: id * 5000 + (column ?? 99) * 600,
    posY: (row ?? 99) * 600,
    texts: Array.from({ length: maxRanks }, (_, i) => `Text ${id} rank ${i + 1}.`),
  };
  if (row !== undefined) t.row = row;
  if (column !== undefined) t.column = column;
  if (gate !== undefined) t.gate = gate;
  return t;
}

const CLASS: ClassTalentsRecord = {
  classFile: "WARLOCK",
  traitTreeId: 1,
  columns: 4,
  rows: 7,
  trees: [
    { name: "Affliction", description: "Curses.", talents: [talent(1, 1, 1, 5), talent(2, 2, 2, 3, 5)] },
    { name: "Demonology", talents: [talent(3, 1, 2, 2)] },
    {
      name: "Destruction",
      talents: [talent(4, 1, 1, 5), talent(5, 2, 3, 3, 5), talent(6, 3, 2, 1, 10), talent(7, undefined, undefined, 1)],
    },
  ],
};

const TREES = [
  { name: "Affliction", points: 7 },
  { name: "Demonology", points: 0 },
  { name: "Destruction", points: 7 },
];

const FULL = [
  { id: 1, ranks: 5 },
  { id: 2, ranks: 2 },
  { id: 3, ranks: 0 },
  { id: 4, ranks: 5 },
  { id: 5, ranks: 1 },
  { id: 7, ranks: 1 },
];

describe("talent tooltips (WEB-100)", () => {
  it("B: every tree's talents with points in tree order, rank and text, and the grid", () => {
    const [affliction, demonology, destruction] = talentTooltips(TREES, FULL, CLASS);
    expect(affliction).toMatchObject({
      name: "Affliction",
      points: 7,
      kind: "talents",
      talents: [
        { name: "Talent A", rank: 5, maxRanks: 5, text: "Text 1 rank 5." },
        { name: "Talent B", rank: 2, maxRanks: 3, text: "Text 2 rank 2." },
      ],
    });
    expect(destruction!.kind).toBe("talents");
    expect(destruction!.talents.map((t) => [t.name, t.rank])).toEqual([
      ["Talent D", 5],
      ["Talent E", 1],
      ["Talent G", 1],
    ]);
    // The grid: every talent it places; full, partial, open and locked (row 3 needs 10, the tree has 7).
    expect(destruction!.grid).toEqual({
      columns: 4,
      rows: 7,
      cells: [
        { name: "Talent D", rank: 5, maxRanks: 5, text: "Text 4 rank 5.", row: 1, column: 1, state: "full" },
        { name: "Talent E", rank: 1, maxRanks: 3, text: "Text 5 rank 1.", row: 2, column: 3, state: "partial" },
        { name: "Talent F", rank: 0, maxRanks: 1, text: "Text 6 rank 1.", row: 3, column: 2, state: "locked" },
      ],
    });
    // A tree without points: B with no talents, the grid open in its first row, and the client's description if any.
    expect(demonology).toMatchObject({ kind: "talents", points: 0, talents: [] });
    expect(demonology!.grid!.cells).toEqual([expect.objectContaining({ name: "Talent C", state: "open" })]);
    expect(affliction!.description).toBe("Curses.");
  });

  it("matches a node by its position when it has no ID", () => {
    const nodes = FULL.map(({ id, ranks }) => {
      const t = CLASS.trees.flatMap((tree) => tree.talents).find((x) => x.id === id)!;
      return { posX: t.posX, posY: t.posY, ranks };
    });
    expect(talentTooltips(TREES, nodes, CLASS).map((t) => t.kind)).toEqual(["talents", "talents", "talents"]);
  });

  it("partial: a tree whose talents don't add up to its points falls back to A, the others stay B", () => {
    const tips = talentTooltips(
      TREES,
      FULL.filter((n) => n.id !== 5),
      CLASS,
    );
    expect(tips.map((t) => t.kind)).toEqual(["talents", "talents", "tree"]);
    expect(tips[2]).toEqual({ name: "Destruction", points: 7, kind: "tree", talents: [] });
  });

  it("unknown: a node the import doesn't know, or more ranks than the talent has, puts every tree on A", () => {
    for (const odd of [
      { id: 99, ranks: 1 },
      { id: 4, ranks: 6 },
      { posX: 600, ranks: 1 },
    ]) {
      const tips = talentTooltips(TREES, [...FULL, odd], CLASS);
      expect(tips.map((t) => t.kind)).toEqual(["tree", "tree", "tree"]);
    }
  });

  it("A: without synced nodes (every addon so far), without the import, or when the trees don't match", () => {
    expect(talentTooltips(TREES, undefined, CLASS)).toEqual([
      { name: "Affliction", points: 7, kind: "tree", description: "Curses.", talents: [] },
      { name: "Demonology", points: 0, kind: "tree", talents: [] },
      { name: "Destruction", points: 7, kind: "tree", talents: [] },
    ]);
    expect(talentTooltips(TREES, FULL, undefined).map((t) => t.kind)).toEqual(["tree", "tree", "tree"]);
    const renamed = [{ name: "Fire", points: 7 }, TREES[1]!, TREES[2]!];
    expect(talentTooltips(renamed, FULL, CLASS).map((t) => t.kind)).toEqual(["tree", "talents", "talents"]);
    // A fourth tree the import doesn't have, a tree without a name or points.
    expect(talentTooltips([...TREES, {}], FULL, CLASS)[3]).toEqual({ points: 0, kind: "tree", talents: [] });
  });

  it("says points as the tooltip does", () => {
    expect(pointsText(20)).toBe("20 points");
    expect(pointsText(1)).toBe("1 point");
    expect(pointsText(0)).toBe("0 points");
  });
});
