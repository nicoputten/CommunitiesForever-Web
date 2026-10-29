import type { CSSProperties } from "react";
import { InfoTip } from "@/components/ui/InfoTip";
import { classInfo } from "@/core/gamedata";
import type { CharacterView } from "@/core/views/characters";
import type { DungeonBand, LevelSpread as Spread } from "@/core/views/roster";
import type { RosterRuns } from "@/core/views/runs";
import { joinNames } from "@/core/views/text";
import {
  BAND_ROWS,
  bandLayout,
  levelPosition,
  MERGE_LEVELS,
  MERGE_LEVELS_PHONE,
  spreadDots,
  type BandLayout,
} from "@/core/views/spreadLayout";
import styles from "./LevelSpread.module.css";
import { DungeonBands, type BandView } from "./DungeonBands";
import { SpreadTrack, type TrackDot } from "./SpreadTrack";

const TICKS = [1, 10, 20, 30, 40, 50, 60];

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

const classVar = (c: CharacterView, text: boolean) => {
  const info = classInfo(c.classFile);
  return info === undefined ? "var(--text-muted)" : `var(${text ? info.textToken : info.colorToken})`;
};

/** A merged dot's fill: equal slices of each character's class colour, lowest level first. */
function slices(characters: readonly CharacterView[]): string {
  const share = 100 / characters.length;
  const stops = characters.map((c, i) => `${classVar(c, false)} 0 ${(share * (i + 1)).toFixed(2)}%`);
  return `conic-gradient(${stops.join(", ")})`;
}

/**
 * "Who is around which level" (board `roster-cards-runs`, without its run parts): every character as a dot on a 1–60
 * track, names in a tooltip; characters within two levels (four on a phone) merge into a dot with a count (WEB-32).
 * Then the dungeon
 * bands, which count who fits and never name them. `own`: the viewer's person key (the gold ring).
 */
export function LevelSpread({
  spread,
  own,
  runs = {},
}: {
  spread: Spread;
  own?: string | undefined;
  /** WEB-45: each dungeon's upcoming runs, for its band. */
  runs?: RosterRuns["byDungeon"];
}) {
  const dots = (merge: number): TrackDot[] =>
    spreadDots(spread.characters, own, merge).map((d) => {
      const one = d.characters.length === 1 ? d.characters[0] : undefined;
      const dot: TrackDot = {
        key: d.characters[0]!.guid,
        position: pct(d.position),
        label:
          one === undefined
            ? `${d.characters.length} characters around level ${Math.round(d.level)}`
            : `${one.name ?? "Unknown"} ${one.level}`,
        own: d.own,
        fill: one === undefined ? slices(d.characters) : classVar(one, false),
        lines: d.characters.map((c) => {
          const line: TrackDot["lines"][number] = {
            name: c.name ?? "Unknown",
            level: c.level!,
            color: classVar(c, true),
          };
          const owner = own !== undefined && c.owner === own ? "you" : c.ownerName;
          if (owner !== undefined) line.owner = owner;
          return line;
        }),
      };
      if (one === undefined) dot.count = d.characters.length;
      return dot;
    });
  // At most 4 rows, the rest after "Show all" (WEB-45); both layouts so the switch needs no server.
  const limited = bandLayout(spread, BAND_ROWS);
  const all = bandLayout(spread);
  const rowIn = (layout: BandLayout, band: DungeonBand) => layout.shown.find((p) => p.band === band)?.row;
  const bands: BandView[] = all.shown.map((placed) => {
    const b = placed.band;
    const { min, max } = b.dungeon.typicalLevels;
    const planned = runs[b.dungeon.id] ?? { runs: [], more: 0 };
    const row = rowIn(limited, b);
    return {
      id: b.dungeon.id,
      name: b.dungeon.name,
      range: `${min}–${max}`,
      fits: b.fits.length,
      ...(b.missing.length === 0 ? {} : { missing: `no ${joinNames([...b.missing])} in range` }),
      runs: planned.runs,
      moreRuns: planned.more,
      best: placed.best,
      extra: row === undefined,
      order: b === spread.best ? -1 : spread.bands.indexOf(b),
      right: placed.from > 0.5,
    };
  });

  return (
    <section className={styles.spread} aria-labelledby="level-spread">
      <div className={styles.head}>
        <h2 id="level-spread" className={styles.title}>
          Who is around which level
        </h2>
        <InfoTip>
          Hover or tap a dot for names. A gold ring marks your characters. Click a dungeon to plan a run.
        </InfoTip>
      </div>

      {/* One track per layout: a phone merges more (MERGE_LEVELS_PHONE); CSS shows one. */}
      <SpreadTrack dots={dots(MERGE_LEVELS)} layout="wide" />
      <SpreadTrack dots={dots(MERGE_LEVELS_PHONE)} layout="phone" />

      <div aria-hidden="true" className={styles.ticks}>
        {TICKS.map((t) => (
          <span key={t} style={{ "--pos": pct(levelPosition(t)) } as CSSProperties} data-end={t === 60 || undefined}>
            {t}
          </span>
        ))}
      </div>

      {bands.length > 0 && <DungeonBands bands={bands} />}
    </section>
  );
}
