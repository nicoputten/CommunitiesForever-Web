// A recipe's four skill thresholds (WEB-90). Source: the client's SkillLineAbility table (wago.tools DB2 export of the
// Forever build, docs/SOURCE-DATA.md "Item database"): orange from `MinSkillLineRank` (the skill to learn it), yellow
// from `TrivialSkillLineRankLow`, grey from `TrivialSkillLineRankHigh`. The game shows green halfway between yellow
// and grey (the handoff's rule: green = (yellow + grey) / 2, rounded down, as Blizzard's own tooltips and every
// classic database show it, e.g. Brown Linen Shirt 1 / 35 / 47 / 60).

export interface Thresholds {
  orange: number;
  yellow: number;
  green: number;
  grey: number;
}

export type Difficulty = "orange" | "yellow" | "green" | "grey";

export function greenThreshold(yellow: number, grey: number): number {
  return Math.floor((yellow + grey) / 2);
}

export function thresholds(orange: number, yellow: number, grey: number): Thresholds {
  return { orange, yellow, green: greenThreshold(yellow, grey), grey };
}

/**
 * The colour a recipe shows for a character with `skill` in its profession: orange below yellow, yellow below green,
 * green below grey, grey from grey on. Undefined below orange (the recipe can't be learned yet) or without a skill.
 */
export function difficulty(skill: number | undefined, t: Thresholds): Difficulty | undefined {
  if (skill === undefined || skill < t.orange) return undefined;
  if (skill >= t.grey) return "grey";
  if (skill >= t.green) return "green";
  if (skill >= t.yellow) return "yellow";
  return "orange";
}
