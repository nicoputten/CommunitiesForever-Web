import type { ClassTalentsRecord, TalentTreeRecord } from "@/core/talents/build";

// WEB-100 (board talent-tooltips): the sample Warlock talent trees for the design checks and e2e, as the item import
// writes them (src/core/talents/build.ts). The layout (node IDs, names, rows, columns, ranks, row gates) is the Forever
// client's, build 1.60.1 (TraitNode, TraitNodeEntry, TraitCond; the same as everloot.app/tools/talents/warlock); the
// texts and icons are made up (the board's illustrative texts for Ves's Destruction talents; painted squares as
// icons); the prerequisites are the client's.

/** [TraitNode ID, name, row, column, max ranks]. Gates: 5 points per row below the first. */
type Spec = [number, string, number, number, number];

const AFFLICTION: Spec[] = [
  [105921, "Improved Life Tap", 1, 1, 2],
  [105925, "Suppression", 1, 2, 5],
  [105924, "Improved Corruption", 1, 3, 5],
  [105923, "Grim Reach", 2, 1, 2],
  [105922, "Soul Harvest", 2, 2, 2],
  [105920, "Improved Drains", 2, 3, 3],
  [105919, "Improved Bane of Agony", 3, 1, 2],
  [105918, "Fel Concentration", 3, 2, 3],
  [105916, "Amplify Curse", 3, 3, 1],
  [105917, "Pandemic", 3, 4, 3],
  [110876, "Malevolence", 4, 1, 5],
  [105914, "Nightfall", 4, 2, 2],
  [105913, "Curse of Exhaustion", 4, 3, 1],
  [105912, "Siphon Life", 5, 2, 1],
  [105911, "Soul Siphon", 5, 3, 3],
  [105910, "Shadow Mastery", 6, 3, 5],
  [105909, "Wrack", 7, 2, 1],
];

const DEMONOLOGY: Spec[] = [
  [105905, "Improved Health Funnel", 1, 1, 2],
  [105908, "Improved Imp", 1, 2, 3],
  [105907, "Demonic Embrace", 1, 3, 5],
  [105906, "Unholy Power", 1, 4, 5],
  [105902, "Demonic Aegis", 2, 1, 2],
  [105904, "Improved Voidwalker", 2, 2, 3],
  [105903, "Fel Vitality", 2, 3, 3],
  [105899, "Demonic Energies", 2, 4, 2],
  [105901, "Improved Sayaad", 3, 1, 3],
  [105900, "Demonic Sacrifice", 3, 2, 1],
  [105898, "Master Summoner", 3, 3, 2],
  [105897, "Decimation", 4, 1, 2],
  [105895, "Fel Domination", 4, 3, 1],
  [105896, "Demonic Brand", 4, 4, 3],
  [105894, "Improved Felhunter", 5, 1, 3],
  [105892, "Soul Link", 5, 2, 1],
  [105893, "Demonic Knowledge", 5, 3, 3],
  [105891, "Master Demonologist", 6, 3, 5],
  [105890, "Demonic Pact", 7, 2, 1],
];

const DESTRUCTION: Spec[] = [
  [105881, "Destructive Reach", 1, 1, 2],
  [105889, "Improved Shadow Bolt", 1, 2, 5],
  [105888, "Bane", 1, 3, 5],
  [105885, "Molten Skin", 2, 1, 5],
  [105887, "Cataclysm", 2, 2, 3],
  [105886, "Aftermath", 2, 3, 5],
  [105883, "Ruin", 3, 2, 5],
  [105884, "Shadowburn", 3, 3, 1],
  [105882, "Intensity", 4, 1, 3],
  [105879, "Agonizing Flames", 4, 2, 3],
  [105880, "Conflagrate", 4, 3, 1],
  [105878, "Pyroclasm", 5, 1, 2],
  [105876, "Bane of Havoc", 5, 2, 1],
  [105877, "Fire and Brimstone", 5, 3, 3],
  [105875, "Shadow and Flame", 6, 3, 5],
  [105874, "Incinerate", 7, 2, 1],
];

/** Made-up texts per rank (the board's illustrative ones for Ves's Destruction talents; the client's are longer). */
const TEXTS: Record<number, (rank: number) => string> = {
  105889: (r) => `Your Shadow Bolt critical strikes increase Shadow damage dealt to the target by ${4 * r}% for 12 sec.`,
  105888: (r) =>
    `Reduces the casting time of your Shadow Bolt and Immolate spells by 0.${r} sec and your Soul Fire spell by ${(0.4 * r).toFixed(1)} sec.`,
  105887: (r) => `Reduces the Mana cost of your Destruction spells by ${r}%.`,
  105886: (r) => `Gives your Destruction spells a ${2 * r}% chance to daze the target for 5 sec.`,
  105883: (r) => `Increases the critical strike damage bonus of your Destruction spells by ${20 * r}%.`,
};

/** Prerequisites (TraitEdge type 2 in build 1.60.1): talent -> the one it needs. */
const REQUIRES: Record<number, number> = {
  105913: 105916,
  105909: 105912,
  105895: 105898,
  105892: 105900,
  105890: 105892,
  105878: 105882,
  105877: 105880,
  105874: 105876,
};

const LEFT = [1020, 5020, 9080];

/** The sample's icon name for a talent or tree: the seed paints a square with its first letter (seedItems.ts). */
export function sampleIcon(name: string): string {
  return `sample_${name.toLowerCase().replace(/[^a-z]+/g, "_")}`;
}

function tree(name: string, specs: Spec[], index: number): TalentTreeRecord {
  return {
    name,
    icon: sampleIcon(name),
    columns: Math.max(...specs.map((s) => s[3])),
    rows: Math.max(...specs.map((s) => s[2])),
    talents: specs.map(([id, talentName, row, column, maxRanks]) => ({
      id,
      name: talentName,
      spellId: 0,
      maxRanks,
      row,
      column,
      ...(row > 1 && { gate: (row - 1) * 5 }),
      posX: LEFT[index]! + (column - 1) * 600,
      posY: 2130 + (row - 1) * 600,
      texts: Array.from({ length: maxRanks }, (_, i) => TEXTS[id]?.(i + 1) ?? `Made-up text for ${talentName}, rank ${i + 1}.`),
      icon: sampleIcon(talentName),
      ...(REQUIRES[id] !== undefined && { requires: [{ id: REQUIRES[id]! }] }),
    })),
  };
}

export const SAMPLE_TALENTS: ClassTalentsRecord[] = [
  {
    classFile: "WARLOCK",
    traitTreeId: 1116,
    columns: 4,
    rows: 7,
    trees: [tree("Affliction", AFFLICTION, 0), tree("Demonology", DEMONOLOGY, 1), tree("Destruction", DESTRUCTION, 2)],
  },
];

/** Every icon the sample trees use. */
export const SAMPLE_TALENT_ICONS: string[] = SAMPLE_TALENTS.flatMap((c) =>
  c.trees.flatMap((t) => [t.icon!, ...t.talents.map((x) => x.icon!)]),
);

/**
 * Ves Doombringer's talents (10 / 0 / 20), as an addon that syncs the nodes would send them: [TraitNode ID, ranks].
 * Destruction is the board's (Improved Shadow Bolt 5/5, Bane 5/5, Cataclysm 3/3, Aftermath 2/5, Ruin 5/5).
 */
export const VES_TALENT_NODES: [number, number][] = [
  [105925, 5],
  [105924, 5],
  [105889, 5],
  [105888, 5],
  [105887, 3],
  [105886, 2],
  [105883, 5],
];
