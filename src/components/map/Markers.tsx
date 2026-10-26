"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { classInfo } from "@/core/gamedata/classes";
import { FAN_MAX, fanOffsets, markerLabel, placeLabel, type MapMarker, type MapPlace } from "@/core/views/mapMarkers";
import { DungeonIcon } from "@/components/ui/icons";
import styles from "./Markers.module.css";

/** The marker's class colour (fill) and class text colour, as custom properties for Markers.module.css. */
export function classStyle(classFile: string | undefined): CSSProperties | undefined {
  const info = classInfo(classFile);
  if (info === undefined) return undefined;
  return { "--mk": `var(${info.colorToken})`, "--mk-text": `var(${info.textToken})` } as CSSProperties;
}

/** What the map does when a marker is pointed at, focused or picked. */
export interface MarkerEvents {
  onSelect: (guid: string) => void;
  /** guid while pointed at or focused; undefined when left. */
  onHover: (guid: string | undefined) => void;
}

interface CharacterMarkerProps extends Partial<MarkerEvents> {
  marker: MapMarker;
  selected: boolean;
  /** Show the dungeon badge (a lone marker in a dungeon; a cluster shows its own). */
  badge?: boolean;
  /** A link instead of a button (the character page's mini map, WEB-23); without href or onSelect, a picture. */
  href?: string;
}

/**
 * One character (DESIGN.md §4 marker per freshness, map-states board): class disc with initials in a 44 px button,
 * glow and pulse when new, ring and age tag when older, gold ring when selected.
 */
export function CharacterMarker({ marker: m, selected, badge = false, href, onSelect, onHover }: CharacterMarkerProps) {
  const look = {
    className: styles.marker,
    "data-age": m.age,
    "data-class": classInfo(m.classFile)?.classFile.toLowerCase() ?? "unknown",
    "data-selected": selected || undefined,
    "aria-label": markerLabel(m),
    style: classStyle(m.classFile),
  };
  const disc = (
    <span className={styles.disc} aria-hidden="true" data-initials={m.initials}>
      {m.age === "live" && <span className={styles.pulse} data-ambient="" />}
    </span>
  );
  let control;
  if (href !== undefined) {
    control = (
      <Link {...look} href={href}>
        {disc}
      </Link>
    );
  } else if (onSelect === undefined) {
    control = (
      <span {...look} role="img" data-static="">
        {disc}
      </span>
    );
  } else {
    control = (
      <button
        type="button"
        {...look}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(m.guid);
        }}
        onPointerEnter={() => onHover?.(m.guid)}
        onPointerLeave={() => onHover?.(undefined)}
        onFocus={() => onHover?.(m.guid)}
        onBlur={() => onHover?.(undefined)}
      >
        {disc}
      </button>
    );
  }
  return (
    <span className={styles.item}>
      {control}
      {m.ageTag !== undefined && (
        <span className={styles.ageTag} data-age={m.age} aria-hidden="true">
          {m.ageTag}
        </span>
      )}
      {badge && m.dungeonName !== undefined && <DungeonBadge />}
    </span>
  );
}

function DungeonBadge() {
  return (
    <span className={styles.badge} aria-hidden="true">
      <DungeonIcon className={styles.badgeIcon} />
    </span>
  );
}

interface ZoneClusterProps extends MarkerEvents {
  place: MapPlace;
  open: boolean;
  onOpen: (open: boolean) => void;
  selected?: string;
}

/**
 * Several characters in one zone (map-states board): the count in a ring split by class colour, a dungeon badge when
 * someone is in a dungeon. 2–5 fan out (spring, 30 ms stagger) on hover, focus or tap; 6 or more open a list.
 */
export function ZoneCluster({ place, open, onOpen, selected, onSelect, onHover }: ZoneClusterProps) {
  const fan = place.markers.length <= FAN_MAX;
  const share = 100 / place.markers.length;
  const ring = place.markers
    .map((m, i) => {
      const colour = classInfo(m.classFile)?.colorToken ?? "--avatar";
      return `var(${colour}) ${(i * share).toFixed(2)}% ${((i + 1) * share).toFixed(2)}%`;
    })
    .join(", ");
  const live = place.markers.some((m) => m.age === "live");
  const offsets = fan ? fanOffsets(place.markers.length) : [];
  const listId = `cluster-${place.zone}`;
  return (
    <span
      className={styles.item}
      data-open={open || undefined}
      onPointerEnter={fan ? () => onOpen(true) : undefined}
      onPointerLeave={fan ? () => onOpen(false) : undefined}
      onFocus={fan ? () => onOpen(true) : undefined}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onOpen(false);
      }}
    >
      <button
        type="button"
        className={styles.cluster}
        data-many={fan ? undefined : ""}
        data-live={live || undefined}
        aria-label={placeLabel(place)}
        aria-expanded={open}
        aria-controls={fan ? undefined : listId}
        style={{ "--ring": `conic-gradient(${ring})` } as CSSProperties}
        onClick={(e) => {
          e.stopPropagation();
          // A fan opens on hover already, so a click (or tap) only opens it; a list toggles.
          onOpen(fan ? true : !open);
        }}
      >
        <span className={styles.ring} aria-hidden="true">
          {live && <span className={styles.pulse} data-ambient="" />}
          <span className={styles.count}>{place.markers.length}</span>
        </span>
      </button>
      {place.dungeons.length > 0 && <DungeonBadge />}
      {fan && open && (
        <>
          {offsets.map((o, i) => (
            <span
              key={`spoke-${place.markers[i]!.guid}`}
              className={styles.spoke}
              aria-hidden="true"
              style={
                {
                  "--angle": `${Math.atan2(o.dy, o.dx)}rad`,
                  "--i": i,
                } as CSSProperties
              }
            />
          ))}
          {place.markers.map((m, i) => (
            <span
              key={m.guid}
              className={styles.fanItem}
              style={{ "--dx": `${offsets[i]!.dx}px`, "--dy": `${offsets[i]!.dy}px`, "--i": i } as CSSProperties}
            >
              <CharacterMarker marker={m} selected={m.guid === selected} onSelect={onSelect} onHover={onHover} />
            </span>
          ))}
        </>
      )}
      {!fan && open && (
        <ul id={listId} className={styles.list} aria-label={`Characters in ${place.zoneName}`}>
          {place.markers.map((m) => (
            <li key={m.guid}>
              <button
                type="button"
                className={styles.listRow}
                aria-pressed={m.guid === selected}
                style={classStyle(m.classFile)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(m.guid);
                }}
              >
                <span className={styles.listName}>{m.name ?? m.ownerName ?? "Unknown character"}</span>
                {m.level !== undefined && <span className={styles.listLevel}>{m.level}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
