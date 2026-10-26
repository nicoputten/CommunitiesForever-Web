import Link from "next/link";
import type { CSSProperties } from "react";
import { classInfo, MAX_LEVEL } from "@/core/gamedata";
import { dataAge, timeAgo } from "@/core/views/age";
import type { CharacterView } from "@/core/views/characters";
import { ROLE_NAMES } from "@/core/views/rosterQuery";
import { capitalize } from "@/core/views/text";
import { ClassDisc } from "@/components/ui/ClassDisc";
import { FactionTag } from "@/components/ui/FactionTag";
import styles from "./CharacterRow.module.css";

/** Professions shown on a row (roster-cards board: up to three). */
const TOP_PROFESSIONS = 3;

/** The character's page (WEB-23). */
export function characterHref(guid: string): string {
  return `/character/${encodeURIComponent(guid)}`;
}

export interface CharacterRowProps {
  character: CharacterView;
  now: number;
  /** The friend's data is 7+ days old: the row is dimmed (board: Jorrit). */
  old?: boolean;
}

/** One character on the roster (roster-cards board): disc, name and details, professions, last played and place. */
export function CharacterRow({ character: c, now, old = false }: CharacterRowProps) {
  const info = classInfo(c.classFile);
  const style =
    info === undefined
      ? undefined
      : ({ "--class": `var(${info.colorToken})`, "--class-text": `var(${info.textToken})` } as CSSProperties);
  const what = [[c.raceName, c.className].filter((p) => p !== undefined).join(" "), c.mainTreeName]
    .concat(c.role === undefined ? [] : [ROLE_NAMES[c.role]])
    .filter((p) => p !== undefined && p !== "");
  const professions = c.professions.slice(0, TOP_PROFESSIONS);
  const played = c.lastPlayed === undefined ? "—" : capitalize(timeAgo(c.lastPlayed, now));
  const level = c.level === undefined ? 0 : Math.min(c.level, MAX_LEVEL) / MAX_LEVEL;
  return (
    <Link href={characterHref(c.guid)} className={styles.row} style={style} data-old={old || undefined}>
      <span className={styles.lead}>
        <ClassDisc
          name={c.name}
          classFile={c.classFile}
          level={c.level}
          live={c.lastPlayed !== undefined && dataAge(c.lastPlayed, now) === "live"}
        />
      </span>
      <span className={styles.main}>
        <span className={styles.name}>{c.name}</span>
        <span className={styles.sub}>
          {what.join(" · ")}
          {c.faction !== undefined && <FactionTag faction={c.faction} />}
        </span>
        <span
          aria-hidden="true"
          className={styles.bar}
          data-max={c.level === MAX_LEVEL || undefined}
          style={{ "--level": level } as CSSProperties}
        />
      </span>
      <span className={styles.professions}>
        {professions.length === 0 ? (
          <span className={styles.none}>No professions</span>
        ) : (
          professions.map((p) => (
            <span key={p.skillLine} className={styles.profession}>
              <b>{p.name}</b> {p.rank}
            </span>
          ))
        )}
      </span>
      <span className={styles.seen}>
        <span className={styles.played}>{played}</span>
        <span className={styles.place}>{c.sighting?.zoneText ?? "Location unknown"}</span>
        <span className={styles.place}>ilvl {c.ilvl ?? "—"}</span>
      </span>
    </Link>
  );
}
