import type { ClassFile } from "./gamedata/classes";
import { INVENTORY_SLOTS } from "./gamedata/items";

// A boss's loot on the dungeon page (WEB-102, board DL04): who can use a drop, its type line and its chance. One rule
// with the addon (CF-106, src/core/DungeonLoot.lua there), checked against its golden cases
// (tests/fixtures/addon-golden/loot-usable-cases.json).
//
// "Usable by" (Nico, 2026-11-07): the class can EVER use the item: class-only items by their AllowableClass mask (bit
// classID - 1; -1, 0 or missing = every class), the armor types the class reaches by level 60 (mail for hunters and
// shamans and plate for warriors and paladins come at 40, but count), shields, relics, and the weapon types the class
// can learn in Classic. No level, no trained skills. Quest drops and anything that is not armor or a weapon are usable.
// Sources (rule 10): warcraft.wiki.gg "Class proficiencies", "Weapon skill" and the class pages, read 2026-11-07, with
// the Classic weapon lists set from the Classic skill trainers (the golden file's sourceNote: no druid polearms before
// 3.0, no rogue axes, no paladin ranged weapons or staves, no hunter maces). Subclass numbers: the client's
// Enum.ItemArmorSubclass and Enum.ItemWeaponSubclass.

export const ARMOR_CLASS = 4;
export const WEAPON_CLASS = 2;
export const RECIPE_CLASS = 9;
export const QUEST_CLASS = 12;

/** ChrClasses IDs by classFile: the AllowableClass mask has bit (id - 1). */
export const CLASS_IDS: Readonly<Record<ClassFile, number>> = {
  WARRIOR: 1,
  PALADIN: 2,
  HUNTER: 3,
  ROGUE: 4,
  PRIEST: 5,
  SHAMAN: 7,
  MAGE: 8,
  WARLOCK: 9,
  DRUID: 11,
};

/** Armor subclasses per class: 0 misc, 1 cloth, 2 leather, 3 mail, 4 plate, 6 shield, 7 libram, 8 idol, 9 totem. */
export const ARMOR_BY_CLASS: Readonly<Record<ClassFile, readonly number[]>> = {
  WARRIOR: [0, 1, 2, 3, 4, 6],
  PALADIN: [0, 1, 2, 3, 4, 6, 7],
  HUNTER: [0, 1, 2, 3],
  ROGUE: [0, 1, 2],
  PRIEST: [0, 1],
  SHAMAN: [0, 1, 2, 3, 6, 9],
  MAGE: [0, 1],
  WARLOCK: [0, 1],
  DRUID: [0, 1, 2, 8],
};

/**
 * Weapon subclasses per class: 0 one-hand axe, 1 two-hand axe, 2 bow, 3 gun, 4 one-hand mace, 5 two-hand mace, 6
 * polearm, 7 one-hand sword, 8 two-hand sword, 10 staff, 13 fist weapon, 14 miscellaneous, 15 dagger, 16 thrown, 18
 * crossbow, 19 wand, 20 fishing pole.
 */
export const WEAPONS_BY_CLASS: Readonly<Record<ClassFile, readonly number[]>> = {
  WARRIOR: [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 13, 14, 15, 16, 18, 20],
  PALADIN: [0, 1, 4, 5, 6, 7, 8, 14, 20],
  HUNTER: [0, 1, 2, 3, 6, 7, 8, 10, 13, 14, 15, 16, 18, 20],
  ROGUE: [2, 3, 4, 7, 13, 14, 15, 16, 18, 20],
  PRIEST: [4, 10, 14, 15, 19, 20],
  SHAMAN: [0, 1, 4, 5, 10, 13, 14, 15, 20],
  MAGE: [7, 10, 14, 15, 19, 20],
  WARLOCK: [7, 10, 14, 15, 19, 20],
  DRUID: [4, 5, 10, 13, 14, 15, 20],
};

/** What the rules read of a drop (the boss_drops row). */
export interface LootDrop {
  classId?: number;
  subclassId?: number;
  /** The AllowableClass mask; missing, 0 or -1 = every class. */
  classes?: number;
  questId?: number;
}

const isClassFile = (c: string | undefined): c is ClassFile => c !== undefined && Object.hasOwn(CLASS_IDS, c);

/** True when the class can ever use the drop. An unknown class can use everything (nothing to go by). */
export function usable(classFile: string | undefined, drop: LootDrop): boolean {
  if (!isClassFile(classFile)) return true;
  if (drop.questId !== undefined || drop.classId === QUEST_CLASS) return true;
  const mask = drop.classes;
  if (mask !== undefined && mask > 0 && Math.floor(mask / 2 ** (CLASS_IDS[classFile] - 1)) % 2 !== 1) return false;
  if (drop.classId === ARMOR_CLASS) return ARMOR_BY_CLASS[classFile].includes(drop.subclassId ?? -1);
  if (drop.classId === WEAPON_CLASS) return WEAPONS_BY_CLASS[classFile].includes(drop.subclassId ?? -1);
  return true;
}

// --- the type line ("Two-Hand · Mace", "Leather · Legs", "Quest item", "Recipe · Cooking"), as the addon writes it --

const DOT = " · ";
const ARMOR_TYPES: Readonly<Record<number, string>> = { 1: "Cloth", 2: "Leather", 3: "Mail", 4: "Plate" };
const OTHER_ARMOR: Readonly<Record<number, string>> = { 6: "Shield", 7: "Libram", 8: "Idol", 9: "Totem" };
// Weapons named with their hand (One-Hand · Sword) and those named alone (Dagger, Staff).
const HANDED: Readonly<Record<number, string>> = {
  0: "Axe",
  1: "Axe",
  4: "Mace",
  5: "Mace",
  7: "Sword",
  8: "Sword",
  13: "Fist Weapon",
};
const ALONE: Readonly<Record<number, string>> = {
  2: "Bow",
  3: "Gun",
  6: "Polearm",
  10: "Staff",
  14: "Miscellaneous",
  15: "Dagger",
  16: "Thrown",
  18: "Crossbow",
  19: "Wand",
  20: "Fishing Pole",
};
// Recipe subclasses: the client's Enum.ItemRecipeSubclass.
const RECIPES: Readonly<Record<number, string>> = {
  0: "Book",
  1: "Leatherworking",
  2: "Tailoring",
  3: "Engineering",
  4: "Blacksmithing",
  5: "Cooking",
  6: "Alchemy",
  7: "First Aid",
  8: "Enchanting",
  9: "Fishing",
};
const CLASSES: Readonly<Record<number, string>> = {
  0: "Consumable",
  1: "Container",
  5: "Reagent",
  6: "Projectile",
  7: "Trade Goods",
  11: "Quiver",
  13: "Key",
  15: "Miscellaneous",
};
const CLOAK = 16;
const TWO_HAND_SUBCLASSES = [1, 5, 8];

/** The grey type text of a drop; `inventoryType` from the item database when it has the item. */
export function lootTypeText(drop: LootDrop, inventoryType?: number): string {
  const slot = inventoryType === undefined ? undefined : INVENTORY_SLOTS[inventoryType];
  if (drop.questId !== undefined || drop.classId === QUEST_CLASS) return "Quest item";
  const sub = drop.subclassId ?? -1;
  if (drop.classId === RECIPE_CLASS) return RECIPES[sub] !== undefined ? `Recipe${DOT}${RECIPES[sub]}` : "Recipe";
  if (drop.classId === WEAPON_CLASS) {
    if (ALONE[sub] !== undefined) return ALONE[sub];
    const name = HANDED[sub] ?? "Weapon";
    const hand = slot ?? (TWO_HAND_SUBCLASSES.includes(sub) ? "Two-Hand" : undefined);
    return hand !== undefined ? `${hand}${DOT}${name}` : name;
  }
  if (drop.classId === ARMOR_CLASS) {
    if (OTHER_ARMOR[sub] !== undefined) return OTHER_ARMOR[sub];
    if (inventoryType === CLOAK) return "Back";
    const armor = ARMOR_TYPES[sub];
    if (armor !== undefined && slot !== undefined) return `${armor}${DOT}${slot}`;
    return armor ?? slot ?? "Armor";
  }
  return drop.classId === undefined ? "" : (CLASSES[drop.classId] ?? "");
}

/** "36%", "<1%" for a chance in percent. */
export function chanceText(chance: number): string {
  if (chance >= 1) return `${Math.floor(chance + 0.5)}%`;
  return chance > 0 ? "<1%" : "";
}

/** A recipe drop's profession (skill line) by its recipe subclass (Cooking is 185 on Forever, as the addon found). */
export const RECIPE_LINES: Readonly<Record<number, number>> = {
  1: 165,
  2: 197,
  3: 202,
  4: 164,
  5: 185,
  6: 171,
  7: 129,
  8: 333,
  9: 356,
};
