import { describe, expect, it } from "vitest";
import { adminView, type AdminInput, seenText } from "@/core/views/admin";

const NOW = 100_000;
const input = (over: Partial<AdminInput> = {}): AdminInput => ({
  admin: "Nico#2201",
  members: [],
  guests: [],
  blocks: [],
  names: new Map([
    ["nico#2201", "Nico"],
    ["bob#2002", "Bob"],
  ]),
  lastSeen: new Map(),
  ...over,
});

describe("adminView", () => {
  it("lists the admin first, even before their first upload, then members by name", () => {
    const view = adminView(
      input({
        members: [
          { battleTag: "Zed#1", blocked: false, firstUpload: { id: 2, uploadedAt: 50, uploadedBy: "Bob#2002" } },
          { battleTag: "Bob#2002", blocked: true, firstUpload: { id: 1, uploadedAt: 40, uploadedBy: "Bob#2002" } },
        ],
      }),
      NOW,
    );
    expect(view.members.map((m) => [m.name, m.isAdmin, m.blocked])).toEqual([
      ["Nico", true, false],
      ["Bob", false, true],
      ["Zed", false, false],
    ]);
    expect(view.members[2]?.added).toEqual({ text: "Added by Bob's upload", uploadId: 2, at: 50 });
    expect(view.members[0]?.added).toBeUndefined();
  });

  it("never shows the admin as blocked", () => {
    const view = adminView(input({ members: [{ battleTag: "nico#2201", blocked: true }] }), NOW);
    expect(view.members).toMatchObject([{ isAdmin: true, blocked: false }]);
  });

  it("marks blocked guests and sorts blocks newest first", () => {
    const view = adminView(
      input({
        guests: [
          { battleTag: "Wim#5", mayUpload: true, addedAt: 1, addedBy: "Nico#2201" },
          { battleTag: "Ann#6", mayUpload: false, addedAt: 2, addedBy: "Nico#2201" },
        ],
        blocks: [
          { battleTag: "Wim#5", blockedAt: 10, blockedBy: "Nico#2201" },
          { battleTag: "Bob#2002", blockedAt: 20, blockedBy: "Nico#2201" },
        ],
      }),
      NOW,
    );
    expect(view.guests.map((g) => [g.battleTag, g.blocked, g.added])).toEqual([
      ["Ann#6", false, "Added by Nico"],
      ["Wim#5", true, "Added by Nico"],
    ]);
    expect(view.blocks.map((b) => [b.name, b.blocked])).toEqual([
      ["Bob", "Blocked by Nico"],
      ["Wim", "Blocked by Nico"],
    ]);
  });
});

describe("seenText", () => {
  it("says when someone was last seen", () => {
    expect(seenText(undefined, NOW)).toBe("Not seen yet");
    expect(seenText(NOW - 30, NOW)).toBe("Last seen just now");
    expect(seenText(NOW - 3 * 3600, NOW)).toBe("Last seen 3 h ago");
  });
});
