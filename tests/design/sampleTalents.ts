import type { ClassTalentsRecord, TalentTreeRecord } from "@/core/talents/build";

// WEB-100 (board talent-tooltips): the sample Warlock talent trees for the design checks and e2e, as the item import
// writes them (src/core/talents/build.ts). The layout (node IDs, names, rows, columns, ranks, row gates) is the Forever
// client's, build 1.60.1 (TraitNode, TraitNodeEntry, TraitCond; the same as everloot.app/tools/talents/warlock); the
// texts are made up (the board's illustrative ones for Ves's Destruction talents), the client's would be longer.

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

/** The board's illustrative texts (made up, not the client's). */
const TEXTS: Record<number, string> = {
  105889: "Your Shadow Bolt critical strikes increase Shadow damage dealt to the target by 20% for 12 sec.",
  105888: "Reduces the casting time of your Shadow Bolt and Immolate spells by 0.5 sec and your Soul Fire spell by 2 sec.",
  105887: "Reduces the Mana cost of your Destruction spells by 3%.",
  105886: "Gives your Destruction spells a 4% chance to daze the target for 5 sec.",
  105883: "Increases the critical strike damage bonus of your Destruction spells by 100%.",
};

const LEFT = [1020, 5020, 9080];

function tree(name: string, specs: Spec[], index: number): TalentTreeRecord {
  return {
    name,
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
      texts: Array.from({ length: maxRanks }, () => TEXTS[id] ?? `Made-up text for ${talentName}.`),
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
