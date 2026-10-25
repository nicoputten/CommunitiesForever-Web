// Vanilla professions by skill line ID (the keys of the addon's Char.professions, from GetProfessionInfo).
// Source: skill line IDs and English names of the game client's SkillLine table, as listed on warcraft.wiki.gg
// "TradeSkillLineID" (https://warcraft.wiki.gg/wiki/TradeSkillLineID); Cooking 185 and Mining 186 also appear in the addon
// fixtures. Rank caps: Apprentice 75, Journeyman 150, Expert 225, Artisan 300 (warcraft.wiki.gg "Profession").

export type ProfessionKind = "primary" | "secondary";

export interface ProfessionInfo {
  skillLineID: number;
  name: string;
  kind: ProfessionKind;
}

export const PROFESSIONS: Readonly<Record<number, ProfessionInfo>> = {
  171: { skillLineID: 171, name: "Alchemy", kind: "primary" },
  164: { skillLineID: 164, name: "Blacksmithing", kind: "primary" },
  333: { skillLineID: 333, name: "Enchanting", kind: "primary" },
  202: { skillLineID: 202, name: "Engineering", kind: "primary" },
  182: { skillLineID: 182, name: "Herbalism", kind: "primary" },
  165: { skillLineID: 165, name: "Leatherworking", kind: "primary" },
  186: { skillLineID: 186, name: "Mining", kind: "primary" },
  393: { skillLineID: 393, name: "Skinning", kind: "primary" },
  197: { skillLineID: 197, name: "Tailoring", kind: "primary" },
  185: { skillLineID: 185, name: "Cooking", kind: "secondary" },
  129: { skillLineID: 129, name: "First Aid", kind: "secondary" },
  356: { skillLineID: 356, name: "Fishing", kind: "secondary" },
};

export interface RankCap {
  name: string;
  max: number;
}

/** Profession ranks in order, each with its skill cap. */
export const RANK_CAPS: readonly RankCap[] = [
  { name: "Apprentice", max: 75 },
  { name: "Journeyman", max: 150 },
  { name: "Expert", max: 225 },
  { name: "Artisan", max: 300 },
];

/** The highest skill in Vanilla (Artisan). */
export const MAX_SKILL = 300;

/** The profession of a skill line ID (number or the string key of Character.professions); undefined if unknown. */
export function professionInfo(skillLineID: number | string | undefined): ProfessionInfo | undefined {
  const id = typeof skillLineID === "string" ? Number(skillLineID) : skillLineID;
  return id !== undefined && Object.hasOwn(PROFESSIONS, id) ? PROFESSIONS[id] : undefined;
}

/** The rank whose cap is `max` (the addon's Profession.max); undefined for any other value. */
export function rankForCap(max: number | undefined): RankCap | undefined {
  return RANK_CAPS.find((rank) => rank.max === max);
}
