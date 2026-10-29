import { describe, expect, it } from "vitest";
import { doomsdaySnapshot, type DoomsdayInput } from "@/core/doomsday/engine";
import { doomsdayPage } from "@/core/views/doomsday";
import { featsView, type FeatView } from "@/core/views/doomsdayFeats";
import { ladderView, pvpView } from "@/core/views/doomsdayLadder";

// WEB-59 on the engine's own snapshot (WEB-58), not the made-up sample: a friend with goal records but nothing done
// yet still gets a header, today's goals and a board row, and nothing shows 0 as if known.

const input: DoomsdayInput = {
  now: 1794333600 + 3600,
  timeZone: "Europe/Paris",
  reset: { reset: 68400 },
  data: {
    schemaVersion: 2,
    community: {},
    people: {
      "Ada#1001": { key: "Ada#1001", displayName: "Ada", isUploader: true, hasRecord: true, removed: {} },
      "Bob#2002": { key: "Bob#2002", displayName: "Bob", isUploader: false, hasRecord: false, removed: {} },
    },
    characters: {
      G: {
        guid: "G",
        owner: "Ada#1001",
        hasRecord: true,
        name: "Ada Example",
        classFile: "MAGE",
        faction: "Horde",
        level: 30,
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
  feats: [],
};

describe("doomsdayPage on the engine's snapshot", () => {
  it("renders the viewer's day, the board and the friend without the addon", () => {
    const page = doomsdayPage({ snapshot: doomsdaySnapshot(input), viewerKey: "Ada#1001", timeZone: "Europe/Paris" });
    expect(page.header.sub).toBe("Daily goals, feats and a ladder.");
    expect(page.today?.resets).toMatch(/^resets \w{3} \d\d:\d\d · in \d+ h \d+ m$/);
    expect(page.today?.pve.length).toBeGreaterThan(0);
    expect(page.board.columns.length).toBeGreaterThan(0);
    const ada = page.board.rows.find((r) => r.name === "Ada");
    expect(ada?.you).toBe(true);
    expect(ada?.cells?.length).toBe(page.board.columns.length);
    expect(page.board.rows.find((r) => r.name === "Bob")?.dim).toBe(true);
    expect(page.firstDay).toBe(true);
    expect(page.soFar.empty).toBe(true);
  });

  it("renders the ladder, PvP details and feats (WEB-60)", () => {
    const snapshot = doomsdaySnapshot({
      ...input,
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
    });
    const ladder = ladderView(snapshot, "week", "Ada#1001", "Europe/Paris");
    expect(ladder.resets).toMatch(/^week resets Sunday 19:00 · in /);
    expect(pvpView(snapshot, undefined, "Ada#1001").name).toBe("Ada");
    const feats = featsView(snapshot, undefined, "Ada#1001", "Europe/Paris");
    const group = feats.group as FeatView[];
    expect(group.map((f) => [f.icon, f.title])).toEqual([
      ["epic", { before: "First epic: ", epic: "Robes of the Exalted" }],
      ["rank", { before: "Stone Guard, a.k.a. Mailbox Menace" }],
    ]);
    expect(group[1]?.rank).toBe(6);
    expect(feats.ownCount).toBe(2);
  });
});
