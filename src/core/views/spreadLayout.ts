import { MAX_LEVEL } from "../gamedata";
import type { DungeonBand, LevelSpread } from "./roster";

// Where things sit on the level spread's 1–60 track (roster-cards board), computed on the server so the track needs
// no script and does not shift: dungeon bands in as many rows as they need (the best band first), and character
// names in label rows, per track width (decided with Nico for WEB-21, 2026-10-26).

/** 0 at level 1, 1 at level 60. */
export function levelPosition(level: number): number {
  return Math.min(1, Math.max(0, (level - 1) / (MAX_LEVEL - 1)));
}

/** Rough width of a name label: Inter at 11 px averages under 6.4 px a character; plus the gap between labels. */
export const LABEL_CHAR_PX = 6.4;
export const LABEL_GAP_PX = 10;

export type LabelAlign = "center" | "start" | "end";

export interface LabelPlace {
  row: number;
  /** Labels near the ends of the track align to the end instead of overflowing it. */
  align: LabelAlign;
}

/**
 * Label rows for names at track positions (0–1), for a track `width` px wide: each label goes into the first row
 * where it does not overlap a label already there. Labels are placed in the order given (lowest level first).
 */
export function labelRows(labels: readonly { position: number; text: string }[], width: number): LabelPlace[] {
  const rows: [number, number][][] = [];
  return labels.map(({ position, text }) => {
    const w = Array.from(text).length * LABEL_CHAR_PX;
    const x = position * width;
    let align: LabelAlign = "center";
    let left = x - w / 2;
    if (left < 0) {
      align = "start";
      left = x;
    } else if (x + w / 2 > width) {
      align = "end";
      left = x - w;
    }
    const span: [number, number] = [left - LABEL_GAP_PX / 2, left + w + LABEL_GAP_PX / 2];
    let row = rows.findIndex((r) => r.every(([a, b]) => span[1] <= a || span[0] >= b));
    if (row === -1) {
      row = rows.length;
      rows.push([]);
    }
    rows[row]!.push(span);
    return { row, align };
  });
}

export interface PlacedBand {
  band: DungeonBand;
  best: boolean;
  row: number;
  /** Track positions of the band's ends. */
  from: number;
  to: number;
}

/**
 * The bands in rows: the best band first in row 0, then the others by level, each in the first row where it does not
 * overlap a band (levels are inclusive: 17–26 and 26–45 overlap).
 */
export function bandRows(spread: Pick<LevelSpread, "bands" | "best">): PlacedBand[] {
  const best = spread.best;
  const ordered = best === undefined ? spread.bands : [best, ...spread.bands.filter((b) => b !== best)];
  const rows: DungeonBand[][] = [];
  const placed = ordered.map((band) => {
    const { min, max } = band.dungeon.typicalLevels;
    let row = rows.findIndex((r) =>
      r.every((o) => max < o.dungeon.typicalLevels.min || min > o.dungeon.typicalLevels.max),
    );
    if (row === -1) {
      row = rows.length;
      rows.push([]);
    }
    rows[row]!.push(band);
    return { band, best: band === best, row, from: levelPosition(min), to: levelPosition(max) };
  });
  // Top to bottom, left to right: the reading order of the list for screen readers.
  return placed.sort((a, b) => a.row - b.row || a.from - b.from);
}
