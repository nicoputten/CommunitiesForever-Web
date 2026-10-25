import { describe, expect, it } from "vitest";
import { cleanName, MAX_DISPLAY_NAME, stripEscapes } from "@/core/sanitize";

describe("stripEscapes", () => {
  it.each([
    ["plain text", "plain text"],
    ["|cffff0000Red|r text", "Red text"],
    ["|cnGREEN_FONT_COLOR:Green|r", "Green"],
    ["|TInterface\\Icons\\INV_Misc_QuestionMark:16|t icon", " icon"],
    ["|A:atlas-name:16:16|a atlas", " atlas"],
    ["|Hitem:2589::::::::|h[Linen Cloth]|h", "[Linen Cloth]"],
    ["|cff1eff00|Hitem:2589|h[Linen Cloth]|h|r", "[Linen Cloth]"],
    ["|Kq1|k", ""],
    ["a || b", "a | b"],
    ["stray | pipe and |z", "stray  pipe and z"],
    ["trailing |", "trailing "],
    ["Café — ok", "Café — ok"],
  ])("%j -> %j", (input, expected) => {
    expect(stripEscapes(input)).toBe(expected);
  });
});

describe("cleanName", () => {
  it("collapses whitespace and trims", () => {
    expect(cleanName("  Ada \t  Lovelace \n")).toBe("Ada Lovelace");
  });

  it("removes escapes", () => {
    expect(cleanName("|cffff0000Ada|r")).toBe("Ada");
  });

  it("caps at 24 characters, counting code points", () => {
    expect(cleanName("x".repeat(30))).toHaveLength(MAX_DISPLAY_NAME);
    expect(Array.from(cleanName("é".repeat(30)) ?? "")).toHaveLength(MAX_DISPLAY_NAME);
    expect(cleanName("a".repeat(23) + " b")).toBe("a".repeat(23));
  });

  it("returns undefined for empty or non-string input", () => {
    expect(cleanName("   ")).toBeUndefined();
    expect(cleanName("|r")).toBeUndefined();
    expect(cleanName(42)).toBeUndefined();
    expect(cleanName(undefined)).toBeUndefined();
  });
});
