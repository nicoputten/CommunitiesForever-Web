import { MAX_LEVEL } from "../gamedata";
import type { CharacterView } from "./characters";
import type { DungeonBand, LevelSpread } from "./roster";

// Where things sit on the level spread's 1–60 track (roster-cards board), computed on the server so the track needs
// no script and does not shift: the dots, where characters close together merge (WEB-32, capped in WEB-87), and which
// dungeon bands show before "Show all" (the 4 rows of WEB-45; the list itself is by level, WEB-87).

/** 0 at level 1, 1 at level 60. */
export function levelPosition(level: number): number {
  return Math.min(1, Math.max(0, (level - 1) / (MAX_LEVEL - 1)));
}

/**
 * How characters merge into dots on the track (WEB-32, capped in WEB-87). A character joins the dot before it while it
 * is at most `merge` levels above the dot's highest level and at most `span` levels above its lowest. With `gap`, a dot
 * whose middle would sit less than `gap` levels from the dot before joins that dot instead (then `span` gives way), so
 * neighbouring touch targets keep their distance.
 */
export interface DotRule {
  merge: number;
  span: number;
  gap?: number;
}

/**
 * Desktop (board `roster-cards-runs`, WEB-32): characters within 2 levels merge; one dot covers at most 3 levels
 * (Nico, 2026-11-06, WEB-87: 7–9, never 1–16).
 */
export const DOT_RULE: DotRule = { merge: 2, span: 2 };
/**
 * On a phone (no board): 5 levels are 24 px on the 375 px layout's track, the least space between two touch targets
 * (WCAG 2.5.8, axe `target-size`; decided with Nico, 2026-10-27). So characters within 4 levels merge, one dot covers
 * at most 5 levels (WEB-87), and dots keep 5 levels between their middles.
 */
export const DOT_RULE_PHONE: DotRule = { merge: 4, span: 4, gap: 5 };

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

const middle = (group: readonly CharacterView[]) => (group[0]!.level! + group.at(-1)!.level!) / 2;

/**
 * The dots on the track (WEB-32, WEB-87): characters close together merge into one dot (37, 39 and 41 make two dots on
 * desktop, 37–39 and 41; one dot "around level 39" on a phone). `own` is the viewer's person key. Characters come
 * lowest level first.
 */
export function spreadDots(characters: readonly CharacterView[], own?: string, rule: DotRule = DOT_RULE): SpreadDot[] {
  const levelled = characters.filter((c) => c.level !== undefined);
  const groups: CharacterView[][] = [];
  for (const c of levelled) {
    const last = groups.at(-1);
    if (last !== undefined && c.level! - last.at(-1)!.level! <= rule.merge && c.level! - last[0]!.level! <= rule.span)
      last.push(c);
    else groups.push([c]);
  }
  // Too close to the dot before: join it. A merged dot's middle only moves away from the dots on either side.
  const spaced: CharacterView[][] = [];
  for (const group of groups) {
    const prev = spaced.at(-1);
    if (prev !== undefined && rule.gap !== undefined && middle(group) - middle(prev) < rule.gap) prev.push(...group);
    else spaced.push(group);
  }
  return spaced.map((group) => {
    const level = middle(group);
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

/** The dungeon list's order (WEB-87, Nico 2026-11-06): lowest level first, by min, then max, then name. */
export function bandsByLevel(a: DungeonBand, b: DungeonBand): number {
  const [x, y] = [a.dungeon.typicalLevels, b.dungeon.typicalLevels];
  return x.min - y.min || x.max - y.max || a.dungeon.name.localeCompare(b.dungeon.name, "en");
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
