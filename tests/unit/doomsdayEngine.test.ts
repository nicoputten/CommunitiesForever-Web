import { describe, expect, it } from "vitest";
import { doomsdaySnapshot, type DoomsdayInput } from "@/core/doomsday/engine";

// WEB-58: feat records as the Feats tab (WEB-60) shows them: display-ready titles, the epic item and a rank's rank.

const input: DoomsdayInput = {
  now: 1794333600 + 60,
  timeZone: "Europe/Paris",
  reset: { reset: 68400 },
  data: {
    schemaVersion: 2,
    community: {},
    people: {
      "Ada#1001": { key: "Ada#1001", displayName: "Ada", isUploader: true, hasRecord: true, removed: {} },
    },
    characters: {
      G: {
        guid: "G",
        owner: "Ada#1001",
        hasRecord: true,
        name: "Ada Example",
        classFile: "MAGE",
        faction: "Horde",
        professions: {},
        talents: [],
        quests: {},
      },
    },
    locations: {},
    presence: {},
  },
  goals: { "Ada#1001": { days: {}, weeks: {} } },
  feed: [],
  feats: [
    {
      guid: "G",
      key: "pvpRank:6",
      kind: "pvpRank",
      owner: "Ada#1001",
      at: 10,
      alreadyHad: false,
      firstInGroup: true,
      fields: { rank: 6, rankName: "Stone Guard", title: "Mailbox Menace" },
    },
    {
      guid: "G",
      key: "firstEpic",
      kind: "firstEpic",
      owner: "Ada#1001",
      at: 20,
      alreadyHad: false,
      firstInGroup: false,
      fields: { item: { id: 1, name: "Robes of the Exalted", slot: "Chest", level: 60 } },
    },
  ],
};

describe("feat records", () => {
  it("are display-ready, newest first", () => {
    const feats = doomsdaySnapshot(input).feats;
    expect(feats.map((f) => [f.kind, f.title])).toEqual([
      ["firstEpic", "First epic: Robes of the Exalted"],
      ["pvpRank", "Stone Guard, a.k.a. Mailbox Menace"],
    ]);
    expect(feats[0]).toMatchObject({ epicItem: "Robes of the Exalted", detail: "Chest · looted at level 60" });
    expect(feats[1]).toMatchObject({ rank: 6, firstInGroup: true, alreadyHad: false });
    expect(feats[0]!.title).toContain(feats[0]!.epicItem);
  });
});
