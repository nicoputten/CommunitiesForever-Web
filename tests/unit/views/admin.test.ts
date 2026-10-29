import { describe, expect, it } from "vitest";
import { adminCountText, adminView, type AdminInput, logParts, refusedText, seenText } from "@/core/views/admin";

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
    expect(view.members.map((m) => [m.name, m.rank, m.blocked])).toEqual([
      ["Nico", "owner", false],
      ["Bob", undefined, true],
      ["Zed", undefined, false],
    ]);
    expect(view.members[2]?.added).toEqual({ text: "Added by Bob's upload", uploadId: 2, at: 50 });
    expect(view.members[0]?.added).toBeUndefined();
  });

  it("never shows the admin as blocked", () => {
    const view = adminView(input({ members: [{ battleTag: "nico#2201", blocked: true }] }), NOW);
    expect(view.members).toMatchObject([{ rank: "owner", blocked: false }]);
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

describe("co-admins (WEB-64)", () => {
  const text = (e: Parameters<typeof logParts>[0]) =>
    logParts(e, (t) => t.split("#")[0]!)
      .map((p) => (p.strong === true ? `[${p.text}]` : p.text))
      .join("");
  const entry = { id: 1, at: 1, by: "Nico#2201" };

  it("says each kind of change", () => {
    expect(text({ ...entry, action: "adminAppointed", target: "Bob#2002" })).toBe("made [Bob] an admin");
    expect(text({ ...entry, action: "adminRemoved", target: "Bob#2002" })).toBe("removed [Bob] as admin");
    expect(text({ ...entry, action: "blocked", target: "Sela#6620" })).toBe("blocked [Sela#6620]");
    expect(text({ ...entry, action: "guestAdded", target: "Ruk#5150" })).toBe("added guest [Ruk#5150]");
    expect(text({ ...entry, action: "guestChanged", target: "Ruk#5150", detail: "may upload" })).toBe(
      "let guest [Ruk#5150] upload",
    );
    expect(text({ ...entry, action: "runDeleted", target: "Bob#2002", detail: "Wailing Caverns" })).toBe(
      "deleted [Bob's] run [Wailing Caverns]",
    );
    expect(text({ ...entry, action: "discordSetting", detail: "changed the Doomsday reset to 20:00" })).toBe(
      "changed the Doomsday reset to 20:00",
    );
    expect(text({ ...entry, action: "testPost", detail: "a test board" })).toBe("sent a test board");
    expect(text({ ...entry, action: "cutoff" })).toBe("started fresh from launch");
    expect(text({ ...entry, action: "deviceRevoked", target: "BOB-PC", detail: "Bob#2002" })).toBe(
      "revoked uploader [BOB-PC] of Bob",
    );
  });

  it("marks the owner's lines and owner-only changes", () => {
    const view = adminView(
      input({
        log: [
          { ...entry, action: "cutoff" },
          { id: 2, at: 2, by: "Bob#2002", action: "blocked", target: "Sela#6620" },
        ],
      }),
      NOW,
    );
    expect(view.log.map((l) => [l.who, l.byOwner, l.ownerOnly])).toEqual([
      ["Nico", true, true],
      ["Bob", false, false],
    ]);
  });

  it("gives the owner and admins their rank; they can't be blocked", () => {
    const view = adminView(
      input({
        admins: [{ battleTag: "Bob#2002", addedBy: "Nico#2201", addedAt: 50 }],
        members: [
          { battleTag: "Nico#2201", blocked: false },
          { battleTag: "Bob#2002", blocked: true },
          { battleTag: "Zed#1", blocked: false },
        ],
        lastSeen: new Map([
          ["bob#2002", NOW - 60],
          ["zed#1", NOW - 3600],
        ]),
      }),
      NOW,
    );
    expect(view.members.map((m) => [m.name, m.rank, m.blocked])).toEqual([
      ["Nico", "owner", false],
      ["Bob", "admin", false],
      ["Zed", undefined, false],
    ]);
    expect(view.admins.map((a) => [a.name, a.rank, a.online, a.line, a.since])).toEqual([
      ["Nico", "owner", false, "Set on the server", undefined],
      ["Bob", "admin", true, undefined, { at: 50, by: "Nico" }],
      ["Zed", undefined, false, "Member", undefined],
    ]);
    expect(view.ownerName).toBe("Nico");
  });

  it("counts and refusals", () => {
    expect(adminCountText(0)).toBe("1 owner");
    expect(adminCountText(2)).toBe("1 owner · 2 admins");
    expect(refusedText("owner-only", undefined)).toBe("Only the owner can do this. Nothing was changed.");
    expect(refusedText("cant-block", "Bob")).toBe("Admins and the owner can't be blocked. Remove Bob as admin first.");
    expect(refusedText("nonsense", undefined)).toBeUndefined();
  });
});
