// WEB-100: the Forever client's talent trees, built by the item import (src/core/recipes/build.ts) from the client's
// own tables. Pure: every table comes in as rows. docs/SOURCE-DATA.md "Talent trees".
//
// Sources (rule 10), Blizzard's client data of the Forever build (wago.tools DB2 CSV exports, product `wowf`, checked
// on build 1.60.1.70790):
// - Forever's talents are a C_Traits tree per class (what the addon reads, its VERIFY V29), not the Vanilla `Talent`
//   table: that one is still in the client but holds Vanilla's trees (Destruction there has a fourth column and no
//   Molten Skin or Bane of Havoc). One TraitTree per class holds the three Vanilla trees side by side.
// - SkillLineXTraitTree (the class's tree) and SkillRaceClassInfo.ClassMask (which class that skill line is).
// - TraitNode (position), TraitNodeXTraitNodeEntry and TraitNodeEntry (the talent and its max ranks), TraitDefinition
//   (the spell, an override name or description).
// - TraitNodeGroupXTraitNode: each of the three trees is one node group without a condition holding all its nodes
//   (the group's ID is the tree's ID); TraitNodeGroupXTraitCond and TraitCond.SpentAmountRequired: the points a row
//   needs in its tree (5 per row).
// - TalentTab: the trees' names left to right (OrderIndex per ClassMask), as the addon names them (Talents.lua).
// - The talent's text: its spell's description (Spell.Description_lang, ./spellText.ts, WEB-95). A rank's numbers are
//   the spell's effect points times the rank, as C_Traits ranks add up (docs/WOW-FOREVER.md "Talents": unconfirmed).
import { int } from "../recipes/csv";
import { type SpellInfo, type SpellLookup, spellText } from "../recipes/spellText";
import type { ClassFile } from "../gamedata/classes";

export const TALENT_TABLES = [
  "TraitNode",
  "TraitNodeEntry",
  "TraitNodeXTraitNodeEntry",
  "TraitDefinition",
  "TraitNodeGroupXTraitNode",
  "TraitNodeGroupXTraitCond",
  "TraitCond",
  "SkillLineXTraitTree",
  "SkillRaceClassInfo",
  "TalentTab",
] as const;
export type TalentTable = (typeof TALENT_TABLES)[number];

type Rows = Record<string, string>[];

/**
 * The client's class IDs as ClassMask bits (bit = 1 << (ID − 1)). Source: ChrClasses IDs of the client (1 Warrior,
 * 2 Paladin, 3 Hunter, 4 Rogue, 5 Priest, 7 Shaman, 8 Mage, 9 Warlock, 11 Druid).
 */
const CLASS_BY_MASK: Readonly<Record<number, ClassFile>> = {
  1: "WARRIOR",
  2: "PALADIN",
  4: "HUNTER",
  8: "ROGUE",
  16: "PRIEST",
  64: "SHAMAN",
  128: "MAGE",
  256: "WARLOCK",
  1024: "DRUID",
};

/** The three trees of a class side by side (the addon's Talents.lua). */
export const TREES_PER_CLASS = 3;
/** The highest rank a talent has (Vanilla and Forever: 5); more is bad data. */
const MAX_RANKS = 5;

export interface TalentRecord {
  /** TraitNode ID: what C_Traits.GetTreeNodes names, what a synced node would carry. */
  id: number;
  name?: string;
  spellId: number;
  maxRanks: number;
  /** 1-based, from the top; undefined for a node the client places off the grid. */
  row?: number;
  /** 1-based, from the left within its tree. */
  column?: number;
  /** Points the tree needs before the talent's row opens (TraitCond). */
  gate?: number;
  /** The client's position (TraitNode.PosX/PosY), to match a synced node that carries one. */
  posX: number;
  posY: number;
  /** The text per rank (index 0: rank 1); undefined where the spell has none. */
  texts: (string | undefined)[];
}

export interface TalentTreeRecord {
  /** TalentTab.Name_lang, e.g. "Destruction". */
  name?: string;
  /** TalentTab.Description_lang (empty in build 1.60.1). */
  description?: string;
  /** In tree order: rows from the top, columns from the left; nodes off the grid last. */
  talents: TalentRecord[];
}

export interface ClassTalentsRecord {
  classFile: ClassFile;
  /** The class's TraitTree. */
  traitTreeId: number;
  /** The grid every tree of the class is drawn on (4 × 7 in build 1.60.1). */
  columns: number;
  rows: number;
  /** Left to right, as the addon's `talents`. */
  trees: TalentTreeRecord[];
}

function text(v: string | undefined): string | undefined {
  return v !== undefined && v !== "" ? v : undefined;
}

function many<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

/**
 * The grid step: the most common gap between neighbouring distinct positions, rounded to 100 (the client puts some
 * nodes 10 off their line), the smaller on a tie. Robust against a stray node.
 */
function step(values: readonly number[]): number | undefined {
  const sorted = [...new Set(values.map((v) => Math.round(v / 100) * 100))].sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]! - sorted[i - 1]!;
    counts.set(gap, (counts.get(gap) ?? 0) + 1);
  }
  let best: number | undefined;
  for (const [gap, count] of counts) {
    if (best === undefined || count > counts.get(best)! || (count === counts.get(best)! && gap < best)) best = gap;
  }
  return best;
}

/** A position's place on the grid: 1-based, or undefined more than a quarter step off a grid line. */
function slot(value: number, origin: number, size: number, max: number): number | undefined {
  const exact = (value - origin) / size;
  const index = Math.round(exact);
  if (Math.abs(exact - index) > 0.25 || index < 0 || index >= max) return undefined;
  return index + 1;
}

/** A spell with its effect points times the rank (C_Traits ranks add up). */
function atRank(spell: SpellInfo, rank: number): SpellInfo {
  return {
    ...spell,
    effects: spell.effects.map((e) =>
      e === undefined || e.points === undefined ? e : { ...e, points: e.points * rank },
    ),
  };
}

/** Grid rows and columns at most (Vanilla: 7 tiers, 4 columns); a bigger grid is bad data, not drawn. */
const MAX_ROWS = 7;
const MAX_COLUMNS = 4;

export function buildTalentTrees(db2: Partial<Record<TalentTable, Rows>>, spells: SpellLookup): ClassTalentsRecord[] {
  // Class of each TraitTree: SkillLineXTraitTree -> SkillRaceClassInfo.ClassMask (one class bit).
  const classOfLine = new Map<number, ClassFile>();
  for (const r of db2.SkillRaceClassInfo ?? []) {
    const line = int(r, "SkillID");
    const cls = CLASS_BY_MASK[int(r, "ClassMask") ?? 0];
    if (line !== undefined && cls !== undefined && !classOfLine.has(line)) classOfLine.set(line, cls);
  }
  const classOfTree = new Map<number, ClassFile>();
  for (const r of db2.SkillLineXTraitTree ?? []) {
    const tree = int(r, "TraitTreeID");
    const cls = classOfLine.get(int(r, "SkillLineID") ?? -1);
    if (tree !== undefined && cls !== undefined && !classOfTree.has(tree)) classOfTree.set(tree, cls);
  }

  // Tree names per class, left to right.
  const tabs = new Map<ClassFile, { order: number; name?: string; description?: string }[]>();
  for (const r of db2.TalentTab ?? []) {
    const cls = CLASS_BY_MASK[int(r, "ClassMask") ?? 0];
    const order = int(r, "OrderIndex");
    if (cls === undefined || order === undefined) continue;
    many(tabs, cls, { order, name: text(r.Name_lang), description: text(r.Description_lang) });
  }

  // Nodes and their talent.
  const nodes = new Map<number, { tree: number; x: number; y: number }>();
  for (const r of db2.TraitNode ?? []) {
    const id = int(r, "ID");
    const tree = int(r, "TraitTreeID");
    const x = int(r, "PosX");
    const y = int(r, "PosY");
    if (id !== undefined && tree !== undefined && x !== undefined && y !== undefined) nodes.set(id, { tree, x, y });
  }
  const entries = new Map<number, Record<string, string>>();
  for (const r of db2.TraitNodeEntry ?? []) {
    const id = int(r, "ID");
    if (id !== undefined) entries.set(id, r);
  }
  const definitions = new Map<number, Record<string, string>>();
  for (const r of db2.TraitDefinition ?? []) {
    const id = int(r, "ID");
    if (id !== undefined) definitions.set(id, r);
  }
  // A node's first entry (a choice node would have more; Forever's class trees have none).
  const entryOf = new Map<number, { index: number; entry: number }>();
  for (const r of db2.TraitNodeXTraitNodeEntry ?? []) {
    const node = int(r, "TraitNodeID");
    const entry = int(r, "TraitNodeEntryID");
    const index = int(r, "_Index") ?? 0;
    if (node === undefined || entry === undefined) continue;
    const was = entryOf.get(node);
    if (was === undefined || index < was.index) entryOf.set(node, { index, entry });
  }

  // Groups: the ones with a condition gate rows; the biggest ones without are the trees.
  const conds = new Map<number, number>();
  for (const r of db2.TraitCond ?? []) {
    const id = int(r, "ID");
    const spent = int(r, "SpentAmountRequired");
    if (id !== undefined && spent !== undefined) conds.set(id, spent);
  }
  const groupGate = new Map<number, number>();
  const conditioned = new Set<number>();
  for (const r of db2.TraitNodeGroupXTraitCond ?? []) {
    const group = int(r, "TraitNodeGroupID");
    if (group === undefined) continue;
    conditioned.add(group);
    const spent = conds.get(int(r, "TraitCondID") ?? -1) ?? 0;
    if (spent > (groupGate.get(group) ?? 0)) groupGate.set(group, spent);
  }
  const groupNodes = new Map<number, number[]>();
  for (const r of db2.TraitNodeGroupXTraitNode ?? []) {
    const group = int(r, "TraitNodeGroupID");
    const node = int(r, "TraitNodeID");
    if (group !== undefined && node !== undefined) many(groupNodes, group, node);
  }
  const gateOf = new Map<number, number>();
  for (const [group, gate] of groupGate) {
    for (const node of groupNodes.get(group) ?? []) if (gate > (gateOf.get(node) ?? 0)) gateOf.set(node, gate);
  }

  const out: ClassTalentsRecord[] = [];
  for (const [treeId, classFile] of [...classOfTree].sort((a, b) => a[0] - b[0])) {
    const own = [...nodes].filter(([id, n]) => n.tree === treeId && entryOf.has(id)).map(([id]) => id);
    const ownSet = new Set(own);
    // The trees: condition-less groups of this TraitTree's nodes that no other such group contains.
    const candidates = [...groupNodes]
      .filter(([group, list]) => !conditioned.has(group) && list.length > 0 && list.every((n) => ownSet.has(n)))
      .map(([group, list]) => ({ group, set: new Set(list) }));
    const trees = candidates.filter(
      (c) => !candidates.some((o) => o !== c && o.set.size > c.set.size && [...c.set].every((n) => o.set.has(n))),
    );
    const disjoint = trees.every((t, i) => trees.slice(i + 1).every((o) => [...t.set].every((n) => !o.set.has(n))));
    if (trees.length !== TREES_PER_CLASS || !disjoint) continue;

    // Left to right by each tree's leftmost node.
    const minX = (set: Set<number>) => Math.min(...[...set].map((n) => nodes.get(n)!.x));
    trees.sort((a, b) => minX(a.set) - minX(b.set));
    const names = (tabs.get(classFile) ?? []).sort((a, b) => a.order - b.order);

    const xs = own.map((id) => nodes.get(id)!.x);
    const ys = own.map((id) => nodes.get(id)!.y);
    const stepX = step(xs);
    const stepY = step(ys);
    if (stepX === undefined || stepY === undefined || stepX <= 0 || stepY <= 0) continue;
    // The top row: the lowest Y shared by at least two nodes (a stray node above doesn't move the grid).
    const yCounts = new Map<number, number>();
    for (const y of ys) yCounts.set(y, (yCounts.get(y) ?? 0) + 1);
    const top = Math.min(...[...yCounts].filter(([, c]) => c >= 2).map(([y]) => y));
    if (!Number.isFinite(top)) continue;

    // A tree's first column is its leftmost talent's (so in every tree of build 1.60.1).
    let columns = 0;
    let rows = 0;
    const built: TalentTreeRecord[] = trees.map((t, i) => {
      const left = minX(t.set);
      const talents: TalentRecord[] = [];
      for (const id of [...t.set].sort((a, b) => a - b)) {
        const node = nodes.get(id)!;
        const entry = entries.get(entryOf.get(id)!.entry);
        const def = definitions.get(int(entry, "TraitDefinitionID") ?? -1);
        const spellId = int(def, "SpellID") ?? 0;
        const maxRanks = int(entry, "MaxRanks") ?? 0;
        if (spellId <= 0 || maxRanks < 1 || maxRanks > MAX_RANKS) continue;
        const spell = spells(spellId);
        const description = text(def?.OverrideDescription_lang);
        const base = spell === undefined ? undefined : description === undefined ? spell : { ...spell, description };
        const texts: (string | undefined)[] = [];
        for (let rank = 1; rank <= maxRanks; rank++) {
          texts.push(base === undefined ? undefined : spellText(atRank(base, rank), spells));
        }
        const row = slot(node.y, top, stepY, MAX_ROWS);
        const column = row === undefined ? undefined : slot(node.x, left, stepX, MAX_COLUMNS);
        const talent: TalentRecord = { id, spellId, maxRanks, posX: node.x, posY: node.y, texts };
        const name = text(def?.OverrideName_lang) ?? spell?.name;
        if (name !== undefined) talent.name = name;
        if (row !== undefined && column !== undefined) {
          talent.row = row;
          talent.column = column;
          rows = Math.max(rows, row);
          columns = Math.max(columns, column);
        }
        const gate = gateOf.get(id);
        if (gate !== undefined && gate > 0) talent.gate = gate;
        talents.push(talent);
      }
      talents.sort(
        (a, b) => (a.row ?? Infinity) - (b.row ?? Infinity) || (a.column ?? 0) - (b.column ?? 0) || a.id - b.id,
      );
      const tree: TalentTreeRecord = { talents };
      const tab = names[i];
      if (tab?.name !== undefined) tree.name = tab.name;
      if (tab?.description !== undefined) tree.description = tab.description;
      return tree;
    });
    out.push({ classFile, traitTreeId: treeId, columns, rows, trees: built });
  }
  return out;
}
