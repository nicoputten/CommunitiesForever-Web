import { MAX_LEVEL } from "../gamedata";
import type { CharacterView } from "./characters";
import type { DungeonBand, LevelSpread } from "./roster";

// Where things sit on the level spread's 1–60 track (roster-cards board), computed on the server so the track needs
// no script and does not shift: dungeon bands in as many rows as they need (the best band first, decided with Nico for
// WEB-21, 2026-10-26), and the dots, where characters close together merge (WEB-32).

/** 0 at level 1, 1 at level 60. */
export function levelPosition(level: number): number {
  return Math.min(1, Math.max(0, (level - 1) / (MAX_LEVEL - 1)));
}

/** Characters at most this many levels apart share one dot with a count (board `roster-cards-runs`, WEB-32). */
export const MERGE_LEVELS = 2;
/**
 * On a phone (no board): 5 levels are 24 px on the 375 px layout's track, the least space between two touch targets
 * (WCAG 2.5.8, axe `target-size`). Decided with Nico, 2026-10-27.
 */
export const MERGE_LEVELS_PHONE = 4;

export interface SpreadDot {
  /** Lowest level first; one, or several that merge. */
  characters: CharacterView[];
  /** The middle of the lowest and highest level: where the dot sits. */
  level: number;
  /** Track position (0–1). */
  position: number;
  /** One of the viewer's own characters is in it (the gold ring). */
  own: boolean;
}

/**
 * The dots on the track (WEB-32): characters merge into one dot while each is at most `merge` levels above the one
 * before (37, 39 and 41 make one dot "around level 39"). `own` is the viewer's person key.
 */
export function spreadDots(
  characters: readonly CharacterView[],
  own?: string,
  merge: number = MERGE_LEVELS,
): SpreadDot[] {
  const levelled = characters.filter((c) => c.level !== undefined);
  const groups: CharacterView[][] = [];
  for (const c of levelled) {
    const last = groups.at(-1);
    const prev = last?.at(-1);
    if (last !== undefined && prev !== undefined && c.level! - prev.level! <= merge) last.push(c);
    else groups.push([c]);
  }
  return groups.map((group) => {
    const level = (group[0]!.level! + group.at(-1)!.level!) / 2;
    return {
      characters: group,
      level,
      position: levelPosition(level),
      own: own !== undefined && group.some((c) => c.owner === own),
    };
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

/** At most this many rows of bands until "Show all N" (WEB-45, board `runs-v2-plan` "Roster bands v2"). */
export const BAND_ROWS = 4;

export interface BandLayout {
  /** The bands placed, top to bottom and left to right (the list's reading order). */
  shown: PlacedBand[];
  /** Bands that found no place in the rows allowed: shown after "Show all N". */
  hidden: number;
}

const fitsFirst = (a: DungeonBand, b: DungeonBand) =>
  b.fits.length - a.fits.length ||
  a.dungeon.typicalLevels.max -
    a.dungeon.typicalLevels.min -
    (b.dungeon.typicalLevels.max - b.dungeon.typicalLevels.min) ||
  a.dungeon.typicalLevels.min - b.dungeon.typicalLevels.min;

/**
 * The bands in rows (WEB-45): sorted by how many fit (ties: the narrower range, then the lower), each in the first row
 * where it doesn't overlap a band (levels are inclusive: 17–26 and 26–45 overlap). With `maxRows`, a band that needs a
 * row beyond it is left out and counted in `hidden`.
 */
export function bandLayout(spread: Pick<LevelSpread, "bands" | "best">, maxRows = Infinity): BandLayout {
  const rows: DungeonBand[][] = [];
  const shown: PlacedBand[] = [];
  let hidden = 0;
  for (const band of [...spread.bands].sort(fitsFirst)) {
    const { min, max } = band.dungeon.typicalLevels;
    let row = rows.findIndex((r) =>
      r.every((o) => max < o.dungeon.typicalLevels.min || min > o.dungeon.typicalLevels.max),
    );
    if (row === -1) {
      if (rows.length >= maxRows) {
        hidden++;
        continue;
      }
      row = rows.length;
      rows.push([]);
    }
    rows[row]!.push(band);
    shown.push({ band, best: band === spread.best, row, from: levelPosition(min), to: levelPosition(max) });
  }
  return { shown: shown.sort((a, b) => a.row - b.row || a.from - b.from), hidden };
}
