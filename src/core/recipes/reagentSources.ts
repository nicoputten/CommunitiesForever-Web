// WEB-98: where to get a recipe's reagents, built by the item import (./build.ts) for every item a recipe uses. Pure:
// every table comes in as rows. docs/SOURCE-DATA.md "Item database".
//
// Sources (rule 10):
// - cmangos classic-db (GPL-3.0, https://github.com/cmangos/classic-db), as of Vanilla 1.12: vendors (`npc_vendor`,
//   `npc_vendor_template`; `maxcount` > 0 is a limited stock that restocks), drops (`creature_loot_template` through
//   `creature_template.LootId`, with `reference_loot_template`), skinning (`skinning_loot_template` through
//   `creature_template.SkinningLootId`), herb and ore nodes (`gameobject_loot_template` of chest-type objects, type 3:
//   `data0` the lock, `data1` the loot), creature types and levels (`creature_template`), spawn points (`creature`,
//   `gameobject`).
// - The Forever client (wago.tools DB2 exports): `Lock` (a lock key of type 2 is a skill; its index is a `LockType`:
//   2 Herbalism, 3 Mining, as the client's LockType table names them), `CreatureType` (Beast, Humanoid, ...),
//   `UiMapAssignment` (each map's world rectangles, Region_0..2 the minimum x, y, z and Region_3..5 the maximum) with
//   `AreaTable` (the zone's name), and `Map` (an instance's name).
// Loot chances, as cmangos rolls them (cmangos `LootMgr`): a row's ChanceOrQuestChance in percent; below 0 it only
// drops for a quest (left out). Rows of one group (groupid > 0) share one roll: a row with chance 0 gets an equal part
// of what the group's other rows leave. A reference row (mincountOrRef < 0) rolls its chance, then the reference
// table's own rows.
import { float, int } from "./csv";
import { n, s, type SqlRow } from "./sqlDump";

export type ReagentSourceKind = "vendor" | "vendor_limited" | "crafted" | "skinning" | "herbalism" | "mining" | "drop";

export interface ReagentSourceRecord {
  itemId: number;
  kind: ReagentSourceKind;
  /** Best first within the kind, from 1. */
  position: number;
  /** A vendor's or creature's name, or a herb or ore node's. */
  name?: string;
  /** Where a vendor stands: its zone (or instance). */
  zone?: string;
  /** A drop's chance in percent (two decimals). */
  chance?: number;
  /** Crafted: the recipe (spell ID) that makes it. */
  recipeId?: number;
  /** Skinning: the creatures' type ("Beast"), and their levels. */
  creatureType?: string;
  minLevel?: number;
  maxLevel?: number;
}

/** At most this many of each kind are kept; the drawer shows at most 3 sources per reagent. */
export const KEEP: Readonly<Record<ReagentSourceKind, number>> = {
  vendor: 3,
  vendor_limited: 3,
  crafted: 3,
  skinning: 1,
  herbalism: 2,
  mining: 2,
  drop: 2,
};

/** A skinned creature counts for the type and level range when its chance is at least half the best one's. */
const SKIN_SHARE = 0.5;
/**
 * A drop from a creature with at least this many spawn points (one you can farm) goes before a rarer creature's, even
 * at a lower chance: a unique NPC with a 100 % cloth drop is no place to get cloth.
 */
const FARMABLE_SPAWNS = 3;
const CHEST = 3;
const LOCK_KEY_SKILL = 2;
const LOCK_HERBALISM = 2;
const LOCK_MINING = 3;

type Rows = Record<string, string>[];

export interface ReagentSourceInput {
  /** The items recipes use. */
  reagents: ReadonlySet<number>;
  /** Item ID -> the obtainable recipes that make it, the lowest skill first. */
  makers: ReadonlyMap<number, readonly number[]>;
  /** Item ID -> its item level (ItemSparse, else cmangos): the tie-break "nearest level first". */
  itemLevel: (item: number) => number | undefined;
  db2: { Lock?: Rows; CreatureType?: Rows; UiMapAssignment?: Rows; AreaTable?: Rows; Map?: Rows };
  cmangos: {
    creature_template?: SqlRow[];
    creature?: SqlRow[];
    npc_vendor?: SqlRow[];
    npc_vendor_template?: SqlRow[];
    creature_loot_template?: SqlRow[];
    skinning_loot_template?: SqlRow[];
    reference_loot_template?: SqlRow[];
    gameobject_template?: SqlRow[];
    gameobject?: SqlRow[];
    gameobject_loot_template?: SqlRow[];
  };
}

interface Creature {
  name: string;
  minLevel?: number;
  maxLevel?: number;
  type?: number;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** The first of each name, in order. */
function firstByName<T>(list: readonly T[], name: (t: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((t) => {
    const k = name(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Each loot table entry's chance of the wanted items, in percent, through references and groups (see the header).
 * Only items in `wanted` are kept.
 */
export function lootChances(
  rows: readonly SqlRow[],
  references: readonly SqlRow[],
  wanted: ReadonlySet<number>,
): Map<number, Map<number, number>> {
  const byEntry = (list: readonly SqlRow[]) => {
    const out = new Map<number, SqlRow[]>();
    for (const r of list) {
      const e = n(r, "entry");
      if (e !== undefined) push(out, e, r);
    }
    return out;
  };
  const refs = byEntry(references);
  const refCache = new Map<number, Map<number, number>>();
  const resolve = (list: readonly SqlRow[], seen: ReadonlySet<number>): Map<number, number> => {
    const out = new Map<number, number>();
    const add = (item: number, chance: number) => out.set(item, Math.min(100, (out.get(item) ?? 0) + chance));
    // A group's rows with chance 0 share what its other rows leave.
    const groups = new Map<number, { explicit: number; zero: number }>();
    for (const r of list) {
      const g = n(r, "groupid") ?? 0;
      const c = n(r, "ChanceOrQuestChance") ?? 0;
      if (g === 0 || c < 0) continue;
      const t = groups.get(g) ?? { explicit: 0, zero: 0 };
      if (c === 0) t.zero++;
      else t.explicit += c;
      groups.set(g, t);
    }
    for (const r of list) {
      const g = n(r, "groupid") ?? 0;
      let c = n(r, "ChanceOrQuestChance") ?? 0;
      if (c < 0) continue;
      if (c === 0) {
        const t = groups.get(g);
        if (g === 0 || t === undefined || t.zero === 0) continue;
        c = Math.max(0, 100 - t.explicit) / t.zero;
      }
      const m = n(r, "mincountOrRef") ?? 1;
      if (m < 0) {
        const ref = -m;
        if (seen.has(ref)) continue;
        for (const [item, inner] of refChances(ref, seen)) add(item, (c * inner) / 100);
      } else {
        const item = n(r, "item") ?? 0;
        if (wanted.has(item)) add(item, c);
      }
    }
    return out;
  };
  const refChances = (ref: number, seen: ReadonlySet<number>): Map<number, number> => {
    const cached = refCache.get(ref);
    if (cached !== undefined) return cached;
    const result = resolve(refs.get(ref) ?? [], new Set([...seen, ref]));
    refCache.set(ref, result);
    return result;
  };
  const out = new Map<number, Map<number, number>>();
  for (const [entry, list] of byEntry(rows)) {
    const chances = resolve(list, new Set());
    if (chances.size > 0) out.set(entry, chances);
  }
  return out;
}

/** The zone (or instance) a point of a map lies in: the smallest of the client's zone rectangles that holds it. */
export function zoneFinder(db2: ReagentSourceInput["db2"]): (map: number, x: number, y: number) => string | undefined {
  const areas = new Map<number, { name?: string; parent: number }>();
  for (const r of db2.AreaTable ?? []) {
    const id = int(r, "ID");
    if (id === undefined) continue;
    const name = r.AreaName_lang;
    areas.set(id, { name: name !== undefined && name !== "" ? name : undefined, parent: int(r, "ParentAreaID") ?? 0 });
  }
  const instances = new Map<number, string>();
  for (const r of db2.Map ?? []) {
    const id = int(r, "ID");
    const name = r.MapName_lang;
    if (id !== undefined && name !== undefined && name !== "" && (int(r, "InstanceType") ?? 0) > 0) {
      instances.set(id, name);
    }
  }
  const boxes = new Map<number, { x0: number; y0: number; x1: number; y1: number; name: string }[]>();
  for (const r of db2.UiMapAssignment ?? []) {
    const map = int(r, "MapID");
    const area = areas.get(int(r, "AreaID") ?? -1);
    const [x0, y0, x1, y1] = ["Region_0", "Region_1", "Region_3", "Region_4"].map((k) => float(r, k));
    if (map === undefined || area?.name === undefined || area.parent !== 0) continue;
    if (x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined) continue;
    push(boxes, map, { x0, y0, x1, y1, name: area.name });
  }
  for (const list of boxes.values()) list.sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0));
  return (map, x, y) => {
    const hit = boxes.get(map)?.find((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
    return hit?.name ?? instances.get(map);
  };
}

export function buildReagentSources(input: ReagentSourceInput): ReagentSourceRecord[] {
  const { reagents, db2, cmangos: cm } = input;
  const out: ReagentSourceRecord[] = [];
  const record = (r: ReagentSourceRecord) => {
    for (const k of Object.keys(r) as (keyof ReagentSourceRecord)[]) if (r[k] === undefined) delete r[k];
    out.push(r);
  };

  // Creatures, their first spawn point, and objects with their spawns.
  const creatures = new Map<number, Creature>();
  const lootOwners = new Map<number, number[]>();
  const skinOwners = new Map<number, number[]>();
  const vendorTemplateUsers = new Map<number, number[]>();
  for (const r of cm.creature_template ?? []) {
    const entry = n(r, "Entry");
    if (entry === undefined) continue;
    creatures.set(entry, {
      name: s(r, "Name") ?? "",
      minLevel: n(r, "MinLevel"),
      maxLevel: n(r, "MaxLevel"),
      type: n(r, "CreatureType"),
    });
    const loot = n(r, "LootId") ?? 0;
    if (loot > 0) push(lootOwners, loot, entry);
    const skin = n(r, "SkinningLootId") ?? 0;
    if (skin > 0) push(skinOwners, skin, entry);
    const vt = n(r, "VendorTemplateId") ?? 0;
    if (vt > 0) push(vendorTemplateUsers, vt, entry);
  }
  const spawns = new Map<number, { map: number; x?: number; y?: number }>();
  const spawnCount = new Map<number, number>();
  for (const r of cm.creature ?? []) {
    const id = n(r, "id");
    const map = n(r, "map");
    if (id === undefined || map === undefined) continue;
    spawnCount.set(id, (spawnCount.get(id) ?? 0) + 1);
    if (!spawns.has(id)) spawns.set(id, { map, x: n(r, "position_x"), y: n(r, "position_y") });
  }
  const objectSpawned = new Set<number>();
  for (const r of cm.gameobject ?? []) {
    const id = n(r, "id");
    if (id !== undefined) objectSpawned.add(id);
  }
  const creatureTypes = new Map<number, string>();
  for (const r of db2.CreatureType ?? []) {
    const id = int(r, "ID");
    if (id !== undefined && r.Name_lang) creatureTypes.set(id, r.Name_lang);
  }
  const zoneOf = zoneFinder(db2);
  const level = (c: Creature | undefined) => c?.minLevel ?? c?.maxLevel;
  const distance = (item: number, lvl: number | undefined) => {
    const il = input.itemLevel(item);
    return il === undefined || lvl === undefined ? 0 : Math.abs(lvl - il);
  };

  // --- vendors: unlimited and limited stock, one row per NPC name, the spawned ones and the nearest level first ---
  const sold = new Map<number, Map<number, boolean>>();
  const sells = (item: number | undefined, npc: number, limited: boolean) => {
    if (item === undefined || !reagents.has(item)) return;
    const npcs = sold.get(item) ?? sold.set(item, new Map()).get(item)!;
    npcs.set(npc, (npcs.get(npc) ?? false) || limited);
  };
  for (const r of cm.npc_vendor ?? []) sells(n(r, "item"), n(r, "entry") ?? 0, (n(r, "maxcount") ?? 0) > 0);
  for (const r of cm.npc_vendor_template ?? []) {
    for (const npc of vendorTemplateUsers.get(n(r, "entry") ?? -1) ?? []) {
      sells(n(r, "item"), npc, (n(r, "maxcount") ?? 0) > 0);
    }
  }
  for (const item of [...sold.keys()].sort((a, b) => a - b)) {
    for (const limited of [false, true]) {
      const kind = limited ? "vendor_limited" : "vendor";
      const list = [...sold.get(item)!]
        .filter(([, l]) => l === limited)
        .map(([npc]) => {
          const c = creatures.get(npc);
          const spawn = spawns.get(npc);
          // Without a position only an instance's name can be told.
          const zone =
            spawn === undefined ? undefined : zoneOf(spawn.map, spawn.x ?? Number.NaN, spawn.y ?? Number.NaN);
          return { name: c?.name ?? "", zone, spawned: spawn !== undefined, d: distance(item, level(c)) };
        })
        .filter((v) => v.name !== "")
        .sort(
          (a, b) =>
            Number(b.spawned) - Number(a.spawned) ||
            Number(b.zone !== undefined) - Number(a.zone !== undefined) ||
            a.d - b.d ||
            a.name.localeCompare(b.name, "en"),
        );
      firstByName(list, (v) => v.name)
        .slice(0, KEEP[kind])
        .forEach((v, i) => record({ itemId: item, kind, position: i + 1, name: v.name, zone: v.zone }));
    }
  }

  // --- crafted: the recipes that make it ---
  for (const item of [...reagents].sort((a, b) => a - b)) {
    (input.makers.get(item) ?? [])
      .slice(0, KEEP.crafted)
      .forEach((recipeId, i) => record({ itemId: item, kind: "crafted", position: i + 1, recipeId }));
  }

  const references = cm.reference_loot_template ?? [];

  // --- skinning: the creature type and level range of the creatures that give it most ---
  const skinned = new Map<number, { creature: number; chance: number }[]>();
  for (const [entry, chances] of lootChances(cm.skinning_loot_template ?? [], references, reagents)) {
    for (const owner of skinOwners.get(entry) ?? []) {
      for (const [item, chance] of chances) push(skinned, item, { creature: owner, chance });
    }
  }
  for (const item of [...skinned.keys()].sort((a, b) => a - b)) {
    let list = skinned.get(item)!.filter((x) => x.chance > 0);
    if (list.some((x) => spawns.has(x.creature))) list = list.filter((x) => spawns.has(x.creature));
    const best = Math.max(0, ...list.map((x) => x.chance));
    const main = list.filter((x) => x.chance >= best * SKIN_SHARE).map((x) => creatures.get(x.creature)!);
    if (main.length === 0) continue;
    const types = new Map<number, number>();
    for (const c of main) if (c.type !== undefined) types.set(c.type, (types.get(c.type) ?? 0) + 1);
    const type = [...types].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
    const lows = main.map((c) => c.minLevel ?? c.maxLevel).filter((x): x is number => x !== undefined && x > 0);
    const highs = main.map((c) => c.maxLevel ?? c.minLevel).filter((x): x is number => x !== undefined && x > 0);
    record({
      itemId: item,
      kind: "skinning",
      position: 1,
      creatureType: type === undefined ? undefined : creatureTypes.get(type),
      minLevel: lows.length > 0 ? Math.min(...lows) : undefined,
      maxLevel: highs.length > 0 ? Math.max(...highs) : undefined,
    });
  }

  // --- herb and ore nodes: chest-type objects whose lock needs Herbalism or Mining ---
  const lockSkill = new Map<number, "herbalism" | "mining">();
  for (const r of db2.Lock ?? []) {
    const id = int(r, "ID");
    if (id === undefined) continue;
    for (let i = 0; i < 8; i++) {
      if (int(r, `Type_${i}`) !== LOCK_KEY_SKILL) continue;
      const lockType = int(r, `_Index_${i}`) ?? int(r, `Index_${i}`);
      if (lockType === LOCK_HERBALISM) lockSkill.set(id, "herbalism");
      if (lockType === LOCK_MINING) lockSkill.set(id, "mining");
    }
  }
  const nodesOfLoot = new Map<number, { entry: number; name: string; skill: "herbalism" | "mining" }[]>();
  for (const r of cm.gameobject_template ?? []) {
    const entry = n(r, "entry");
    const skill = lockSkill.get(n(r, "data0") ?? -1);
    const loot = n(r, "data1") ?? 0;
    if (entry === undefined || n(r, "type") !== CHEST || skill === undefined || loot <= 0) continue;
    push(nodesOfLoot, loot, { entry, name: s(r, "name") ?? "", skill });
  }
  const gathered = new Map<
    number,
    { name: string; skill: "herbalism" | "mining"; chance: number; spawned: boolean }[]
  >();
  for (const [entry, chances] of lootChances(cm.gameobject_loot_template ?? [], references, reagents)) {
    for (const node of nodesOfLoot.get(entry) ?? []) {
      if (node.name === "") continue;
      for (const [item, chance] of chances) {
        push(gathered, item, { name: node.name, skill: node.skill, chance, spawned: objectSpawned.has(node.entry) });
      }
    }
  }
  for (const item of [...gathered.keys()].sort((a, b) => a - b)) {
    for (const kind of ["herbalism", "mining"] as const) {
      let list = gathered.get(item)!.filter((x) => x.skill === kind && x.chance > 0);
      if (list.some((x) => x.spawned)) list = list.filter((x) => x.spawned);
      firstByName(
        list.sort((a, b) => b.chance - a.chance || a.name.localeCompare(b.name, "en")),
        (x) => x.name,
      )
        .slice(0, KEEP[kind])
        .forEach((x, i) => record({ itemId: item, kind, position: i + 1, name: x.name }));
    }
  }

  // --- drops: farmable creatures first (FARMABLE_SPAWNS), then the best chance, then the nearest level ---
  const dropped = new Map<number, { creature: number; chance: number }[]>();
  for (const [entry, chances] of lootChances(cm.creature_loot_template ?? [], references, reagents)) {
    for (const owner of lootOwners.get(entry) ?? (creatures.has(entry) ? [entry] : [])) {
      for (const [item, chance] of chances) push(dropped, item, { creature: owner, chance });
    }
  }
  for (const item of [...dropped.keys()].sort((a, b) => a - b)) {
    let list = dropped
      .get(item)!
      .map((x) => ({ ...x, c: creatures.get(x.creature)! }))
      .filter((x) => x.chance > 0 && x.c.name !== "");
    if (list.some((x) => spawns.has(x.creature))) list = list.filter((x) => spawns.has(x.creature));
    const farmable = (x: { creature: number }) => (spawnCount.get(x.creature) ?? 0) >= FARMABLE_SPAWNS;
    list.sort(
      (a, b) =>
        Number(farmable(b)) - Number(farmable(a)) ||
        b.chance - a.chance ||
        distance(item, level(a.c)) - distance(item, level(b.c)) ||
        a.c.name.localeCompare(b.c.name, "en"),
    );
    firstByName(list, (x) => x.c.name)
      .slice(0, KEEP.drop)
      .forEach((x, i) =>
        record({ itemId: item, kind: "drop", position: i + 1, name: x.c.name, chance: round2(x.chance) }),
      );
  }

  const order: Record<ReagentSourceKind, number> = {
    vendor: 0,
    vendor_limited: 1,
    crafted: 2,
    skinning: 3,
    herbalism: 4,
    mining: 5,
    drop: 6,
  };
  return out.sort((a, b) => a.itemId - b.itemId || order[a.kind] - order[b.kind] || a.position - b.position);
}
