"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { classInfo } from "@/core/gamedata/classes";
import {
  ZOOM_MAX,
  continentAt,
  parseContinent,
  wholeWorld,
  zoomLevel,
  zoomStep,
  type Continent,
  type MapMarker,
  type MapPlace,
  type ZoomLevel,
} from "@/core/views/mapMarkers";
import { motionOn } from "@/components/atmosphere/motion";
import { DungeonIcon } from "@/components/ui/icons";
import { CharacterCard } from "./CharacterCard";
import { FLY_EVENT } from "./flyTo";
import { CharacterMarker, FAN_MAX, ZoneCluster, fanOffsets } from "./Markers";
import styles from "./Markers.module.css";
import frameStyles from "./WorldMap.module.css";
import zoom from "./Zoom.module.css";

type Box = { x: number; y: number; width: number; height: number };

export interface MapStageProps {
  places: MapPlace[];
  /** The world part on screen at 1× (the whole world), world units. */
  box: Box;
  /** GUID from `?character=` on first render. */
  selected?: string;
  /** Pan, zoom and fly-to (WEB-26). Each continent's frame for the continent switch, world units. */
  frames?: Record<Continent, Box>;
  /** World x between the continents (map.ts CONTINENT_SPLIT). */
  split?: number;
  /** Dungeon entrances, shown at zone zoom (4×). */
  dungeons?: { name: string; x: number; y: number }[];
  /** GUIDs of the sightings that drop in (`?drop=`, from a session report). */
  drop?: string[];
  /** The server-rendered map SVG. */
  children: ReactNode;
}

/** How long a hover card stays after the pointer leaves, so it can be reached (and "Open character" clicked). */
const CARD_GRACE_MS = 160;
/** Quiet time after the last transform before the view settles (continent switch, zone, bounds). */
const SETTLE_MS = 120;
/** Pixels an arrow key pans. */
const PAN_STEP = 80;

/** Writes URL parameters without a server round trip, keeping the others. */
function writeParams(params: Record<string, string | undefined>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(window.history.state, "", url);
}

const PHONE = "(max-width: 767px)";
const onPhoneChange = (notify: () => void) => {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

/** A duration token in ms (DESIGN.md §6), 0 without motion: fly and drop jump. */
function motionMs(token: string): number {
  if (!motionOn()) return 0;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return value.endsWith("ms") ? n : n * 1000;
}

/**
 * The interactive layer over the map SVG (WEB-25): zone hover (bright edge, name in the corner), markers and clusters
 * as HTML, the hover/focus card and the selection (`?character=`). WEB-26: pan, zoom and pinch with three levels
 * (world 1×, continent 2×, zone 4×), the continent switch as a fly, fly-to-character and the new-sighting drop.
 */
export function MapStage({
  places,
  box,
  selected: initial,
  frames,
  split,
  dungeons = [],
  drop,
  children,
}: MapStageProps) {
  const root = useRef<HTMLDivElement>(null);
  const zoomer = useRef<ReactZoomPanPinchRef>(null);
  const [zoneName, setZoneName] = useState<string>();
  const hoverZone = useRef<Element | null>(null);
  const [selected, setSelected] = useState(initial);
  const [hovered, setHovered] = useState<string>();
  const [openZone, setOpenZone] = useState<string>();
  const [level, setLevel] = useState<ZoomLevel>("world");
  const [scaleEnd, setScaleEnd] = useState<"min" | "mid" | "max">("min");
  const [focusZone, setFocusZone] = useState<{ id: string; name: string }>();
  const leave = useRef<ReturnType<typeof setTimeout>>(undefined);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dragged = useRef(false);
  const shownContinent = useRef<Continent | undefined>(undefined);
  const zoomable = frames !== undefined && split !== undefined;
  const continent = parseContinent(useSearchParams().get("continent"));
  const [dropping] = useState(() => new Set(drop));
  // On phone the card is fixed above the tab bar, so it lives outside the zoomed (transformed) stage.
  const phone = useSyncExternalStore(
    onPhoneChange,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );

  const select = useCallback((guid: string | undefined) => {
    setSelected(guid);
    writeParams({ character: guid });
  }, []);

  const hover = useCallback((guid: string | undefined) => {
    clearTimeout(leave.current);
    if (guid !== undefined) setHovered(guid);
    else leave.current = setTimeout(() => setHovered(undefined), CARD_GRACE_MS);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(leave.current);
      clearTimeout(settle.current);
    },
    [],
  );

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

  /** The card opens away from the screen edges it is near (measured: the map may be zoomed and panned). */
  const placeCard = useCallback(() => {
    const anchor = root.current?.querySelector<HTMLElement>("[data-card-anchor]");
    const frame = zoomer.current?.instance.wrapperComponent;
    if (anchor == null || frame == null) return;
    const a = anchor.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    const fx = (a.left - f.left) / f.width;
    const fy = (a.top - f.top) / f.height;
    anchor.dataset.side = fx > 0.62 ? "left" : "right";
    anchor.dataset.v = fy > 0.7 ? "up" : fy < 0.25 ? "down" : "mid";
  }, []);

  /** The screen centre in world units, from the stage as it is drawn now. */
  const centre = useCallback(() => {
    const frame = zoomer.current?.instance.wrapperComponent;
    const stage = root.current;
    if (frame == null || stage === null) return undefined;
    const f = frame.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const cx = f.left + f.width / 2;
    const cy = f.top + f.height / 2;
    return {
      client: { x: cx, y: cy },
      world: { x: box.x + ((cx - s.left) / s.width) * box.width, y: box.y + ((cy - s.top) / s.height) * box.height },
    };
  }, [box]);

  /** After a pan or zoom: keep the world on screen, name the continent and (at 4×) the zone in the centre. */
  const settled = useCallback(() => {
    const z = zoomer.current;
    const c = centre();
    if (z === null || c === undefined || split === undefined) return;
    const { scale, positionX, positionY } = z.instance.state;
    placeCard();
    if (wholeWorld(scale) && (positionX !== 0 || positionY !== 0)) {
      z.setTransform(0, 0, 1, motionMs("--dur-card"), "easeOut");
      return;
    }
    const x = Math.min(Math.max(c.world.x, box.x), box.x + box.width);
    const y = Math.min(Math.max(c.world.y, box.y), box.y + box.height);
    if (x !== c.world.x || y !== c.world.y) {
      const stage = root.current!.getBoundingClientRect();
      const dx = ((c.world.x - x) / box.width) * stage.width;
      const dy = ((c.world.y - y) / box.height) * stage.height;
      z.setTransform(positionX + dx, positionY + dy, scale, motionMs("--dur-card"), "easeOut");
      return;
    }
    const now = continentAt(c.world.x, scale, split);
    if (now !== shownContinent.current) {
      shownContinent.current = now;
      writeParams({ continent: now === "azeroth" ? undefined : now });
    }
    const hit =
      zoomLevel(scale) === "zone"
        ? document.elementsFromPoint(c.client.x, c.client.y).find((el) => el.hasAttribute("data-zone"))
        : undefined;
    const id = hit?.getAttribute("data-zone");
    const name = hit?.getAttribute("data-name");
    setFocusZone((was) => (id == null || name == null ? undefined : was?.id === id ? was : { id, name }));
  }, [box, centre, placeCard, split]);

  const onTransform = useCallback(
    (_: ReactZoomPanPinchRef, state: { scale: number }) => {
      root.current?.style.setProperty("--zoom", String(state.scale));
      setLevel(zoomLevel(state.scale));
      setScaleEnd(wholeWorld(state.scale) ? "min" : zoomLevel(state.scale) === "zone" ? "max" : "mid");
      clearTimeout(settle.current);
      settle.current = setTimeout(settled, SETTLE_MS);
    },
    [settled],
  );

  /** Frames a continent (the switch), or the whole world for Azeroth. */
  const frameContinent = useCallback((to: Continent, animate: boolean) => {
    const z = zoomer.current;
    if (z === null) return;
    shownContinent.current = to;
    const time = animate ? motionMs("--dur-fly") : 0;
    if (to === "azeroth") {
      void z.setTransform(0, 0, 1, time, "easeInOutCubic");
      return;
    }
    const target = root.current?.querySelector<HTMLElement>(`[data-frame="${to}"]`);
    if (target != null)
      void z.zoomToElement(target, {
        minScale: 1,
        maxScale: ZOOM_MAX,
        animationTime: time,
        animationType: "easeInOutCubic",
      });
  }, []);

  /** Flies to a character's place at zone zoom (DESIGN.md §6: 600 ms pan + zoom, a jump without motion). */
  const flyTo = useCallback(
    (guid: string) => {
      const place = places.find((p) => p.markers.some((m) => m.guid === guid));
      const target =
        place === undefined
          ? null
          : root.current?.querySelector<HTMLElement>(`[data-place="${CSS.escape(place.zone)}"]`);
      if (target == null) return;
      void zoomer.current?.zoomToElement(target, {
        scale: ZOOM_MAX,
        animationTime: motionMs("--dur-fly"),
        animationType: "easeInOutCubic",
      });
    },
    [places],
  );

  // First view: the selected character (a link), else the continent from the URL.
  const started = useRef(false);
  useEffect(() => {
    if (!zoomable || started.current) return;
    started.current = true;
    shownContinent.current = continent;
    if (initial !== undefined && places.some((p) => p.markers.some((m) => m.guid === initial))) flyTo(initial);
    else if (continent !== "azeroth") frameContinent(continent, false);
  }, [zoomable, continent, initial, places, flyTo, frameContinent]);

  // The continent switch: a new `?continent=` that the map did not write itself flies there.
  useEffect(() => {
    if (!zoomable || !started.current || continent === shownContinent.current) return;
    frameContinent(continent, true);
  }, [zoomable, continent, frameContinent]);

  // The roll call and the phone sheet ask for a fly (flyTo.ts).
  useEffect(() => {
    const onFly = (e: Event) => {
      const guid = (e as CustomEvent<string>).detail;
      if (typeof guid !== "string") return;
      select(guid);
      flyTo(guid);
    };
    window.addEventListener(FLY_EVENT, onFly);
    return () => window.removeEventListener(FLY_EVENT, onFly);
  }, [select, flyTo]);

  // The drop plays once: a reload shows the map as usual.
  useEffect(() => {
    if (drop !== undefined) writeParams({ drop: undefined });
  }, [drop]);

  // The zone name at 4× moves into the top bar (TopBar's slot): its label leaves the map, other zones dim.
  useEffect(() => {
    if (focusZone === undefined) return;
    const id = CSS.escape(focusZone.id);
    const marked = [...(root.current?.querySelectorAll(`[data-zone="${id}"], [data-label="${id}"]`) ?? [])];
    for (const el of marked) el.setAttribute("data-focus", "");
    return () => {
      for (const el of marked) el.removeAttribute("data-focus");
    };
  }, [focusZone]);

  /** + and −: the next level, around the centre of the screen; 0 the whole world. */
  const zoomTo = useCallback((scale: number) => {
    const z = zoomer.current;
    const frame = z?.instance.wrapperComponent;
    if (z == null || frame == null) return;
    const { scale: from, positionX, positionY } = z.instance.state;
    const cx = frame.clientWidth / 2;
    const cy = frame.clientHeight / 2;
    const k = scale / from;
    void z.setTransform(cx - (cx - positionX) * k, cy - (cy - positionY) * k, scale, motionMs("--dur-zone"), "easeOut");
  }, []);
  const stepZoom = (direction: 1 | -1) => {
    const scale = zoomer.current?.instance.state.scale ?? 1;
    zoomTo(zoomStep(scale, direction));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const z = zoomer.current;
    if (z === null || e.altKey || e.ctrlKey || e.metaKey) return;
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [PAN_STEP, 0],
      ArrowRight: [-PAN_STEP, 0],
      ArrowUp: [0, PAN_STEP],
      ArrowDown: [0, -PAN_STEP],
    };
    const by = pan[e.key];
    if (by !== undefined) {
      if (wholeWorld(z.instance.state.scale)) return;
      void z.panBy(by[0], by[1], motionMs("--dur-fast"), "easeOut");
    } else if (e.key === "+" || e.key === "=") stepZoom(1);
    else if (e.key === "-" || e.key === "_") stepZoom(-1);
    else if (e.key === "0") zoomTo(1);
    else return;
    e.preventDefault();
  };

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
  useLayoutEffect(placeCard, [placeCard, cardGuid]);

  // Only after a zoom settled at 4× (client side), so the top bar's slot is there to find.
  const zoneSlot = focusZone === undefined ? null : document.querySelector("[data-map-zone]");

  const cardAnchor = card !== undefined && (
    <div
      className={styles.cardAnchor}
      style={
        {
          ...at(card.place.x, card.place.y),
          "--dx": `${card.dx}px`,
          "--dy": `${card.dy}px`,
        } as CSSProperties
      }
      data-card-anchor=""
      data-map-item=""
      onPointerEnter={() => hover(card.marker.guid)}
      onPointerLeave={() => hover(undefined)}
    >
      <CharacterCard key={card.marker.guid} marker={card.marker} />
    </div>
  );

  const stage = (
    <div className={frameStyles.fit}>
      <div className={frameStyles.stage} style={{ "--map-w": box.width, "--map-h": box.height } as CSSProperties}>
        <div
          ref={root}
          className={styles.root}
          data-level={level}
          onPointerOver={(e) => markZone(e.target)}
          onPointerLeave={() => markZone(null)}
          onPointerDown={() => {
            dragged.current = false;
          }}
          onClick={(e) => {
            if (dragged.current) return;
            if (e.target instanceof Element && e.target.closest("[data-map-item]") !== null) return;
            setOpenZone(undefined);
            select(undefined);
          }}
        >
          {children}
          <div className={styles.overlay}>
            {frames !== undefined &&
              (["kalimdor", "eastern-kingdoms"] as const).map((c) => (
                <span
                  key={c}
                  className={zoom.frame}
                  data-frame={c}
                  aria-hidden="true"
                  style={
                    {
                      ...at(frames[c].x, frames[c].y),
                      "--w": `${(frames[c].width / box.width) * 100}%`,
                      "--h": `${(frames[c].height / box.height) * 100}%`,
                    } as CSSProperties
                  }
                />
              ))}
            {dungeons.map((d) => (
              <span key={d.name} className={zoom.dungeon} style={at(d.x, d.y)} aria-hidden="true">
                <span className={zoom.dungeonMark}>
                  <DungeonIcon className={zoom.dungeonIcon} />
                  <span>{d.name}</span>
                </span>
              </span>
            ))}
            {places.map((place) => {
              const holdsSelection = place.markers.some((m) => m.guid === selected);
              const fan = place.markers.length <= FAN_MAX;
              const dropped = place.markers.find((m) => dropping.has(m.guid));
              const dropColour = classInfo(dropped?.classFile)?.colorToken;
              return (
                <div
                  key={place.zone}
                  className={styles.place}
                  style={
                    {
                      ...at(place.x, place.y),
                      ...(dropColour === undefined ? {} : { "--drop": `var(${dropColour})` }),
                    } as CSSProperties
                  }
                  data-map-item=""
                  data-place={place.zone}
                  data-drop={dropped !== undefined || undefined}
                >
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
                      open={openZone === place.zone || (fan && (holdsSelection || level !== "world"))}
                      pinned={fan && level !== "world"}
                      onOpen={(open) => setOpenZone((z) => (open ? place.zone : z === place.zone ? undefined : z))}
                      selected={selected}
                      onSelect={select}
                      onHover={hover}
                    />
                  )}
                </div>
              );
            })}
            {!phone && cardAnchor}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {zoomable ? (
        <TransformWrapper
          ref={zoomer}
          minScale={1}
          maxScale={ZOOM_MAX}
          limitToBounds={false}
          doubleClick={{ disabled: true }}
          panning={{ excluded: ["input", "textarea"] }}
          onTransform={onTransform}
          onPanning={() => {
            dragged.current = true;
          }}
        >
          <TransformComponent
            wrapperClass={zoom.wrapper}
            contentClass={zoom.content}
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: "100%", height: "100%" }}
            wrapperProps={{
              tabIndex: 0,
              role: "group",
              "aria-label": "Map. Arrow keys pan, plus and minus zoom, 0 shows the whole world.",
              onKeyDown,
            }}
          >
            {stage}
          </TransformComponent>
        </TransformWrapper>
      ) : (
        stage
      )}
      {phone && cardAnchor}
      <p className={styles.zoneName} aria-hidden="true">
        {zoneName}
      </p>
      {zoomable && (
        <div className={zoom.controls}>
          <button
            type="button"
            className={zoom.button}
            aria-label="Zoom in"
            disabled={scaleEnd === "max"}
            onClick={() => stepZoom(1)}
          >
            +
          </button>
          <button
            type="button"
            className={zoom.button}
            aria-label="Zoom out"
            disabled={scaleEnd === "min"}
            onClick={() => stepZoom(-1)}
          >
            −
          </button>
        </div>
      )}
      {zoneSlot !== null && createPortal(focusZone!.name, zoneSlot)}
    </>
  );
}
