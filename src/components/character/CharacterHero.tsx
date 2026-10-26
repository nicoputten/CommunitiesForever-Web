import type { CSSProperties } from "react";
import { MAX_LEVEL } from "@/core/gamedata";
import { dataAge, timeAgo } from "@/core/views/age";
import type { CharacterPage } from "@/core/views/character";
import { initials } from "@/core/views/text";
import { dataAgeText, dataAgeTone, type DataAgeTone } from "@/components/ui/DataAgeBadge";
import { classColours } from "./classStyle";
import styles from "./CharacterHero.module.css";

/** "A", "A and B", "A, B and C". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Last played: green when new, amber at 7 days (DESIGN.md §4). */
function playedTone(at: number, now: number): DataAgeTone {
  const age = dataAge(at, now);
  return age === "live" ? "fresh" : age === "week" ? "stale" : "neutral";
}

/** The character board's hero: class disc, name, what it is, who plays it, how fresh, and the level block. */
export function CharacterHero({ page, now }: { page: CharacterPage; now: number }) {
  const { character: c, person, levelsToMax, dungeonFit } = page;
  const level = c.level === undefined ? 0 : Math.min(c.level, MAX_LEVEL) / MAX_LEVEL;
  const disc = [c.className ?? "Unknown class", c.level === undefined ? undefined : `level ${c.level}`];
  return (
    <section
      className={styles.hero}
      style={classColours(c.classFile)}
      data-class={c.classFile?.toLowerCase()}
      aria-labelledby="character-name"
    >
      <span className={styles.disc} role="img" aria-label={disc.filter((p) => p !== undefined).join(", ")}>
        <span aria-hidden="true">{initials(c.name)}</span>
        {c.level !== undefined && (
          <span aria-hidden="true" className={styles.level}>
            {c.level}
          </span>
        )}
      </span>

      <div className={styles.text}>
        <h1 id="character-name" className={styles.name}>
          {c.name}
        </h1>
        <p className={styles.line}>
          {c.level !== undefined && `Level ${c.level} `}
          {c.raceName !== undefined && `${c.raceName} `}
          <span className={styles.class}>{c.className ?? "Unknown class"}</span>
          {c.faction !== undefined && (
            <>
              {" · "}
              <span className={styles.faction} data-faction={c.faction.toLowerCase()}>
                {c.faction}
              </span>
            </>
          )}
          {c.ruleset !== undefined && ` · ${c.ruleset}`}
        </p>
        <ul className={styles.pills}>
          {person !== undefined && (
            <li className={styles.pill}>
              Played by <b>{person.displayName}</b>
            </li>
          )}
          {c.lastPlayed !== undefined && (
            <li className={styles.pill} data-tone={playedTone(c.lastPlayed, now)}>
              Last played {timeAgo(c.lastPlayed, now)}
            </li>
          )}
          {person !== undefined && (
            <li className={styles.pill} data-tone={dataAgeTone(person)}>
              {dataAgeText({ ...person, now, showOwn: true })}
            </li>
          )}
        </ul>
      </div>

      {c.level !== undefined && (
        <div className={styles.progress}>
          <p className={styles.levels}>
            <span>Level {c.level}</span>
            <span>{levelsToMax === 0 ? "Max level" : `${levelsToMax} levels to ${MAX_LEVEL}`}</span>
          </p>
          <span
            aria-hidden="true"
            className={styles.bar}
            data-max={levelsToMax === 0 || undefined}
            style={{ "--level": level } as CSSProperties}
          />
          {dungeonFit !== undefined && (
            <p className={styles.fit}>
              {`Fits ${dungeonFit.dungeon.name} (${dungeonFit.dungeon.typicalLevels.min}–${dungeonFit.dungeon.typicalLevels.max}) with `}
              {listNames(dungeonFit.with.map((o) => o.name ?? "someone"))}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
