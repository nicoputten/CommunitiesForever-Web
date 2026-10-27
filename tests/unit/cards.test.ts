import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cropAround, pathBox, zoneByName } from "@/core/cards/mapCrop";
import { cardSize, milestoneCard, recapHeader, whereisCard, zoneCard } from "@/core/cards/models";
import { CARD_TOKENS, classColours } from "@/core/cards/palette";

// WEB-41d: the card images' tokens, map crops and what each card shows.

describe("the palette", () => {
  it("has every value exactly as tokens.css", () => {
    const css = readFileSync(path.join(__dirname, "..", "..", "src", "styles", "tokens.css"), "utf8");
    for (const [name, value] of Object.entries(CARD_TOKENS)) {
      const m = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
      expect(m?.[1]?.trim().toLowerCase(), name).toBe(value);
    }
  });

  it("colours a disc by class, gold when unknown, white initials on Shaman", () => {
    expect(classColours("WARLOCK")).toEqual({ fill: "--warlock", text: "--warlock-text", on: "--on-gold" });
    expect(classColours("SHAMAN").on).toBe("--on-shaman");
    expect(classColours(undefined)).toEqual({ fill: "--gold", text: "--gold", on: "--on-gold" });
  });
});

describe("map crops", () => {
  it("boxes a path and crops around a zone with its neighbours", () => {
    expect(pathBox("M1,2 5,8 3,4Z")).toEqual({ x: 1, y: 2, w: 4, h: 6 });
    const stv = zoneByName("Stranglethorn Vale")!;
    const crop = cropAround(stv.id, 2)!;
    expect(crop.viewBox.w / crop.viewBox.h).toBeCloseTo(2);
    expect(crop.zones.filter((z) => z.highlight).map((z) => z.id)).toEqual([stv.id]);
    expect(crop.zones.length).toBeGreaterThan(1);
    expect(cropAround("nowhere", 2)).toBeUndefined();
  });
});

describe("cards", () => {
  const char = { guid: "G", name: "Mira Sunstrider", classFile: "MAGE", level: 60 };
  const facts = { name: "Mira Sunstrider", classFile: "MAGE", classLabel: "Mage", race: "Undead", spec: "Frost" };

  it("draws only the milestones worth an image", () => {
    expect(milestoneCard({ kind: "maxLevel", character: char, level: 60, from: 58 }, facts, "h")).toMatchObject({
      title: "Level 60",
      lines: ["From level 58", "Undead Mage · Frost"],
      disc: { initials: "MS", fill: "--mage" },
    });
    expect(milestoneCard({ kind: "level", character: char, level: 30, from: 28 }, facts, "h")).toBeUndefined();
    expect(milestoneCard({ kind: "newCharacter", character: { ...char, level: 12 } }, facts, "h")).toBeUndefined();
    expect(
      milestoneCard(
        { kind: "professionCap", character: char, skillLine: "197", profession: "Tailoring", rank: 225 },
        facts,
        "h",
      ),
    ).toBeUndefined();
  });

  it("heads the recap with the award, else the zone, else the headline", () => {
    const award = recapHeader(
      { dates: "20–26 Oct", headline: "x", award: { title: "Friends of the week", friend: "Ada", amount: "6 levels" } },
      "h",
    );
    expect(award).toMatchObject({
      kind: "award",
      overline: "Weekly recap · 20–26 Oct",
      name: "Ada",
      disc: { initials: "A" },
    });
    expect(recapHeader({ dates: "d", headline: "x", zone: { name: "Duskwood", friends: 3 } }, "h")).toMatchObject({
      kind: "zoneHeader",
      stat: "3 friends",
    });
    expect(recapHeader({ dates: "d", headline: "A quiet week" }, "h")).toMatchObject({
      kind: "headline",
      title: "A quiet week",
    });
    expect(cardSize(award)).toEqual({ width: 1200, height: 400 });
  });

  it("has no zone card for a place the map doesn't draw", () => {
    expect(zoneCard("Warsong Gulch", 2, "h")).toBeUndefined();
    expect(zoneCard("Duskwood", 1, "h")).toMatchObject({ stat: "1 friend" });
  });

  it("marks where a character was seen, newest first, old ones as old", () => {
    const now = 10 * 86400;
    const card = whereisCard(
      facts,
      [
        { zone: "Westfall", seenAt: now - 9 * 86400 },
        { zone: "Stranglethorn Vale", seenAt: now - 7200 },
        { zone: "Stranglethorn Vale", seenAt: now - 9000 },
      ],
      now,
      "h",
    );
    expect(card).toMatchObject({ kind: "whereis", line: "Last seen in Stranglethorn Vale · 2 h ago" });
    if (card?.kind !== "whereis") throw new Error("not a whereis card");
    expect(card.markers[0]).toMatchObject({ age: "now", label: "2 h ago" });
    expect(card.markers.slice(1).every((m) => m.age === "old")).toBe(true);
    expect(whereisCard(facts, [], now, "h")).toBeUndefined();
  });
});
