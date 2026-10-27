import type { CSSProperties } from "react";
import { classInfo } from "@/core/gamedata";
import type { CharacterView } from "@/core/views/characters";
import type { LevelSpread as Spread } from "@/core/views/roster";
import { bandRows, levelPosition, MERGE_LEVELS, MERGE_LEVELS_PHONE, spreadDots } from "@/core/views/spreadLayout";
import styles from "./LevelSpread.module.css";
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
export function LevelSpread({ spread, own }: { spread: Spread; own?: string | undefined }) {
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
  const bands = bandRows(spread);
  const bandRowCount = Math.max(0, ...bands.map((b) => b.row + 1));

  return (
    <section className={styles.spread} aria-labelledby="level-spread">
      <div className={styles.head}>
        <h2 id="level-spread" className={styles.title}>
          Who is around which level
        </h2>
        <span className={styles.hint}>
          Hover or tap a dot for names · gold ring: your characters · bands show typical levels
        </span>
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

      {bands.length > 0 && (
        <ul
          className={styles.bands}
          aria-label="Dungeon bands"
          style={{ "--band-rows": bandRowCount } as CSSProperties}
        >
          {bands.map((b) => {
            const { min, max } = b.band.dungeon.typicalLevels;
            return (
              <li
                key={b.band.dungeon.id}
                className={styles.band}
                title={b.band.dungeon.shortName === b.band.dungeon.name ? undefined : b.band.dungeon.name}
                data-best={b.best || undefined}
                style={
                  {
                    "--from": pct(b.from),
                    "--to": pct(b.to),
                    "--row": b.row,
                    "--order": b.best ? -1 : spread.bands.indexOf(b.band),
                  } as CSSProperties
                }
              >
                {b.band.dungeon.shortName} {min}–{max} · {b.band.fits.length} fit
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
