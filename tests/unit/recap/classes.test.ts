import { describe, expect, it } from "vitest";
import { cardClasses } from "@/core/recap/classes";
import { buildRecap } from "@/core/recap/recap";
import type { RecapChar, RecapFriend } from "@/core/recap/types";
import { HISTORY, RICH } from "./sample";

// WEB-72: the class per name in a recap card, for the bot's class icons.

const char = (guid: string, owner: string, name: string, classFile: string, level: number): RecapChar => ({
  guid,
  owner,
  name,
  classFile,
  level,
  professions: [],
  quests: [],
});
const after = {
  m1: char("m1", "mira", "Mira Sunstrider", "MAGE", 60),
  m2: char("m2", "mira", "Tok Alt", "WARRIOR", 20),
  b1: char("b1", "bob", "Bob Example", "ROGUE", 30),
};
const friends: RecapFriend[] = [
  { key: "mira", name: "Mira" },
  { key: "bob", name: "Bob" },
  { key: "cid", name: "Cid" },
];

describe("cardClasses", () => {
  it("names each character in the texts with its class, and each friend with their highest character's", () => {
    const card = { title: "Mira Sunstrider hit 60", text: "Bob carried Tok Alt through Deadmines.", friends: ["mira"] };
    expect(cardClasses(card, after, friends)).toEqual({
      "Mira Sunstrider": "MAGE",
      "Tok Alt": "WARRIOR",
      Mira: "MAGE",
      Bob: "ROGUE",
    });
  });

  it("matches whole names only and leaves out friends without characters", () => {
    const card = { title: "Miranda and Cid", text: "Nothing else.", friends: ["cid"] };
    expect(cardClasses(card, after, friends)).toBeUndefined();
  });

  it("is on the cards of a real recap wherever a card names someone", () => {
    const recap = buildRecap(RICH, HISTORY);
    const card = recap.cards.find((c) => c.friends.length > 0)!;
    const classes = cardClasses(card, RICH.after, RICH.friends);
    expect(classes).toBeDefined();
    for (const [name, cls] of Object.entries(classes!)) {
      expect(`${card.title}\n${card.text}`.includes(name) || RICH.friends.some((f) => f.name === name)).toBe(true);
      expect(cls).toMatch(/^[A-Z]+$/);
    }
  });
});
