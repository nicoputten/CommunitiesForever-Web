// Vanilla classes by the client's classFile token (the addon's Char.classFile).
// Source: classFile tokens and names from the game client (ChrClasses, English); the colour token names are the class
// tokens of docs/DESIGN.md §3 (WEB-15 defines them in src/styles/tokens.css). Classes with a separate text colour on
// dark (Shaman, Warlock, Druid) have a `-text` token; the others use their fill as text colour.

export type ClassFile = "WARRIOR" | "PALADIN" | "HUNTER" | "ROGUE" | "PRIEST" | "SHAMAN" | "MAGE" | "WARLOCK" | "DRUID";

export interface ClassInfo {
  classFile: ClassFile;
  name: string;
  /** CSS custom property of the class fill (markers, discs). */
  colorToken: string;
  /** CSS custom property for the class colour as text on dark (character names). */
  textToken: string;
}

export const CLASSES: Readonly<Record<ClassFile, ClassInfo>> = {
  WARRIOR: { classFile: "WARRIOR", name: "Warrior", colorToken: "--warrior", textToken: "--warrior" },
  PALADIN: { classFile: "PALADIN", name: "Paladin", colorToken: "--paladin", textToken: "--paladin" },
  HUNTER: { classFile: "HUNTER", name: "Hunter", colorToken: "--hunter", textToken: "--hunter" },
  ROGUE: { classFile: "ROGUE", name: "Rogue", colorToken: "--rogue", textToken: "--rogue" },
  PRIEST: { classFile: "PRIEST", name: "Priest", colorToken: "--priest", textToken: "--priest" },
  SHAMAN: { classFile: "SHAMAN", name: "Shaman", colorToken: "--shaman", textToken: "--shaman-text" },
  MAGE: { classFile: "MAGE", name: "Mage", colorToken: "--mage", textToken: "--mage" },
  WARLOCK: { classFile: "WARLOCK", name: "Warlock", colorToken: "--warlock", textToken: "--warlock-text" },
  DRUID: { classFile: "DRUID", name: "Druid", colorToken: "--druid", textToken: "--druid-text" },
};

/** The class of a classFile from the upload; undefined for a missing or unknown one. */
export function classInfo(classFile: string | undefined): ClassInfo | undefined {
  return classFile !== undefined && Object.hasOwn(CLASSES, classFile) ? CLASSES[classFile as ClassFile] : undefined;
}

/** A group slot (WEB-40): one tank, one healer, three damage. */
export type GroupRole = "tank" | "healer" | "damage";

/**
 * The roles a class can fill in a group (WEB-47, decided with Nico 2026-10-27; Vanilla's class design: only warriors,
 * paladins and druids tank, only paladins, druids, priests and shamans heal, every class can deal damage). Order:
 * tank, healer, damage.
 */
export const CLASS_ROLES: Readonly<Record<ClassFile, readonly GroupRole[]>> = {
  WARRIOR: ["tank", "damage"],
  PALADIN: ["tank", "healer", "damage"],
  DRUID: ["tank", "healer", "damage"],
  PRIEST: ["healer", "damage"],
  SHAMAN: ["healer", "damage"],
  MAGE: ["damage"],
  WARLOCK: ["damage"],
  HUNTER: ["damage"],
  ROGUE: ["damage"],
};

/** The roles a character of this class can fill; every role for an unknown class (the site can't tell). */
export function rolesFor(classFile: string | undefined): readonly GroupRole[] {
  const info = classInfo(classFile);
  return info === undefined ? ["tank", "healer", "damage"] : CLASS_ROLES[info.classFile];
}
