import type { CSSProperties } from "react";
import { classInfo } from "@/core/gamedata";
import type { LevelSpread as Spread } from "@/core/views/roster";
import { bandRows, labelRows, levelPosition } from "@/core/views/spreadLayout";
import styles from "./LevelSpread.module.css";

// Track widths the label rows are computed for (decided with Nico for WEB-21): the content width of the level spread
// at the narrowest viewport of each layout (page 1280 + gutters 48, section padding 40, track margin 20). Phone
// shows the dots only and lists the names under the track.
const TRACKS = [
  { key: "wide", width: 1220 }, // ≥ 1328 px
  { key: "mid", width: 916 }, // 1024–1327 px
  { key: "narrow", width: 660 }, // 768–1023 px
] as const;

const TICKS = [1, 10, 20, 30, 40, 50, 60];

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

/** "Who is around which level" (roster-cards board): every character on a 1–60 track, with the dungeon bands. */
export function LevelSpread({ spread }: { spread: Spread }) {
  const chars = spread.characters.filter((c) => c.level !== undefined);
  const labels = chars.map((c) => ({ position: levelPosition(c.level!), text: c.name ?? "" }));
  const places = TRACKS.map((t) => labelRows(labels, t.width));
  const rows = Object.fromEntries(
    TRACKS.map((t, i) => [`--rows-${t.key}`, Math.max(1, ...places[i]!.map((p) => p.row + 1))]),
  );
  const bands = bandRows(spread);
  const bandRowCount = Math.max(0, ...bands.map((b) => b.row + 1));

  return (
    <section className={styles.spread} aria-labelledby="level-spread">
      <div className={styles.head}>
        <h2 id="level-spread" className={styles.title}>
          Who is around which level
        </h2>
        <span className={styles.hint}>Dungeon bands are typical level ranges</span>
      </div>

      <div aria-hidden="true" className={styles.track} style={rows as CSSProperties}>
        {chars.map((c, i) => {
          const info = classInfo(c.classFile);
          const style = {
            "--pos": pct(labels[i]!.position),
            "--class": info === undefined ? "var(--text-muted)" : `var(${info.colorToken})`,
            "--class-text": info === undefined ? "var(--text-muted)" : `var(${info.textToken})`,
            ...Object.fromEntries(TRACKS.map((t, j) => [`--row-${t.key}`, places[j]![i]!.row])),
          } as CSSProperties;
          const align = Object.fromEntries(TRACKS.map((t, j) => [`data-${t.key}`, places[j]![i]!.align]));
          return (
            <span key={c.guid} className={styles.mark} style={style}>
              <span className={styles.label} {...align}>
                {c.name}
              </span>
              <span className={styles.dot} />
            </span>
          );
        })}
        <span className={styles.line} />
      </div>

      <div aria-hidden="true" className={styles.ticks}>
        {TICKS.map((t) => (
          <span key={t} style={{ "--pos": pct(levelPosition(t)) } as CSSProperties} data-end={t === 60 || undefined}>
            {t}
          </span>
        ))}
      </div>

      {/* The names in level order: under the track on phone, for screen readers everywhere. */}
      <ul className={styles.names}>
        {chars.map((c) => {
          const info = classInfo(c.classFile);
          return (
            <li
              key={c.guid}
              style={
                { "--class-text": info === undefined ? "var(--text-muted)" : `var(${info.textToken})` } as CSSProperties
              }
            >
              <span className={styles.lvl}>
                {c.level}
                <span className="visually-hidden">:</span>
              </span>{" "}
              <span className={styles.nameText}>{c.name}</span>
            </li>
          );
        })}
      </ul>

      {bands.length > 0 && (
        <ul
          className={styles.bands}
          aria-label="Dungeon bands"
          style={{ "--band-rows": bandRowCount } as CSSProperties}
        >
          {bands.map((b) => {
            const { min, max } = b.band.dungeon.typicalLevels;
            const fits = b.band.fits.map((c) => c.name).join(", ");
            return (
              <li
                key={b.band.dungeon.id}
                className={styles.band}
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
                {b.band.dungeon.name} {min}–{max}
                {b.best ? ` · fits ${fits}` : <span className={styles.count}> · {b.band.fits.length} fit</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
