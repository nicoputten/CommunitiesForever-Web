import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import { normalize } from "@/core/normalize";
import { characterPage, hereToo, type CharacterView } from "@/core/views";
import { NOW, sample } from "./sample";

const names = (list: { name?: string }[]) => list.map((c) => c.name);

describe("character page", () => {
  const ves = characterPage(sample(), "Player-1-VES", NOW)!;

  it("shows the character and who plays it", () => {
    expect(ves.character).toMatchObject({ name: "Ves Doombringer", level: 39, faction: "Horde", ruleset: "PvP" });
    expect(ves.person).toMatchObject({ displayName: "Nico", isUploader: true, dataAge: "live" });
    expect(ves.person?.via).toBeUndefined();
    expect(ves.levelsToMax).toBe(21);
  });

  it("spends level − 9 talent points and draws bars out of 31", () => {
    expect(ves.talents).toEqual({
      available: 30,
      spent: 30,
      mainTreeName: "Destruction",
      maxTreePoints: 31,
      trees: [
        { name: "Affliction", points: 10, fill: 10 / 31, main: false },
        { name: "Demonology", points: 0, fill: 0, main: false },
        { name: "Destruction", points: 20, fill: 20 / 31, main: true },
      ],
    });
    const mira = characterPage(sample(), "Player-1-MIRA", NOW)!;
    expect(mira.levelsToMax).toBe(0);
    expect(mira.talents.available).toBe(51);
    expect(mira.talents.trees[2]).toEqual({ name: "Frost", points: 41, fill: 1, main: true });
  });

  it("suggests the dungeon with the most of the group, any data age (Ruk's data is 9 days old)", () => {
    expect(ves.dungeonFit?.dungeon.name).toBe("Scarlet Monastery");
    expect(names(ves.dungeonFit!.with)).toEqual(["Bob Example", "Lia Thornwhisper", "Tok Ironhide", "Ruk Bloodhoof"]);
  });

  it("finds who else was seen in the same zone, and the owner's other characters", () => {
    expect(names(ves.sameZone)).toEqual(["Lia Thornwhisper"]);
    expect(names(ves.otherCharacters)).toEqual(["Grom Ashfeller", "Sela Moonbrook"]);
    const sela = characterPage(sample(), "Player-1-SELA", NOW)!;
    expect(sela.sameZone).toEqual([]);
    expect(sela.character.sighting).toBeUndefined();
  });

  it("leaves the owner's own alts out of the dungeon fit, and prefers the narrower range on a tie", () => {
    const d = normalize(
      parseLua(`return { schemaVersion = 1,
        self = { battleTag = "Ada#1001", chars = { A = { name = "Ada Example", level = 38 }, A2 = { name = "Ada Alt", level = 38 } } },
        people = { ["Bob#2002"] = { chars = { B = { name = "Bob Example", level = 40 } } } } }`),
    );
    const page = characterPage(d, "A", NOW)!;
    // Ada (38) and Bob (40) both fit Scarlet Monastery (26–45), Razorfen Downs (37–46) and The Drowned City (35–40).
    expect(page.dungeonFit?.dungeon.name).toBe("The Drowned City");
    expect(names(page.dungeonFit!.with)).toEqual(["Bob Example"]);
    expect(names(page.otherCharacters)).toEqual(["Ada Alt"]);
  });

  it("has no fit when nobody else is in range, and no page for a stub or an unknown GUID", () => {
    const d = normalize(
      parseLua(`return { schemaVersion = 1, self = { battleTag = "Ada#1001", chars = { A = { name = "Ada Example" } } },
        presence = { S = { battleTag = "Sam#4004", lastSeen = 1 } } }`),
    );
    const page = characterPage(d, "A", NOW)!;
    expect(page.dungeonFit).toBeUndefined();
    expect(page.levelsToMax).toBeUndefined();
    expect(page.talents).toEqual({ spent: 0, trees: [], maxTreePoints: 31 });
    expect(characterPage(d, "S", NOW)).toBeUndefined();
    expect(characterPage(d, "nope", NOW)).toBeUndefined();
    expect(characterPage(d, "constructor", NOW)).toBeUndefined();
  });
});

describe("here too", () => {
  const c = (name?: string, ownerName?: string) => ({ guid: name ?? "x", hasRecord: true, name, ownerName }) as CharacterView;

  it("names everyone in full, up to three, then counts the rest", () => {
    expect(hereToo([])).toBeUndefined();
    expect(hereToo([c("Lia Thornwhisper")])).toBe("Lia Thornwhisper is here too");
    expect(hereToo([c("A B"), c("C D")])).toBe("A B and C D are here too");
    expect(hereToo([c("A B"), c("C D"), c("E F")])).toBe("A B, C D and E F are here too");
    expect(hereToo([c("A B"), c("C D"), c("E F"), c("G H")])).toBe("A B, C D and 2 others are here too");
  });

  it("calls a friend without the addon by whose character it is", () => {
    expect(hereToo([c(undefined, "Sanne")])).toBe("Sanne's character is here too");
    expect(hereToo([c()])).toBe("Someone is here too");
  });
});
