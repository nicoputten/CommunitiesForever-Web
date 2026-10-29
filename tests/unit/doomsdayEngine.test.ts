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

// WEB-66 follow-up: the PvE weeklies' progress from the friend's feed, for the Week tab's bars.
describe("PvE weekly progress", () => {
  const snap0 = doomsdaySnapshot(input);
  const start = snap0.schedule.dayStart;
  const week = snap0.schedule.week;
  const day = (n: number, at: number, entry: object) => ({
    guid: "G",
    owner: "Ada#1001",
    day: n,
    entry: { quests: {}, ranks: {}, learned: [], runs: [], at, ...entry },
  });
  const withBob: DoomsdayInput = {
    ...input,
    now: start + 3 * 3600,
    data: {
      ...input.data,
      people: {
        ...input.data.people,
        "Bob#2002": { key: "Bob#2002", displayName: "Bob", isUploader: false, hasRecord: true, removed: {} },
      },
      characters: {
        ...input.data.characters,
        B: {
          guid: "B",
          owner: "Bob#2002",
          hasRecord: true,
          name: "Bob Example",
          professions: {},
          talents: [],
          quests: {},
        },
      },
    },
    goals: {
      "Ada#1001": {
        days: {},
        weeks: {
          [week]: {
            set: ["w.days3", "w.quests50", "w.fullClear", "w.dungeonFriends2", "w.discover5"],
            swapped: {},
            done: {},
          },
        },
      },
    },
    feed: [
      day(1, start + 600, {
        quests: { Durotar: 7, Barrens: 5 },
        runs: [{ name: "The Deadmines", kind: "party", bosses: 4, with: ["B"] }],
      }),
      day(2, start + 2 * 3600, {
        quests: { Barrens: 3 },
        runs: [{ name: "Scarlet Monastery", kind: "party", bosses: 3, with: [] }],
      }),
    ],
  };

  it("counts days, quests, a dungeon's bosses with its name, and friends in a run", () => {
    const ada = doomsdaySnapshot(withBob).friends.find((f) => f.friendKey === "Ada#1001")!;
    const progress = Object.fromEntries(ada.week!.goals.map((g) => [g.goal.id, g.progress]));
    // Both feed days fall in the same Doomsday day: one day played.
    expect(progress["w.days3"]).toEqual({ value: 1, target: 3 });
    expect(progress["w.quests50"]).toEqual({ value: 15, target: 50 });
    // Only dungeons with a known boss count: "4 / 7 · The Deadmines"; Scarlet Monastery has wings.
    expect(progress["w.fullClear"]).toEqual({ value: 4, target: 7, detail: "The Deadmines" });
    expect(progress["w.dungeonFriends2"]).toEqual({ value: 1, target: 2 });
    // Not in the feed: no progress at all.
    expect(progress["w.discover5"]).toBeUndefined();
  });
});
