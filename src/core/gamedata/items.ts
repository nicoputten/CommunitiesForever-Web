// Item tooltip tables (WEB-92, handoff C1): the words the game's own item tooltip uses for the numbers the item
// database stores (docs/SOURCE-DATA.md "Item database"). Sources:
// - Item quality: Enum.ItemQuality (warcraft.wiki.gg "Enum.ItemQuality", https://warcraft.wiki.gg/wiki/Enum.ItemQuality):
//   0 Poor, 1 Common, 2 Uncommon, 3 Rare, 4 Epic, 5 Legendary, 6 Artifact, 7 Heirloom. The colours are tokens
//   (`--quality-*`, src/styles/tokens.css, the same page's colour table).
// - Binding: ItemBonding / LE_ITEM_BIND_* (warcraft.wiki.gg "ItemBind", https://warcraft.wiki.gg/wiki/ItemBind) with the
//   client's GlobalStrings ITEM_BIND_ON_PICKUP, ITEM_BIND_ON_EQUIP, ITEM_BIND_ON_USE, ITEM_BIND_QUEST.
// - Slots: Enum.InventoryType (warcraft.wiki.gg "Enum.InventoryType", https://warcraft.wiki.gg/wiki/Enum.InventoryType)
//   with the client's GlobalStrings INVTYPE_* (the slot line's left side).
// - Stats: ItemModType as Vanilla uses it (warcraft.wiki.gg "ItemStatType", https://warcraft.wiki.gg/wiki/ItemStatType):
//   0 Mana, 1 Health, 3 Agility, 4 Strength, 5 Intellect, 6 Spirit, 7 Stamina.
// - Damage schools: the client's SpellSchools (warcraft.wiki.gg "SpellSchool", https://warcraft.wiki.gg/wiki/SpellSchool),
//   as cmangos' item_template dmg_type1 numbers them (0 physical, 1 holy, 2 fire, 3 nature, 4 frost, 5 shadow, 6 arcane).
// - Item class 7: Trade Goods (warcraft.wiki.gg "ItemType", https://warcraft.wiki.gg/wiki/ItemType), the reagents.

export const ITEM_QUALITIES = [
  "poor",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "artifact",
  "heirloom",
] as const;
export type ItemQuality = (typeof ITEM_QUALITIES)[number];

/** The quality's name for a number; common for a missing or unknown one. */
export function itemQuality(quality: number | undefined): ItemQuality {
  return (quality !== undefined && ITEM_QUALITIES[quality]) || "common";
}

export const ITEM_BINDING: Readonly<Record<number, string>> = {
  1: "Binds when picked up",
  2: "Binds when equipped",
  3: "Binds when used",
  4: "Quest Item",
};

/** The slot line's left side; types left out (0 not equippable, 18 bag, 24 ammo...) show no slot line. */
export const INVENTORY_SLOTS: Readonly<Record<number, string>> = {
  1: "Head",
  2: "Neck",
  3: "Shoulder",
  4: "Shirt",
  5: "Chest",
  6: "Waist",
  7: "Legs",
  8: "Feet",
  9: "Wrist",
  10: "Hands",
  11: "Finger",
  12: "Trinket",
  13: "One-Hand",
  14: "Off Hand",
  15: "Ranged",
  16: "Back",
  17: "Two-Hand",
  19: "Tabard",
  20: "Chest",
  21: "Main Hand",
  22: "Off Hand",
  23: "Held In Off-hand",
  25: "Thrown",
  26: "Ranged",
  28: "Relic",
};

export const ITEM_STATS: Readonly<Record<number, string>> = {
  0: "Mana",
  1: "Health",
  3: "Agility",
  4: "Strength",
  5: "Intellect",
  6: "Spirit",
  7: "Stamina",
};

export const RESISTANCES = ["holy", "fire", "nature", "frost", "shadow", "arcane"] as const;
export const RESISTANCE_NAMES: Readonly<Record<(typeof RESISTANCES)[number], string>> = {
  holy: "Holy",
  fire: "Fire",
  nature: "Nature",
  frost: "Frost",
  shadow: "Shadow",
  arcane: "Arcane",
};

/** Damage school names; 0 (physical) has none ("45 - 85 Damage"). */
export const DAMAGE_SCHOOLS: Readonly<Record<number, string>> = {
  1: "Holy",
  2: "Fire",
  3: "Nature",
  4: "Frost",
  5: "Shadow",
  6: "Arcane",
};

export const TRADE_GOODS_CLASS = 7;
