"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { MAX_LEVEL } from "@/core/gamedata";
import { capitalize } from "@/core/views/text";
import type { MapMarker } from "@/core/views/mapMarkers";
import { ClassDisc } from "@/components/ui/ClassDisc";
import { classStyle } from "./Markers";
import styles from "./CharacterSheet.module.css";

export interface CharacterSheetProps {
  marker: MapMarker;
  /** The next character in the same zone (newest first, wrapping); none when it is alone there. */
  next?: MapMarker;
  onNext: (guid: string) => void;
  onClose: () => void;
}

const share = (part: number, whole: number) => ({ "--share": Math.min(Math.max(part / whole, 0), 1) }) as CSSProperties;

/**
 * The tapped character in the phone's half sheet (WEB-28, phone-character board): level, seen, player, item level,
 * role, spec, talents and professions, "Open character" and the next character in the zone. Missing values show "—".
 */
export function CharacterSheet({ marker: m, next, onNext, onClose }: CharacterSheetProps) {
  const title = m.name ?? "Unknown character";
  const who = [m.level === undefined ? undefined : `Level ${m.level}`, m.raceName, m.className]
    .filter(Boolean)
    .join(" ");
  const sub = [who || undefined, m.faction].filter(Boolean).join(" · ");
  const facts: [string, string][] = [
    ["Player", m.ownerName ?? "—"],
    ["Item level", m.ilvl === undefined ? "—" : String(m.ilvl)],
    ["Role", m.role ?? "—"],
    ["Spec", m.spec ?? "—"],
    ["Talents", m.talents ?? "—"],
  ];
  return (
    <section
      className={styles.sheet}
      data-sheet-scroll=""
      aria-labelledby="character-sheet-name"
      style={classStyle(m.classFile)}
    >
      <div className={styles.head}>
        <ClassDisc name={m.name} classFile={m.classFile} size="sheet" live={m.age === "live"} />
        <div className={styles.titles}>
          <h2 id="character-sheet-name" className={styles.name} data-known={m.classFile !== undefined || undefined}>
            {title}
          </h2>
          {sub !== "" && <p className={styles.sub}>{sub}</p>}
        </div>
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
          <svg aria-hidden="true" viewBox="0 0 14 14" className={styles.cross}>
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>
      {m.level !== undefined && (
        <div className={styles.level}>
          <div className={styles.levelText}>
            <span>Level {m.level}</span>
            <span>{m.levelsToMax === 0 ? "Max level" : `${m.levelsToMax} to go`}</span>
          </div>
          <span aria-hidden="true" className={styles.track} style={share(m.level, MAX_LEVEL)}>
            <span className={styles.levelFill} />
          </span>
        </div>
      )}
      <dl className={styles.facts}>
        <div>
          <dt>Seen</dt>
          <dd>
            {capitalize(m.seenAgo)}
            {m.age === "live" && <span className={styles.fresh} aria-label="new" role="img" />}
            {m.viaName !== undefined && <span className={styles.via}> · via {m.viaName}</span>}
          </dd>
        </div>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {m.professions !== undefined && (
        <ul className={styles.professions} aria-label="Professions">
          {m.professions.map((p) => (
            <li key={p.name} className={styles.profession}>
              <span>{p.name}</span>
              <span
                aria-hidden="true"
                className={styles.track}
                data-primary={p.primary || undefined}
                style={share(p.rank, p.max ?? p.rank)}
              >
                <span className={styles.skillFill} />
              </span>
              <span className={styles.rank}>{p.max === undefined ? p.rank : `${p.rank} / ${p.max}`}</span>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        {m.name !== undefined && (
          <Link href={`/character/${encodeURIComponent(m.guid)}`} className={styles.open}>
            Open character
          </Link>
        )}
        {next !== undefined && (
          <button type="button" className={styles.next} onClick={() => onNext(next.guid)}>
            <span className={styles.nextName}>{next.name ?? "Unknown character"}</span>
            <span className={styles.nextAge}> · {next.seenShort} →</span>
          </button>
        )}
      </div>
    </section>
  );
}
