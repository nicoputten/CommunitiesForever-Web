"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { MapMarker, MapPlace } from "@/core/views/mapMarkers";
import { CharacterCard } from "./CharacterCard";
import { FAN_MAX, fanOffsets } from "@/core/views/mapMarkers";
import { CharacterMarker, ZoneCluster } from "./Markers";
import styles from "./Markers.module.css";

export interface MapStageProps {
  places: MapPlace[];
  /** The world part on screen (continent switch), world units. */
  box: { x: number; y: number; width: number; height: number };
  /** GUID from `?character=` on first render. */
  selected?: string;
  /** The server-rendered map SVG. */
  children: ReactNode;
}

/** How long a hover card stays after the pointer leaves, so it can be reached (and "Open character" clicked). */
const CARD_GRACE_MS = 160;

/** Writes the selection into the URL without a server round trip, keeping the other parameters. */
function writeSelection(guid: string | undefined) {
  const url = new URL(window.location.href);
  if (guid === undefined) url.searchParams.delete("character");
  else url.searchParams.set("character", guid);
  window.history.replaceState(window.history.state, "", url);
}

/**
 * The interactive layer over the map SVG (WEB-25): zone hover (bright edge, name in the corner), markers and clusters
 * as HTML, the hover/focus card and the selection (`?character=`). Pan, zoom and fly-to come with WEB-26.
 */
export function MapStage({ places, box, selected: initial, children }: MapStageProps) {
  const root = useRef<HTMLDivElement>(null);
  const [zoneName, setZoneName] = useState<string>();
  const hoverZone = useRef<Element | null>(null);
  const [selected, setSelected] = useState(initial);
  const [hovered, setHovered] = useState<string>();
  const [openZone, setOpenZone] = useState<string>();
  const leave = useRef<ReturnType<typeof setTimeout>>(undefined);

  const select = useCallback((guid: string | undefined) => {
    setSelected(guid);
    writeSelection(guid);
  }, []);

  const hover = useCallback((guid: string | undefined) => {
    clearTimeout(leave.current);
    if (guid !== undefined) setHovered(guid);
    else leave.current = setTimeout(() => setHovered(undefined), CARD_GRACE_MS);
  }, []);

  useEffect(() => () => clearTimeout(leave.current), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenZone(undefined);
      setHovered(undefined);
      select(undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  // Zone hover: the SVG is static server markup, so the hovered zone's border is marked on the element itself.
  const markZone = (target: EventTarget | null) => {
    const zone = target instanceof Element ? target.closest("[data-zone]") : null;
    if (zone === null && target instanceof Element && target.closest("[data-map-item]") !== null) return;
    const id = zone?.getAttribute("data-zone") ?? undefined;
    const tint = id === undefined ? null : (root.current?.querySelector(`[data-tint="${CSS.escape(id)}"]`) ?? null);
    if (tint === hoverZone.current) return;
    hoverZone.current?.removeAttribute("data-hover");
    tint?.setAttribute("data-hover", "");
    hoverZone.current = tint;
    setZoneName(zone?.getAttribute("data-name") ?? undefined);
  };

  const at = (x: number, y: number) =>
    ({
      "--x": `${((x - box.x) / box.width) * 100}%`,
      "--y": `${((y - box.y) / box.height) * 100}%`,
    }) as CSSProperties;

  // The card shows for the marker pointed at or focused, else for the selected one.
  const cardGuid = hovered ?? selected;
  let card: { marker: MapMarker; place: MapPlace; dx: number; dy: number } | undefined;
  for (const place of places) {
    const i = place.markers.findIndex((m) => m.guid === cardGuid);
    if (i < 0) continue;
    const offset =
      place.markers.length > 1 && place.markers.length <= FAN_MAX ? fanOffsets(place.markers.length)[i] : undefined;
    card = { marker: place.markers[i]!, place, dx: offset?.dx ?? 0, dy: offset?.dy ?? 0 };
  }

  return (
    <div
      ref={root}
      className={styles.root}
      onPointerOver={(e) => markZone(e.target)}
      onPointerLeave={() => markZone(null)}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest("[data-map-item]") !== null) return;
        setOpenZone(undefined);
        select(undefined);
      }}
    >
      {children}
      <div className={styles.overlay}>
        {places.map((place) => {
          const holdsSelection = place.markers.some((m) => m.guid === selected);
          return (
            <div key={place.zone} className={styles.place} style={at(place.x, place.y)} data-map-item="">
              {place.markers.length === 1 ? (
                <CharacterMarker
                  marker={place.markers[0]!}
                  selected={place.markers[0]!.guid === selected}
                  badge
                  onSelect={select}
                  onHover={hover}
                />
              ) : (
                <ZoneCluster
                  place={place}
                  open={openZone === place.zone || (holdsSelection && place.markers.length <= FAN_MAX)}
                  onOpen={(open) => setOpenZone((z) => (open ? place.zone : z === place.zone ? undefined : z))}
                  selected={selected}
                  onSelect={select}
                  onHover={hover}
                />
              )}
            </div>
          );
        })}
        {card !== undefined && (
          <div
            className={styles.cardAnchor}
            style={
              {
                ...at(card.place.x, card.place.y),
                "--dx": `${card.dx}px`,
                "--dy": `${card.dy}px`,
              } as CSSProperties
            }
            data-side={(card.place.x - box.x) / box.width > 0.62 ? "left" : "right"}
            data-v={
              (card.place.y - box.y) / box.height > 0.7
                ? "up"
                : (card.place.y - box.y) / box.height < 0.25
                  ? "down"
                  : "mid"
            }
            data-map-item=""
            onPointerEnter={() => hover(card.marker.guid)}
            onPointerLeave={() => hover(undefined)}
          >
            <CharacterCard key={card.marker.guid} marker={card.marker} />
          </div>
        )}
      </div>
      <p className={styles.zoneName} aria-hidden="true">
        {zoneName}
      </p>
    </div>
  );
}
