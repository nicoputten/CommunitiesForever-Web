"use client";

import Link from "next/link";
import { capitalize } from "@/core/views/text";
import { seenFact, type MapMarker } from "@/core/views/mapMarkers";
import { ClassDisc } from "@/components/ui/ClassDisc";
import { classStyle } from "./Markers";
import styles from "./CharacterCard.module.css";

/**
 * The desktop hover card of a marker (map board): name, level, race, class and spec, then zone, seen, player and item
 * level, and "Open character". A friend without the addon (no record) shows only player, zone and seen.
 */
export function CharacterCard({ marker: m }: { marker: MapMarker }) {
  const title = m.name ?? "Unknown character";
  const who = [m.level === undefined ? undefined : `Level ${m.level}`, m.raceName, m.className]
    .filter(Boolean)
    .join(" ");
  const sub = [who || undefined, m.spec].filter(Boolean).join(" · ");
  const player =
    m.ownerName === undefined ? undefined : m.viaName === undefined ? m.ownerName : `${m.ownerName}, via ${m.viaName}`;
  const zone = m.dungeonName === undefined ? m.zoneName : `${m.dungeonName}, ${m.zoneName}`;
  return (
    <section className={styles.card} aria-label={title} data-testid="character-card">
      <div className={styles.head}>
        <ClassDisc name={m.name} classFile={m.classFile} size="card" />
        <div className={styles.titles}>
          <h2
            className={styles.name}
            style={classStyle(m.classFile)}
            data-known={m.classFile !== undefined || undefined}
          >
            {title}
          </h2>
          {sub !== "" && <p className={styles.sub}>{sub}</p>}
        </div>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Zone</dt>
          <dd>{zone}</dd>
        </div>
        <div>
          <dt>Seen</dt>
          <dd>
            {capitalize(seenFact(m))}
            {m.age === "live" && <span className={styles.fresh} aria-label="new" role="img" />}
          </dd>
        </div>
        {player !== undefined && (
          <div>
            <dt>Player</dt>
            <dd>{player}</dd>
          </div>
        )}
        {m.name !== undefined && (
          <div>
            <dt>Item level</dt>
            <dd>{m.ilvl ?? "—"}</dd>
          </div>
        )}
      </dl>
      {m.name !== undefined && (
        <Link href={`/character/${encodeURIComponent(m.guid)}`} className={styles.open}>
          Open character →
        </Link>
      )}
    </section>
  );
}
