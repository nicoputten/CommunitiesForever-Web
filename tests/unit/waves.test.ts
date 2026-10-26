import { describe, expect, it } from "vitest";
import { WAVE_TILE, wavePath } from "@/core/map/waves";

describe("wavePath", () => {
  it("is the same on every call (server and client render match)", () => {
    expect(wavePath(0)).toBe(wavePath(0));
    expect(wavePath(1, 40)).toBe(wavePath(1, 40));
  });

  it("draws one curl per grid cell, inside the 1440 × 900 world", () => {
    const curls = wavePath(0).match(/M[\d.]+ [\d.-]+/g) ?? [];
    // rows from 70 every 34 below 900, columns from 10 every 56 below 1440 (map board)
    expect(curls).toHaveLength(25 * 26);
    for (const c of curls) {
      const [x, y] = c.slice(1).split(" ").map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1440);
      expect(y).toBeLessThan(900);
    }
  });

  it("tiles seamlessly for the endless map sea: the grid runs on across tile edges", () => {
    const rows = (group: 0 | 1) => Math.ceil((WAVE_TILE.height - WAVE_TILE.top - group * 17) / 34);
    const cols = (group: 0 | 1) => Math.ceil((WAVE_TILE.width - 10 - group * 28) / 56);
    for (const group of [0, 1] as const) {
      // A whole number of cells per tile in both directions, so the next tile's first row/column is one step on.
      expect(rows(group) * 34).toBe(WAVE_TILE.height);
      expect(cols(group) * 56).toBe(WAVE_TILE.width);
      const curls = wavePath(group, WAVE_TILE.top, WAVE_TILE.width, WAVE_TILE.height).match(/M/g) ?? [];
      expect(curls).toHaveLength(rows(group) * cols(group));
    }
  });

  it("offsets group 1 from group 0 and starts the sign-in waves higher", () => {
    expect(wavePath(1)).not.toBe(wavePath(0));
    expect(wavePath(0, 40).startsWith("M")).toBe(true);
    expect(wavePath(0, 40)).not.toBe(wavePath(0));
  });
});
