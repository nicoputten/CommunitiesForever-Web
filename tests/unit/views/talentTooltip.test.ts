import { describe, expect, it } from "vitest";
import type { ClassTalentsRecord, TalentRecord } from "@/core/talents/build";
import { pointsText, talentTooltips } from "@/core/views/talentTooltip";

// WEB-100 (board talent-tooltips-v2, WB101): which tooltip each tree gets (B: the tree as the game draws it when the
// synced nodes name the talents, else A), the talents' game states, lock reasons, next rank and arrows.
// A made-up class: names and texts invented.

function talent(
  id: number,
  row: number | undefined,
  column: number | undefined,
  maxRanks: number,
  extra: Partial<TalentRecord> = {},
): TalentRecord {
  const t: TalentRecord = {
    id,
    name: `Talent ${String.fromCharCode(64 + id)}`,
    spellId: 1000 + id,
    maxRanks,
    posX: id * 5000 + (column ?? 99) * 600,
    posY: (row ?? 99) * 600,
    texts: Array.from({ length: maxRanks }, (_, i) => `Text ${id} rank ${i + 1}.`),
    icon: `icon_${id}`,
    ...extra,
  };
  if (row !== undefined) t.row = row;
  if (column !== undefined) t.column = column;
  return t;
}

const CLASS: ClassTalentsRecord = {
  classFile: "WARLOCK",
  traitTreeId: 1,
  columns: 4,
  rows: 7,
  trees: [
    {
      name: "Affliction",
      description: "Curses.",
      columns: 2,
      rows: 2,
      talents: [talent(1, 1, 1, 5), talent(2, 2, 2, 3, { gate: 5 })],
    },
    { name: "Demonology", columns: 2, rows: 1, talents: [talent(3, 1, 2, 2)] },
    {
      name: "Destruction",
      icon: "tree_icon",
      columns: 3,
      rows: 5,
      talents: [
        talent(4, 1, 1, 5),
        talent(5, 2, 3, 3, { gate: 5 }),
        talent(6, 3, 2, 1, { gate: 10 }),
        talent(8, 3, 1, 3, { gate: 5, requires: [{ id: 4 }] }),
        talent(9, 4, 1, 1, { gate: 5, requires: [{ id: 8, required: true }] }),
        talent(10, 4, 3, 1, { gate: 5, requires: [{ id: 5 }, { id: 4 }] }),
        talent(11, 5, 3, 1, { gate: 5, requires: [{ id: 10 }] }),
        talent(7, undefined, undefined, 1),
      ],
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

describe("talent tooltips (WEB-100, WB101)", () => {
  it("B: the talents with points in tree order, icon, rank, the text, the next rank", () => {
    const [affliction, demonology, destruction] = talentTooltips(TREES, FULL, CLASS);
    expect(affliction).toMatchObject({ name: "Affliction", points: 7, kind: "talents" });
    expect(affliction!.ranked).toEqual([
      {
        id: 1,
        name: "Talent A",
        icon: "icon_1",
        rank: 5,
        maxRanks: 5,
        state: "full",
        text: "Text 1 rank 5.",
        requires: [],
        row: 1,
        column: 1,
      },
      {
        id: 2,
        name: "Talent B",
        icon: "icon_2",
        rank: 2,
        maxRanks: 3,
        state: "partial",
        text: "Text 2 rank 2.",
        next: "Text 2 rank 3.",
        requires: [],
        row: 2,
        column: 2,
      },
    ]);
    // The off-grid talent is listed, not drawn.
    expect(destruction!.ranked.map((t) => [t.name, t.rank])).toEqual([
      ["Talent D", 5],
      ["Talent E", 1],
      ["Talent G", 1],
    ]);
    expect(destruction!.tree!.talents.map((t) => t.id)).toEqual([4, 5, 6, 8, 9, 10, 11]);
    expect(destruction).toMatchObject({ icon: "tree_icon", tree: { columns: 3, rows: 5 } });
    // A tree without points: B with no talents ranked, its first row open.
    expect(demonology).toMatchObject({ kind: "talents", points: 0, ranked: [] });
    expect(demonology!.tree!.talents.map((t) => t.state)).toEqual(["open"]);
  });

  it("the game's states and red requirements: row gate, a required or one-of prerequisite at full rank", () => {
    const destruction = talentTooltips(TREES, FULL, CLASS)[2]!;
    const view = (id: number) => destruction.tree!.talents.find((t) => t.id === id)!;
    expect(view(6)).toMatchObject({ state: "locked", requires: ["Requires 10 points in Destruction Talents"] });
    // Talent D is at full rank: H is open, its text rank 1's, no "Next rank".
    expect(view(8)).toMatchObject({ state: "open", requires: [], text: "Text 8 rank 1." });
    expect(view(8)).not.toHaveProperty("next");
    expect(view(9)).toMatchObject({ state: "locked", requires: ["Requires Talent H"] });
    // One of E (partial) or D (full) is enough.
    expect(view(10)).toMatchObject({ state: "open", requires: [] });
    // Neither at full rank: both named.
    const short = talentTooltips(
      [TREES[0]!, TREES[1]!, { name: "Destruction", points: 6 }],
      FULL.map((n) => (n.id === 4 ? { id: 4, ranks: 4 } : n)),
      CLASS,
    )[2]!;
    const shortView = (id: number) => short.tree!.talents.find((t) => t.id === id)!;
    expect(shortView(10)).toMatchObject({ state: "locked", requires: ["Requires Talent E or Talent D"] });
    expect(shortView(4)).toMatchObject({ state: "partial", next: "Text 4 rank 5." });
  });

  it("arrows from each prerequisite, gold once the first talent has points", () => {
    expect(talentTooltips(TREES, FULL, CLASS)[2]!.tree!.arrows).toEqual([
      { from: { row: 1, column: 1 }, to: { row: 3, column: 1 }, active: true },
      { from: { row: 3, column: 1 }, to: { row: 4, column: 1 }, active: false },
      { from: { row: 2, column: 3 }, to: { row: 4, column: 3 }, active: true },
      { from: { row: 1, column: 1 }, to: { row: 4, column: 3 }, active: true },
      { from: { row: 4, column: 3 }, to: { row: 5, column: 3 }, active: false },
    ]);
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
    expect(tips[2]).toEqual({ name: "Destruction", points: 7, kind: "tree", ranked: [] });
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

  it("A: without synced nodes (an addon before CF-115), without the import, or when the trees don't match", () => {
    expect(talentTooltips(TREES, undefined, CLASS)).toEqual([
      { name: "Affliction", points: 7, kind: "tree", description: "Curses.", ranked: [] },
      { name: "Demonology", points: 0, kind: "tree", ranked: [] },
      { name: "Destruction", points: 7, kind: "tree", ranked: [] },
    ]);
    expect(talentTooltips(TREES, FULL, undefined).map((t) => t.kind)).toEqual(["tree", "tree", "tree"]);
    const renamed = [{ name: "Fire", points: 7 }, TREES[1]!, TREES[2]!];
    expect(talentTooltips(renamed, FULL, CLASS).map((t) => t.kind)).toEqual(["tree", "talents", "talents"]);
    expect(talentTooltips([...TREES, {}], FULL, CLASS)[3]).toEqual({ points: 0, kind: "tree", ranked: [] });
  });

  it("says points as the tooltip does", () => {
    expect(pointsText(20)).toBe("20 points");
    expect(pointsText(1)).toBe("1 point");
  });
});
