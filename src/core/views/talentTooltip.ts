import type { TalentNode } from "../model";
import type { ClassTalentsRecord, TalentRecord } from "../talents/build";

// WEB-100 (board talent-tooltips, WB100): the tooltip of each talent tree on the character page.
// - B (with the grid, "B+"): when the synced nodes name the talents and add up to the tree's points: every talent with
//   points in tree order (name, rank "3/5", the text for that rank), and the tree on its grid.
// - A: otherwise (no released addon syncs the nodes, no import yet, a node the import doesn't know, numbers that don't
//   add up): the tree's name, its points and its description where the client has one.

export type TalentCellState = "full" | "partial" | "open" | "locked";

export interface TalentLine {
  name: string;
  rank: number;
  maxRanks: number;
  /** The text at this rank; undefined where the client has none. */
  text?: string;
}

export interface TalentCell extends TalentLine {
  row: number;
  column: number;
  /** full: every rank; partial: some; open: none yet, its row reached; locked: its row not reached yet. */
  state: TalentCellState;
}

export interface TreeTooltip {
  name?: string;
  points: number;
  /** "tree": A, the tree only; "talents": B, its talents and grid. */
  kind: "tree" | "talents";
  /** The client's line about the tree (A, and B for a tree without points); none in build 1.60.1. */
  description?: string;
  /** B: the talents with points, in tree order. */
  talents: TalentLine[];
  /** B: the tree on its grid (every talent the grid places). */
  grid?: { columns: number; rows: number; cells: TalentCell[] };
}

/** "20 points", "1 point". */
export function pointsText(points: number): string {
  return `${points} ${points === 1 ? "point" : "points"}`;
}

function talentName(t: TalentRecord): string {
  return t.name ?? `Talent ${t.id}`;
}

/** The ranks per talent of the class the synced nodes name; undefined when a node with points names none. */
function ranksByTalent(
  nodes: readonly TalentNode[],
  classTalents: ClassTalentsRecord,
): Map<number, number> | undefined {
  const byId = new Map<number, TalentRecord>();
  const byPos = new Map<string, TalentRecord>();
  for (const tree of classTalents.trees) {
    for (const t of tree.talents) {
      byId.set(t.id, t);
      byPos.set(`${t.posX},${t.posY}`, t);
    }
  }
  const out = new Map<number, number>();
  for (const n of nodes) {
    if (n.ranks === 0) continue;
    const talent =
      (n.id !== undefined ? byId.get(n.id) : undefined) ??
      (n.posX !== undefined && n.posY !== undefined ? byPos.get(`${n.posX},${n.posY}`) : undefined);
    if (talent === undefined || n.ranks > talent.maxRanks) return undefined;
    out.set(talent.id, Math.max(out.get(talent.id) ?? 0, n.ranks));
  }
  return out;
}

/**
 * One tooltip per tree of the upload's `talents` (left to right). `nodes`: the character's synced talent nodes;
 * `classTalents`: the class's trees from the item import.
 */
export function talentTooltips(
  trees: readonly { name?: string; points?: number }[],
  nodes: readonly TalentNode[] | undefined,
  classTalents: ClassTalentsRecord | undefined,
): TreeTooltip[] {
  const ranks = nodes !== undefined && classTalents !== undefined ? ranksByTalent(nodes, classTalents) : undefined;
  return trees.map((t, i) => {
    const points = t.points ?? 0;
    const known = classTalents?.trees[i];
    const tip: TreeTooltip = { points, kind: "tree", talents: [] };
    if (t.name !== undefined) tip.name = t.name;
    if (known?.description !== undefined) tip.description = known.description;
    // The import's tree must be the upload's: same place, same name where both have one.
    if (ranks === undefined || known === undefined || classTalents === undefined) return tip;
    if (t.name !== undefined && known.name !== undefined && t.name !== known.name) return tip;
    const rankOf = (talent: TalentRecord) => ranks.get(talent.id) ?? 0;
    const spent = known.talents.reduce((sum, talent) => sum + rankOf(talent), 0);
    if (spent !== points) return tip;

    tip.kind = "talents";
    const line = (talent: TalentRecord, rank: number): TalentLine => {
      const l: TalentLine = { name: talentName(talent), rank, maxRanks: talent.maxRanks };
      const text = talent.texts[Math.max(rank, 1) - 1];
      if (text !== undefined) l.text = text;
      return l;
    };
    tip.talents = known.talents.filter((talent) => rankOf(talent) > 0).map((talent) => line(talent, rankOf(talent)));
    const cells: TalentCell[] = [];
    for (const talent of known.talents) {
      if (talent.row === undefined || talent.column === undefined) continue;
      const rank = rankOf(talent);
      const state: TalentCellState =
        rank >= talent.maxRanks ? "full" : rank > 0 ? "partial" : (talent.gate ?? 0) <= points ? "open" : "locked";
      cells.push({ ...line(talent, rank), row: talent.row, column: talent.column, state });
    }
    tip.grid = { columns: classTalents.columns, rows: classTalents.rows, cells };
    return tip;
  });
}
