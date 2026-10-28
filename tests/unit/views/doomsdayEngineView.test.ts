import { describe, expect, it } from "vitest";
import { doomsdaySnapshot, type DoomsdayInput } from "@/core/doomsday/engine";
import { doomsdayPage } from "@/core/views/doomsday";

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
    expect(page.header.sub).toMatch(/^Daily goals at 19:00,/);
    expect(page.today?.resets).toMatch(/^resets in \d+ h \d+ m$/);
    expect(page.today?.pve.length).toBeGreaterThan(0);
    expect(page.board.columns.length).toBeGreaterThan(0);
    const ada = page.board.rows.find((r) => r.name === "Ada");
    expect(ada?.you).toBe(true);
    expect(ada?.cells?.length).toBe(page.board.columns.length);
    expect(page.board.rows.find((r) => r.name === "Bob")?.dim).toBe(true);
    expect(page.firstDay).toBe(true);
  });
});
