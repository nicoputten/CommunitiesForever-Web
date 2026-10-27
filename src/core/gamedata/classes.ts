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
