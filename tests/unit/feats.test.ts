import { describe, expect, it } from "vitest";
import { cardRank, featText, hasCard, ordinal, rankName, slotName } from "@/core/doomsday/feats";

// WEB-56: the feats' catalogue and texts (the detection is tested with uploads in tests/server/feats.test.ts).

describe("feats", () => {
  it("names ranks per faction, the game's own name first", () => {
    expect(rankName(6, "Horde")).toBe("Stone Guard");
    expect(rankName(6, "Alliance")).toBe("Knight");
    expect(rankName(14, "Alliance")).toBe("Grand Marshal");
    expect(rankName(6, "Horde", "Steinwache")).toBe("Steinwache");
    expect(rankName(0, "Horde")).toBeUndefined();
  });

  it("writes texts for every kind", () => {
    expect(featText({ kind: "honorKills", fields: { kills: 1 } }, "Ves Doombringer").text).toBe(
      "First blood: Ves Doombringer",
    );
    expect(
      featText({ kind: "pvpRank", fields: { rank: 7, rankName: "Blood Guard", title: "Flag Hugger" } }, "Ves"),
    ).toMatchObject({
      title: "Blood Guard",
      line: "a.k.a. Flag Hugger",
      text: "Ves is now Blood Guard, a.k.a. Flag Hugger",
    });
    expect(featText({ kind: "epicMount", fields: { place: 3 } }, "Mira").line).toBe("The 3rd epic mount in the group");
    expect(featText({ kind: "deaths100", fields: { deaths: 100 } }, "Mira").title).toBe(
      "A spirit healer's best friend",
    );
    expect(
      featText({ kind: "professionCap", fields: { rank: 300, title: "Head Chef" }, profession: "Cooking" }, "Mira")
        .text,
    ).toBe("Mira: Cooking 300 · Head Chef");
  });

  it("knows which feats get a card, and which is most special", () => {
    expect(hasCard({ kind: "honorKills", fields: { kills: 5000 } })).toBe(false);
    expect(hasCard({ kind: "honorKills", fields: { kills: 10000 } })).toBe(true);
    expect(hasCard({ kind: "pvpRank", fields: { rank: 5 } })).toBe(false);
    expect(hasCard({ kind: "pvpRank", fields: { rank: 6 } })).toBe(true);
    expect(hasCard({ kind: "mount", fields: {} })).toBe(false);
    const order = [
      { kind: "professionCap" as const, fields: { rank: 300 } },
      { kind: "pvpRank" as const, fields: { rank: 13 } },
      { kind: "firstEpic" as const, fields: {} },
      { kind: "epicMount" as const, fields: {} },
      { kind: "notableItem" as const, fields: { notable: "mooncloth" as const } },
      { kind: "notableItem" as const, fields: { notable: "extravaganzaWon" as const } },
      { kind: "jackOfAllTrades" as const, fields: {} },
      { kind: "honorKills" as const, fields: { kills: 10000 } },
      { kind: "pvpRank" as const, fields: { rank: 14 } },
    ];
    const ranks = order.map(cardRank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("helpers", () => {
    expect([1, 2, 3, 4, 11, 12, 21, 102].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "21st",
      "102nd",
    ]);
    expect(slotName("INVTYPE_2HWEAPON")).toBe("Two-Hand");
    expect(slotName("INVTYPE_NOPE")).toBeUndefined();
  });
});
