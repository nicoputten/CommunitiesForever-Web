import {
  DAMAGE_SCHOOLS,
  INVENTORY_SLOTS,
  ITEM_BINDING,
  ITEM_STATS,
  RESISTANCE_NAMES,
  RESISTANCES,
  TRADE_GOODS_CLASS,
  itemQuality,
  type ItemQuality,
} from "../gamedata/items";
import type { ItemRecord } from "../recipes/build";

// The item tooltip (WEB-92, handoff C1, board recipes-drawer): the game's own order, from our item database. No sell
// price (gold is never shown). An item of Forever's own without a name (amendment 2) shows its fallback name only.

export type TooltipTone = "plain" | "muted" | "green" | "yellow";

export interface TooltipLine {
  text: string;
  /** Right-aligned on the same line (the slot line's type, a weapon's speed). */
  right?: string;
  tone: TooltipTone;
}

export interface ItemTooltipView {
  id: number;
  name: string;
  quality: ItemQuality;
  /** False: no name in the item data yet (Forever's own); the name is the fallback. */
  named: boolean;
  lines: TooltipLine[];
}

/** "Item 279972": the fallback name of an item the item data has no name for (as "Quest 1234", WEB-23). */
export function itemFallbackName(id: number): string {
  return `Item ${id}`;
}

/** "Recipe 1229504": a recipe that makes no item and has no name. */
export function recipeFallbackName(id: number): string {
  return `Recipe ${id}`;
}

/**
 * "Requires Heavy Leather (12), Fine Thread (2)": the reagents line under a recipe's created item, as the game shows
 * it (WEB-104); undefined without reagents.
 */
export function reagentsLine(reagents: readonly { id: number; name?: string; count: number }[]): string | undefined {
  if (reagents.length === 0) return undefined;
  const list = reagents.map((r) => {
    const name = r.name === undefined || r.name === "" ? itemFallbackName(r.id) : r.name;
    return r.count > 1 ? `${name} (${r.count})` : name;
  });
  return `Requires ${list.join(", ")}`;
}

const signed = (n: number) => (n < 0 ? `-${-n}` : `+${n}`);

export function itemTooltip(item: ItemRecord): ItemTooltipView {
  const lines: TooltipLine[] = [];
  const add = (text: string, tone: TooltipTone = "plain", right?: string) =>
    lines.push(right === undefined ? { text, tone } : { text, tone, right });

  const bind = item.bonding === undefined ? undefined : ITEM_BINDING[item.bonding];
  if (bind !== undefined) add(bind);
  const slot = item.inventoryType === undefined ? undefined : INVENTORY_SLOTS[item.inventoryType];
  if (slot !== undefined) add(slot, "plain", item.typeName ?? "");
  else if (item.classId === TRADE_GOODS_CLASS) add("Crafting Reagent", "muted");

  if (item.damage !== undefined) {
    const school = DAMAGE_SCHOOLS[item.damage.school];
    const speed = item.speed === undefined ? undefined : `Speed ${(item.speed / 1000).toFixed(2)}`;
    add(`${item.damage.min} - ${item.damage.max}${school === undefined ? "" : ` ${school}`} Damage`, "plain", speed);
    if (item.speed !== undefined && item.speed > 0) {
      const dps = (item.damage.min + item.damage.max) / 2 / (item.speed / 1000);
      add(`(${dps.toFixed(1)} damage per second)`);
    }
  }
  if (item.armor !== undefined && item.armor > 0) add(`${item.armor} Armor`);
  for (const stat of item.stats ?? []) {
    const name = ITEM_STATS[stat.type];
    if (name !== undefined && stat.value !== 0) add(`${signed(stat.value)} ${name}`);
  }
  for (const school of RESISTANCES) {
    const value = item.resistances?.[school];
    if (value !== undefined && value !== 0) add(`${signed(value)} ${RESISTANCE_NAMES[school]} Resistance`);
  }
  if (item.durability !== undefined && item.durability > 0) add(`Durability ${item.durability} / ${item.durability}`);
  if (item.requiredLevel !== undefined && item.requiredLevel > 1) add(`Requires Level ${item.requiredLevel}`);
  for (const text of item.equip ?? []) add(`Equip: ${text}`, "green");
  for (const text of item.chanceOnHit ?? []) add(`Chance on hit: ${text}`, "green");
  for (const text of item.use ?? []) add(`Use: ${text}`, "green");
  if (item.description !== undefined && item.description !== "") add(`“${item.description}”`, "yellow");
  if (item.maxStack !== undefined && item.maxStack > 1 && slot === undefined) add(`Max Stack: ${item.maxStack}`);

  const named = item.name !== undefined && item.name !== "";
  return {
    id: item.id,
    name: named ? item.name! : itemFallbackName(item.id),
    quality: itemQuality(item.quality),
    named,
    lines: named ? lines : [],
  };
}
