// Item sets (WEB-99): the Forever client's ItemSet (name, up to 17 item IDs) and ItemSetSpell (a bonus spell and the
// number of pieces it needs), from the same wago.tools DB2 export as the rest of the item import (./build.ts). The
// bonus texts are the spells' descriptions, filled in by WEB-95's spell text (./spellText.ts). Forever's own copies
// of a set (new item IDs, e.g. "Cenarion Raiment" 2142 next to Classic's 205) are rows of their own: each is a set.
// Which set an item belongs to: ItemSparse.ItemSet, else the first set (lowest ID) that lists it.
// Pure: every table comes in as rows.
import { int } from "./csv";
import { s, type SqlRow } from "./sqlDump";
import { spellText, type SpellLookup } from "./spellText";

/** ItemSet has ItemID_0 .. ItemID_16. */
const SET_SLOTS = 17;

export interface ItemSetPiece {
  id: number;
  /** Undefined when neither the client nor cmangos names it (Forever's own without a name). */
  name?: string;
}

export interface ItemSetBonus {
  /** Pieces worn for it: the "(2)" of "(2) Set: ...". */
  threshold: number;
  text: string;
}

export interface ItemSetRecord {
  id: number;
  name: string;
  /** In the client's order (ItemID_0 first), as the game lists them. */
  items: ItemSetPiece[];
  /** By threshold, then the client's order; a bonus whose text the import can't fill is left out. */
  bonuses: ItemSetBonus[];
}

export interface ItemSetInput {
  sets: Record<string, string>[];
  spells: Record<string, string>[];
  /** ItemSparse rows by ID: the pieces' names and each item's own ItemSet. */
  sparse: ReadonlyMap<number, Record<string, string>>;
  /** cmangos item_template by entry: names the client lacks. */
  templates: ReadonlyMap<number, SqlRow>;
  spellLookup: SpellLookup;
}

export interface ItemSets {
  /** Every set of the client that has at least one piece, by ID. */
  sets: ItemSetRecord[];
  /** The set of an item; undefined for an item in none. */
  setOf: (item: number) => number | undefined;
}

export function buildItemSets(input: ItemSetInput): ItemSets {
  const bonuses = new Map<number, { order: number; threshold: number; text: string }[]>();
  for (const r of input.spells) {
    const set = int(r, "ItemSetID");
    const spell = int(r, "SpellID");
    const threshold = int(r, "Threshold");
    if (set === undefined || spell === undefined || spell <= 0 || threshold === undefined || threshold <= 0) continue;
    const text = spellText(input.spellLookup(spell), input.spellLookup);
    if (text === undefined) continue;
    const list = bonuses.get(set) ?? bonuses.set(set, []).get(set)!;
    if (list.some((b) => b.threshold === threshold && b.text === text)) continue;
    list.push({ order: int(r, "ID") ?? 0, threshold, text });
  }

  const sets: ItemSetRecord[] = [];
  const listedIn = new Map<number, number>();
  const rows = [...input.sets].sort((a, b) => (int(a, "ID") ?? 0) - (int(b, "ID") ?? 0));
  for (const r of rows) {
    const id = int(r, "ID");
    const name = r.Name_lang;
    if (id === undefined || name === undefined || name === "") continue;
    const items: ItemSetPiece[] = [];
    for (let i = 0; i < SET_SLOTS; i++) {
      const item = int(r, `ItemID_${i}`);
      if (item === undefined || item <= 0 || items.some((p) => p.id === item)) continue;
      const pieceName = nameOf(item, input);
      items.push(pieceName === undefined ? { id: item } : { id: item, name: pieceName });
      if (!listedIn.has(item)) listedIn.set(item, id);
    }
    if (items.length === 0) continue;
    const own = (bonuses.get(id) ?? []).sort((a, b) => a.threshold - b.threshold || a.order - b.order);
    sets.push({ id, name, items, bonuses: own.map((b) => ({ threshold: b.threshold, text: b.text })) });
  }

  const known = new Set(sets.map((x) => x.id));
  const setOf = (item: number): number | undefined => {
    const own = int(input.sparse.get(item), "ItemSet");
    return own !== undefined && known.has(own) ? own : listedIn.get(item);
  };
  return { sets, setOf };
}

function nameOf(item: number, input: ItemSetInput): string | undefined {
  const display = input.sparse.get(item)?.Display_lang;
  if (display !== undefined && display !== "") return display;
  const name = s(input.templates.get(item), "name");
  return name !== undefined && name !== "" ? name : undefined;
}
