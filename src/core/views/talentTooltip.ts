import type { TalentNode } from "../model";
import type { ClassTalentsRecord, TalentRecord, TalentTreeRecord } from "../talents/build";

// WEB-100 (board talent-tooltips-v2, WB101 "closer to the game"): each talent tree of the character page.
// - B: when the synced nodes name the talents and add up to the tree's points: the tree as the game's talent frame
//   (icons with the game's states and rank boxes, prerequisite arrows), each talent's tooltip in the game's format,
//   and the tree tooltip (the small tree and the talents with points).
// - A: otherwise (an addon before CF-115, no import yet, a node the import doesn't know, numbers that don't add up): the
//   tree's name, its points and its description where the client has one.
// Game rules (Vanilla's talent frame, docs/WOW-FOREVER.md "Classes and talents"): a row opens at its TraitCond points
// in the tree; a prerequisite counts once it has every rank; an arrow lights up once the first talent has points.

/** full: every rank (gold); partial: some (green); open: none yet, can be taken (grey); locked: can't yet (greyed). */
export type TalentState = "full" | "partial" | "open" | "locked";

export interface TalentView {
  id: number;
  name: string;
  icon?: string;
  rank: number;
  maxRanks: number;
  state: TalentState;
  /** The text at this rank (rank 1's for a talent without points); undefined where the client has none. */
  text?: string;
  /** "Next rank:" text, for a talent with some ranks. */
  next?: string;
  /** Red lines of a locked talent: "Requires 20 points in Destruction Talents", "Requires Intensity". */
  requires: string[];
  /** Grid place; undefined for a node the client places off the grid (listed, not drawn). */
  row?: number;
  column?: number;
}

export interface TalentArrow {
  from: { row: number; column: number };
  to: { row: number; column: number };
  /** Gold once the first talent has points. */
  active: boolean;
}

export interface TreeTooltip {
  name?: string;
  points: number;
  icon?: string;
  /** "tree": A, the tree only; "talents": B, its talents and the tree. */
  kind: "tree" | "talents";
  /** The client's line about the tree (A); none in build 1.60.1. */
  description?: string;
  /** B: the talents with points, in tree order. */
  ranked: TalentView[];
  /** B: the tree as the game draws it. */
  tree?: { columns: number; rows: number; talents: TalentView[]; arrows: TalentArrow[] };
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

function treeView(
  known: TalentTreeRecord,
  name: string | undefined,
  points: number,
  rankOf: (t: TalentRecord) => number,
): { talents: TalentView[]; arrows: TalentArrow[] } {
  const byId = new Map(known.talents.map((t) => [t.id, t]));
  const treeName = name ?? known.name;
  const talents = known.talents.map((t): TalentView => {
    const rank = rankOf(t);
    const requires: string[] = [];
    if ((t.gate ?? 0) > points) {
      requires.push(`Requires ${t.gate} points in ${treeName === undefined ? "this tree's" : treeName} Talents`);
    }
    const prereqs = (t.requires ?? []).map((p) => ({ ...p, talent: byId.get(p.id) })).filter((p) => p.talent);
    const maxed = (p: { talent?: TalentRecord }) => rankOf(p.talent!) >= p.talent!.maxRanks;
    const needed = prereqs.filter((p) => p.required === true);
    const some = prereqs.filter((p) => p.required !== true);
    for (const p of needed) if (!maxed(p)) requires.push(`Requires ${talentName(p.talent!)}`);
    if (some.length > 0 && !some.some(maxed)) {
      requires.push(`Requires ${some.map((p) => talentName(p.talent!)).join(" or ")}`);
    }
    const state: TalentState =
      rank >= t.maxRanks ? "full" : rank > 0 ? "partial" : requires.length > 0 ? "locked" : "open";
    const view: TalentView = {
      id: t.id,
      name: talentName(t),
      rank,
      maxRanks: t.maxRanks,
      state,
      requires: rank > 0 ? [] : requires,
    };
    if (t.icon !== undefined) view.icon = t.icon;
    const text = t.texts[Math.max(rank, 1) - 1];
    if (text !== undefined) view.text = text;
    const next = rank > 0 && rank < t.maxRanks ? t.texts[rank] : undefined;
    if (next !== undefined) view.next = next;
    if (t.row !== undefined && t.column !== undefined) {
      view.row = t.row;
      view.column = t.column;
    }
    return view;
  });
  const arrows: TalentArrow[] = [];
  for (const t of known.talents) {
    if (t.row === undefined || t.column === undefined) continue;
    for (const p of t.requires ?? []) {
      const from = byId.get(p.id);
      if (from?.row === undefined || from.column === undefined) continue;
      arrows.push({
        from: { row: from.row, column: from.column },
        to: { row: t.row, column: t.column },
        active: rankOf(from) > 0,
      });
    }
  }
  return { talents, arrows };
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
    const tip: TreeTooltip = { points, kind: "tree", ranked: [] };
    if (t.name !== undefined) tip.name = t.name;
    if (known?.description !== undefined) tip.description = known.description;
    // The import's tree must be the upload's: same place, same name where both have one.
    if (ranks === undefined || known === undefined) return tip;
    if (t.name !== undefined && known.name !== undefined && t.name !== known.name) return tip;
    const rankOf = (talent: TalentRecord) => ranks.get(talent.id) ?? 0;
    const spent = known.talents.reduce((sum, talent) => sum + rankOf(talent), 0);
    if (spent !== points) return tip;

    tip.kind = "talents";
    if (known.icon !== undefined) tip.icon = known.icon;
    const { talents, arrows } = treeView(known, t.name, points, rankOf);
    tip.ranked = talents.filter((v) => v.rank > 0);
    tip.tree = {
      columns: known.columns,
      rows: known.rows,
      talents: talents.filter((v) => v.row !== undefined),
      arrows,
    };
    return tip;
  });
}
