import { classInfo, type ClassFile } from "@/core/gamedata/classes";
import type { FitKind } from "@/core/levelFit";
import type { SlotRole } from "@/core/runs";
import type { AskCardView, PickerCharacter } from "@/core/views/runs";

// Asking now's states for /dev/asks (WEB-51, board asks-now-states), the invented friends of the design prompt.
// The ids don't exist, so an answer here shows "didn't go through".

const MIN = 60;
const ROLES = {
  tank: { state: "", full: false },
  healer: { state: "", full: false },
  damage: { state: "", full: false },
};

function character(
  guid: string,
  name: string,
  classFile: ClassFile,
  level: number,
  fit: [FitKind, string],
  roles: SlotRole[],
): PickerCharacter {
  const info = classInfo(classFile)!;
  return {
    guid,
    name,
    initials: name
      .split(" ")
      .map((w) => w[0])
      .join(""),
    line: `${level} ${info.name}`,
    fit: { kind: fit[0], label: fit[1] },
    roles,
    defaultRole: roles[0]!,
    notFor: `not for ${info.name.toLowerCase()}s`,
    onlyMaybe: fit[0] === "tooLow",
    level,
    classFile,
    colorToken: info.textToken,
  };
}

const token = (classFile: ClassFile) => classInfo(classFile)!.textToken;

function ask(
  id: number,
  over: Partial<AskCardView> & Pick<AskCardView, "dungeon" | "range" | "expiresAt">,
): AskCardView {
  return {
    id,
    asker: "Nico",
    from: "from the game",
    ins: [],
    maybe: 0,
    cant: 0,
    yours: false,
    picker: {
      runId: id,
      title: `Join ${over.dungeon}`,
      sub: `Asking now · levels ${over.range}`,
      characters: [],
      roles: ROLES,
    },
    ...over,
  };
}

export function sampleAsks(now: number): AskCardView[] {
  const zul = character("zul", "Zul Kazrek", "WARLOCK", 15, ["low", "2 below"], ["damage"]);
  const lia = character("lia", "Lia Thornwhisper", "PRIEST", 37, ["fits", "fits"], ["healer", "damage"]);
  const liaLow = character("lia", "Lia Thornwhisper", "PRIEST", 37, ["tooLow", "7 below"], ["healer", "damage"]);
  const deadmines = {
    dungeon: "The Deadmines",
    range: "17–26",
    askerCharacter: { name: "Grom Ashfeller", role: "tank", colorToken: token("WARRIOR") },
    note: "Quick run for the Defias quests",
    ins: [
      { name: "Grom Ashfeller", level: 24, className: "Warrior", colorToken: token("WARRIOR") },
      { name: "Kel Dawnhammer", level: 18, className: "Paladin", colorToken: token("PALADIN") },
    ],
    maybe: 1,
    cant: 1,
  };
  return [
    ask(9001, { ...deadmines, expiresAt: now + 7 * MIN, pick: { guid: "zul", role: "damage" } }),
    ask(9002, {
      dungeon: "Scarlet Monastery: Library",
      range: "29–39",
      expiresAt: now + 4 * MIN,
      asker: "Bob",
      askerCharacter: { name: "Tok Ironhide", role: "healer", colorToken: token("SHAMAN") },
      from: "from Discord",
      ins: [
        { name: "Tok Ironhide", level: 33, className: "Shaman", colorToken: token("SHAMAN") },
        { name: "Lia Thornwhisper", level: 37, className: "Priest", colorToken: token("PRIEST") },
      ],
      answered: { answer: "I'm in", character: "Lia Thornwhisper", colorToken: token("PRIEST") },
      pick: { guid: "lia", role: "healer" },
    }),
    ask(9003, { ...deadmines, expiresAt: now + 40, pick: { guid: "zul", role: "damage" } }),
    ask(9004, {
      dungeon: "Zul'Farrak",
      range: "44–54",
      expiresAt: now + 9 * MIN,
      asker: "Mira",
      askerCharacter: { name: "Mira Sunstrider", role: "damage", colorToken: token("MAGE") },
      from: "from Discord",
      note: "Carry for the sandfury quest",
      ins: [{ name: "Mira Sunstrider", level: 60, className: "Mage", colorToken: token("MAGE") }],
      cant: 1,
      pick: { guid: "lia", role: "healer" },
      noneFit: "None of your characters fit Zul'Farrak (44–54).",
    }),
    ask(9005, {
      dungeon: "Wailing Caverns",
      range: "17–24",
      expiresAt: now + 8 * MIN,
      asker: "You",
      askerCharacter: { name: "Zul Kazrek", role: "damage", colorToken: token("WARLOCK") },
      ins: [{ name: "Kel Dawnhammer", level: 18, className: "Paladin", colorToken: token("PALADIN") }],
      maybe: 1,
      yours: true,
    }),
  ].map((a) =>
    a.id === 9002
      ? { ...a, picker: { ...a.picker, characters: [lia, zul] } }
      : a.id === 9004
        ? { ...a, picker: { ...a.picker, characters: [liaLow] } }
        : { ...a, picker: { ...a.picker, characters: [zul, lia] } },
  );
}
