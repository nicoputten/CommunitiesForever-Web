import { describe, expect, it } from "vitest";
import { cleanGuildName, guildOptions, MAX_CHANNELS, parseGuildReport, type StoredGuildItem } from "@/core/guild";

// WEB-46: the bot's report of its Discord server and the Discord page's dropdowns.

const A = "80351110224678912";
const B = "80351110224678913";
const C = "80351110224678914";

describe("the report", () => {
  it("takes channels and roles as untrusted text", () => {
    expect(
      parseGuildReport({ channels: [{ id: A, name: " general\u0007 " }], roles: [{ id: B, name: "Raiders", x: 1 }] }),
    ).toEqual({ channels: [{ id: A, name: "general" }], roles: [{ id: B, name: "Raiders" }] });
    expect(parseGuildReport({ channels: [], roles: [] })).toEqual({ channels: [], roles: [] });
    expect(cleanGuildName("x".repeat(150))).toHaveLength(100);
    expect(cleanGuildName("<script>")).toBe("<script>");
  });

  it("refuses anything else", () => {
    expect(parseGuildReport(undefined)).toBe("Send { channels, roles }.");
    expect(parseGuildReport({ channels: [] })).toBe("roles must be a list.");
    expect(parseGuildReport({ channels: [{ id: "12", name: "x" }], roles: [] })).toMatch(/snowflake/);
    expect(parseGuildReport({ channels: [{ id: A, name: "\u0000" }], roles: [] })).toMatch(/needs an id/);
    expect(
      parseGuildReport({
        channels: [
          { id: A, name: "a" },
          { id: A, name: "b" },
        ],
        roles: [],
      }),
    ).toMatch(/twice/);
    const many = Array.from({ length: MAX_CHANNELS + 1 }, (_, i) => ({
      id: String(10n ** 17n + BigInt(i)),
      name: "c",
    }));
    expect(parseGuildReport({ channels: many, roles: [] })).toBe("At most 500 channels.");
  });
});

describe("dropdown options", () => {
  const stored: StoredGuildItem[] = [
    { id: A, name: "general", present: true },
    { id: B, name: "runs", present: true },
    { id: C, name: "old-posts", present: false },
  ];

  it("are empty before the bot reported, so the dropdown stays disabled", () => {
    expect(guildOptions("channel", stored, A, false)).toEqual([]);
  });

  it("list the reported ones in the bot's order, after Not set", () => {
    expect(guildOptions("channel", stored, A, true)).toEqual([
      { value: "", label: "Not set" },
      { value: A, label: "# general" },
      { value: B, label: "# runs" },
    ]);
    expect(guildOptions("role", [{ id: A, name: "Raiders", present: true }], null, true).map((o) => o.label)).toEqual([
      "Not set",
      "@Raiders",
    ]);
  });

  it("keep a picked one that's gone, with its last name", () => {
    expect(guildOptions("channel", stored, C, true).at(-1)).toEqual({ value: C, label: "(removed: # old-posts)" });
    expect(guildOptions("channel", stored, "80351110224678999", true).at(-1)?.label).toBe("(removed)");
  });
});
