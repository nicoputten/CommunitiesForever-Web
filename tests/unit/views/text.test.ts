import { describe, expect, it } from "vitest";
import { D, H } from "./sample";
import { capitalize, initials, timeAgo } from "@/core/views";

const NOW = 10_000_000;

describe("timeAgo", () => {
  it.each([
    [0, "just now"],
    [59, "just now"],
    [60, "1 min ago"],
    [H - 1, "59 min ago"],
    [H, "1 h ago"],
    [D - 1, "23 h ago"],
    [D, "yesterday"],
    [2 * D - 1, "yesterday"],
    [2 * D, "2 days ago"],
    [13 * D, "13 days ago"],
    [14 * D, "2 weeks ago"],
    [59 * D, "8 weeks ago"],
    [60 * D, "2 months ago"],
  ] as const)("%i seconds ago is %s", (age, text) => {
    expect(timeAgo(NOW - age, NOW)).toBe(text);
  });

  it("treats a time in the future as now", () => {
    expect(timeAgo(NOW + 5 * H, NOW)).toBe("just now");
  });
});

describe("initials", () => {
  it.each([
    ["Ves Doombringer", "VD"],
    ["Lia Thornwhisper", "LT"],
    ["Ves  van der Doombringer ", "VD"],
    ["Mira", "M"],
    ["élise ångström", "ÉÅ"],
    ["", "?"],
    [undefined, "?"],
  ] as const)("%s → %s", (name, text) => {
    expect(initials(name)).toBe(text);
  });
});

describe("capitalize", () => {
  it("upper-cases the first letter only", () => {
    expect(capitalize("yesterday")).toBe("Yesterday");
    expect(capitalize("")).toBe("");
  });
});
