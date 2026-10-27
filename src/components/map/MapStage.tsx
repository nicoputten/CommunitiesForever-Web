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
import {
  TransformComponent,
  TransformWrapper,
  useTransformContext,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { classInfo } from "@/core/gamedata/classes";
import {
  CONTINENTS,
  ZOOM_MAX,
  continentAt,
  continentScale,
  edgeHint,
  parseContinent,
  placeOf,
  wholeWorld,
  zoomLevel,
  zoomStep,
  type Continent,
  type MapMarker,
  type MapPlace,
  type ZoomLevel,
} from "@/core/views/mapMarkers";
import { motionOn } from "@/components/atmosphere/motion";
import { FilterMenu } from "@/components/roster/FilterMenu";
import { DungeonIcon } from "@/components/ui/icons";
import { BottomSheet, sheetHeights, type Snap } from "./BottomSheet";
import { CharacterCard } from "./CharacterCard";
import { CharacterSheet } from "./CharacterSheet";
import { FLY_EVENT, SHEET_EVENT, type SheetRequest } from "./flyTo";
import { CharacterMarker, FAN_MAX, ZoneCluster, fanOffsets } from "./Markers";
import styles from "./Markers.module.css";
import frameStyles from "./WorldMap.module.css";
import zoom from "./Zoom.module.css";
import phoneStyles from "./PhoneMap.module.css";

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
  /** Below 1024 px: the roll call for the phone's bottom sheet (WEB-28); the tapped character replaces it. */
  sheet?: ReactNode;
  /** The server-rendered map SVG. */
  children: ReactNode;
}

/** How long a hover card stays after the pointer leaves, so it can be reached (and "Open character" clicked). */
const CARD_GRACE_MS = 160;
/** Quiet time after the last transform before the view settles (continent switch, zone, bounds). */
const SETTLE_MS = 120;
/** Dragged past the edge of the world, the map moves this share of the pointer: resistance (story WEB-26). */
const EDGE_GIVE = 0.35;
/** Pixels an arrow key pans. */
const PAN_STEP = 80;

/** Writes URL parameters without a server round trip, keeping the others; `push` adds a history entry (Back undoes). */
function writeParams(params: Record<string, string | undefined>, push = false) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  // Unchanged: leave the history entry (and Next.js's state in it, for Back) alone.
  if (url.href === window.location.href) return;
  // null state: Next.js then syncs useSearchParams (the top bar's continent switch) with the new URL.
  if (push) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

const PHONE = "(max-width: 767px)";
/** Below this the roll call is the bottom sheet and a tapped character opens in it (WEB-28, Nico 2026-10-27). */
const SHEET = "(max-width: 1023px)";
const onMediaChange = (query: string) => (notify: () => void) => {
  const list = window.matchMedia(query);
  list.addEventListener("change", notify);
  return () => list.removeEventListener("change", notify);
};
const onPhoneChange = onMediaChange(PHONE);
const onSheetChange = onMediaChange(SHEET);

/** A duration token in ms (DESIGN.md §6), 0 without motion: fly and drop jump. */
function motionMs(token: string): number {
  if (!motionOn()) return 0;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return value.endsWith("ms") ? n : n * 1000;
}

/**
 * Reports every transform the zoom applies, its first one on init included: the wrapper's onTransform only reports
 * the ones it is asked for, so a view could settle before the map got there.
 */
function TransformWatch({ onApplied }: { onApplied: (state: { scale: number }) => void }) {
  const instance = useTransformContext();
  useEffect(() => instance.onTransform(onApplied), [instance, onApplied]);
  return null;
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
  sheet,
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
  const params = useSearchParams();
  const continent = parseContinent(params.get("continent"));
  const [dropping] = useState(() => new Set(drop));
  // On phone the card is fixed above the tab bar, so it lives outside the zoomed (transformed) stage.
  const phone = useSyncExternalStore(
    onPhoneChange,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
  // Below 1024 px with a roll call: the bottom sheet, its snap point, and the view before a character opened in it.
  const sheetWidth = useSyncExternalStore(
    onSheetChange,
    () => window.matchMedia(SHEET).matches,
    () => false,
  );
  const sheetMode = sheet !== undefined && sheetWidth;
  const [snap, setSnapState] = useState<Snap>(initial === undefined ? "peek" : "half");
  /** The snap point the sheet is going to, for centring the map in the part above it right away. */
  const snapNow = useRef<Snap>(snap);
  const sheetOn = useRef(false);
  useLayoutEffect(() => {
    sheetOn.current = sheetMode;
  }, [sheetMode]);
  const setSnap = useCallback((to: Snap) => {
    snapNow.current = to;
    setSnapState(to);
  }, []);
  /** The selection as the handlers last set it (state lags a render behind). */
  const selectedNow = useRef(initial);

  /** pick (below): declared later, used by the Escape key. */
  const pickRef = useRef<(guid: string | undefined) => void>(() => undefined);

  const select = useCallback((guid: string | undefined) => {
    selectedNow.current = guid;
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
      pickRef.current(undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  /**
   * The frame, and the stage inside the zoom's content unscaled (px from the content's own origin, which may sit
   * offset in the frame): where a world point is at 1×.
   */
  const layout = useCallback(() => {
    const z = zoomer.current;
    const frame = z?.instance.wrapperComponent;
    const content = z?.instance.contentComponent;
    const stage = root.current;
    if (z == null || frame == null || content == null || stage === null) return undefined;
    // Layout offsets, which no transform changes, and the transform the library is applying: measured rects lag
    // behind it while it applies a new one.
    let left = 0;
    let top = 0;
    for (let el: HTMLElement | null = stage; el !== null && el !== frame; el = el.offsetParent as HTMLElement | null) {
      left += el.offsetLeft;
      top += el.offsetTop;
    }
    const f = frame.getBoundingClientRect();
    // The phone's bottom sheet (WEB-28) covers the map's lower part: the centre is in the part above it.
    const bottom = sheetOn.current
      ? Math.min(f.bottom, window.innerHeight - sheetHeights()[snapNow.current])
      : f.bottom;
    // A panel over the map's right side (the roll call, WEB-27: `data-map-panel`) narrows the part the centre is in.
    let right = f.right;
    for (const panel of document.querySelectorAll("[data-map-panel]")) {
      const p = panel.getBoundingClientRect();
      if (p.width > 0 && p.left > f.left + f.width / 2 && p.left < right) right = p.left;
    }
    const { scale, positionX, positionY } = z.instance.state;
    return {
      z,
      frame: f,
      scale,
      positionX,
      positionY,
      /** The centre of the visible map, from the frame's top left. */
      cx: (right - f.left) / 2,
      cy: (bottom - f.top) / 2,
      /** The visible map's height. */
      ch: bottom - f.top,
      // Where the content sits in the frame before its transform, and the stage in the content (unscaled).
      originX: content.offsetLeft,
      originY: content.offsetTop,
      left: left - content.offsetLeft,
      top: top - content.offsetTop,
      width: stage.offsetWidth,
      height: stage.offsetHeight,
    };
  }, []);

  /** The world point (and scale) the map means to show in the centre; kept when the frame changes size. */
  const view = useRef<{ x: number; y: number; scale: number } | undefined>(undefined);
  /** Panned or zoomed by hand since the last settle: then the centre on screen becomes the view. */
  const byHand = useRef(false);

  /** Puts a world point in the centre at a scale: a fly (DESIGN.md §6), or a jump when `time` is 0. */
  const goTo = useCallback(
    (
      x: number,
      y: number,
      scale: number,
      time: number,
      type: "easeInOutCubic" | "easeOutCubic" | "easeOut" = "easeInOutCubic",
    ) => {
      const l = layout();
      if (l === undefined) return Promise.resolve();
      view.current = { x, y, scale };
      const px = l.cx - l.originX - scale * (l.left + ((x - box.x) / box.width) * l.width);
      const py = l.cy - l.originY - scale * (l.top + ((y - box.y) / box.height) * l.height);
      return l.z.setTransform(px, py, scale, time, type);
    },
    [layout, box],
  );

  /** The screen centre in world units, from the transform as it is now. */
  const centre = useCallback(() => {
    const l = layout();
    if (l === undefined) return undefined;
    const { scale, positionX, positionY } = l;
    return {
      world: {
        x: box.x + (((l.cx - l.originX - positionX) / scale - l.left) / l.width) * box.width,
        y: box.y + (((l.cy - l.originY - positionY) / scale - l.top) / l.height) * box.height,
      },
    };
  }, [layout, box]);

  /** After a pan or zoom: keep the world on screen, name the continent and (at 4×) the zone in the centre. */
  const settled = useCallback(() => {
    const z = zoomer.current;
    // A fly or spring under way is not a view to settle on, even when its frames lag behind (a busy page): its last
    // frame is a transform too, which settles again.
    if (z?.instance.animation != null) return;
    const c = centre();
    const scale = layout()?.scale;
    if (z === null || c === undefined || scale === undefined || split === undefined) return;
    placeCard();
    const moved = byHand.current;
    if (moved) {
      byHand.current = false;
      view.current = { ...c.world, scale };
    }
    // At 1× the land sits in the middle; zoomed in, the centre stays over the world.
    const whole = wholeWorld(scale);
    const x = whole ? box.x + box.width / 2 : Math.min(Math.max(c.world.x, box.x), box.x + box.width);
    const y = whole ? box.y + box.height / 2 : Math.min(Math.max(c.world.y, box.y), box.y + box.height);
    if (Math.abs(x - c.world.x) > 0.5 || Math.abs(y - c.world.y) > 0.5) {
      byHand.current = moved;
      // Springs back (no spring without motion).
      void goTo(x, y, whole ? 1 : scale, motionMs("--dur-fan"), "easeOutCubic");
      return;
    }
    // Rest on whole pixels: a fly or pinch ends on a fraction, which renders the card and labels a little differently
    // each time (and softer). The snap is a transform too, which settles once more and then holds.
    const l = layout();
    if (l !== undefined) {
      const px = Math.round(l.positionX);
      const py = Math.round(l.positionY);
      if (Math.abs(px - l.positionX) > 0.01 || Math.abs(py - l.positionY) > 0.01) {
        byHand.current = moved;
        l.z.setTransform(px, py, l.scale, 0);
        return;
      }
    }
    // The switch follows a pan or zoom by hand; a fly (the switch, a link) already set it.
    const now = continentAt(c.world.x, scale, split);
    if (moved && now !== shownContinent.current) {
      shownContinent.current = now;
      writeParams({ continent: now === "azeroth" ? undefined : now });
    }
    // The zone under the centre, by geometry (the SVG's user units are world units), so no card or marker over the
    // centre gets in the way.
    const point = new DOMPoint(c.world.x, c.world.y);
    const hit =
      zoomLevel(scale) === "zone"
        ? [...(root.current?.querySelectorAll<SVGPathElement>("path[data-zone]") ?? [])].find((p) =>
            p.isPointInFill(point),
          )
        : undefined;
    const id = hit?.getAttribute("data-zone");
    const name = hit?.getAttribute("data-name");
    setFocusZone((was) => (id == null || name == null ? undefined : was?.id === id ? was : { id, name }));
  }, [box, centre, goTo, layout, placeCard, split]);

  /** While dragging past the world's edge: hold the overshoot back, so it gives way only partly. */
  const resist = useCallback(() => {
    const l = layout();
    const c = centre();
    if (l === undefined || c === undefined) return;
    const whole = wholeWorld(l.scale);
    const x = whole ? box.x + box.width / 2 : Math.min(Math.max(c.world.x, box.x), box.x + box.width);
    const y = whole ? box.y + box.height / 2 : Math.min(Math.max(c.world.y, box.y), box.y + box.height);
    if (x === c.world.x && y === c.world.y) return;
    const dx = ((c.world.x - x) / box.width) * l.width * l.scale * (1 - EDGE_GIVE);
    const dy = ((c.world.y - y) / box.height) * l.height * l.scale * (1 - EDGE_GIVE);
    void l.z.setTransform(l.positionX + dx, l.positionY + dy, l.scale, 0);
  }, [layout, centre, box]);

  const onTransform = useCallback(
    (state: { scale: number }) => {
      root.current?.style.setProperty("--zoom", String(state.scale));
      setLevel(zoomLevel(state.scale));
      setScaleEnd(wholeWorld(state.scale) ? "min" : zoomLevel(state.scale) === "zone" ? "max" : "mid");
      clearTimeout(settle.current);
      settle.current = setTimeout(settled, SETTLE_MS);
    },
    [settled],
  );

  // The frame or the stage can change size after a fly (the page's scrollbar, late styles, a turned phone): keep the
  // same world point centred.
  useEffect(() => {
    const frame = zoomer.current?.instance.wrapperComponent;
    if (!zoomable || frame == null) return;
    const observer = new ResizeObserver(() => {
      const v = view.current;
      if (v === undefined) return;
      // A jump (0 ms) does not stop a fly under way, whose next frames would win and leave the map half-way (the
      // phone's sheet appears during the first fly to a linked character, WEB-28): a short animation replaces it.
      const flying = zoomer.current?.instance.animation != null;
      void goTo(v.x, v.y, v.scale, flying ? motionMs("--dur-fast") : 0);
    });
    observer.observe(frame);
    if (root.current !== null) observer.observe(root.current);
    return () => observer.disconnect();
  }, [zoomable, goTo]);

  /** Frames a continent (the switch), or both for Azeroth: the land centred (map.ts continentViewBox). */
  const frameContinent = useCallback(
    (to: Continent, animate: boolean) => {
      const l = layout();
      if (l === undefined || frames === undefined) return;
      shownContinent.current = to;
      writeParams({ continent: to === "azeroth" ? undefined : to });
      const f = frames[to];
      const fit = Math.min((2 * l.cx) / ((f.width / box.width) * l.width), l.ch / ((f.height / box.height) * l.height));
      const scale = continentScale(to, fit);
      void goTo(f.x + f.width / 2, f.y + f.height / 2, scale, animate ? motionMs("--dur-fly") : 0);
    },
    [layout, frames, box, goTo],
  );

  /** Flies to a character's place at zone zoom (DESIGN.md §6: 600 ms pan + zoom, a jump without motion). */
  const flyTo = useCallback(
    (guid: string) => {
      const place = places.find((p) => p.markers.some((m) => m.guid === guid));
      if (place !== undefined) void goTo(place.x, place.y, ZOOM_MAX, motionMs("--dur-fly"));
    },
    [places, goTo],
  );

  // First view: the selected character (a link), else the continent from the URL (Azeroth: the land centred).
  const started = useRef(false);
  useEffect(() => {
    if (!zoomable || started.current) return;
    started.current = true;
    shownContinent.current = continent;
    if (initial !== undefined && places.some((p) => p.markers.some((m) => m.guid === initial))) flyTo(initial);
    else frameContinent(continent, false);
  }, [zoomable, continent, initial, places, flyTo, frameContinent]);

  // The continent switch: a new `?continent=` that the map did not write itself flies there.
  useEffect(() => {
    if (!zoomable || !started.current || continent === shownContinent.current) return;
    frameContinent(continent, true);
  }, [zoomable, continent, frameContinent]);

  /** The view before a character opened in the sheet, to fly back to when it closes; whether that added a history entry. */
  const before = useRef<{ x: number; y: number; scale: number } | undefined>(undefined);
  const pushed = useRef(false);

  /** The sheet (WEB-28): a tapped character opens at half, the map flies there in the part above it. */
  const openInSheet = useCallback(
    (guid: string, history: "push" | "replace" | "none") => {
      const first = selectedNow.current === undefined;
      if (first) before.current = view.current;
      if (history !== "none") {
        writeParams({ character: guid }, history === "push" && first);
        if (history === "push" && first) pushed.current = true;
      }
      selectedNow.current = guid;
      setSelected(guid);
      setOpenZone(undefined);
      setSnap("half");
      flyTo(guid);
    },
    [flyTo, setSnap],
  );

  /** Closes the character: back to the roll call's peek (or `to`) and the view before it opened. */
  const closeSheet = useCallback(
    (history: boolean, to: Snap = "peek") => {
      selectedNow.current = undefined;
      setSelected(undefined);
      setSnap(to);
      const back = before.current;
      before.current = undefined;
      if (back !== undefined && to === "peek") void goTo(back.x, back.y, back.scale, motionMs("--dur-fly"));
      if (!history) return;
      if (pushed.current) {
        pushed.current = false;
        window.history.back();
      } else writeParams({ character: undefined });
    },
    [goTo, setSnap],
  );

  /** A marker or roll call row picked: the sheet below 1024 px, else the selection and card (WEB-25/26). */
  const pick = useCallback(
    (guid: string | undefined) => {
      if (!sheetOn.current) return select(guid);
      if (guid === undefined) {
        if (selectedNow.current !== undefined) closeSheet(true);
      } else if (guid !== selectedNow.current) openInSheet(guid, "push");
    },
    [select, openInSheet, closeSheet],
  );

  // Back and Forward with the sheet: the URL's character is the open one.
  useEffect(() => {
    const onPop = () => {
      const guid = new URL(window.location.href).searchParams.get("character") ?? undefined;
      if (!sheetOn.current || guid === selectedNow.current) return;
      if (guid === undefined) {
        pushed.current = false;
        closeSheet(false);
      } else if (places.some((p) => p.markers.some((m) => m.guid === guid))) openInSheet(guid, "none");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [places, openInSheet, closeSheet]);

  // The roll call and the phone sheet ask for a fly (flyTo.ts).
  useEffect(() => {
    const onFly = (e: Event) => {
      const guid = (e as CustomEvent<string>).detail;
      if (typeof guid !== "string") return;
      if (sheetOn.current) return pick(guid);
      select(guid);
      flyTo(guid);
    };
    window.addEventListener(FLY_EVENT, onFly);
    return () => window.removeEventListener(FLY_EVENT, onFly);
  }, [select, flyTo, pick]);

  // The phone app bar's Filters button (the full roll call) and its back arrow (close the character).
  useEffect(() => {
    const onSheet = (e: Event) => {
      const request = (e as CustomEvent<SheetRequest>).detail;
      if (request === "full") {
        if (selectedNow.current !== undefined) closeSheet(true, "full");
        else setSnap("full");
      } else if (selectedNow.current !== undefined) closeSheet(true);
    };
    window.addEventListener(SHEET_EVENT, onSheet);
    return () => window.removeEventListener(SHEET_EVENT, onSheet);
  }, [closeSheet, setSnap]);

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

  /** + and −: the next level, around the centre of the screen; 1× is the whole world, centred. */
  const zoomTo = useCallback(
    (scale: number) => {
      const c = centre();
      if (c === undefined) return;
      if (wholeWorld(scale)) frameContinent("azeroth", true);
      else {
        byHand.current = true;
        void goTo(c.world.x, c.world.y, scale, motionMs("--dur-zone"), "easeOut");
      }
    },
    [centre, goTo, frameContinent],
  );
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
      // From where the map is going, not where it is: an arrow key during a zoom (the + key, 250 ms) pans the zoom's
      // goal instead of being lost while the scale is still near 1× (or cutting the zoom short).
      const l = layout();
      const goal = view.current ?? (l === undefined ? undefined : { ...centre()!.world, scale: l.scale });
      if (l === undefined || goal === undefined || wholeWorld(goal.scale)) return;
      byHand.current = true;
      const perPx = box.width / (l.width * goal.scale);
      void goTo(goal.x - by[0] * perPx, goal.y - by[1] * perPx, goal.scale, motionMs("--dur-fast"), "easeOut");
    } else if (e.key === "+" || e.key === "=") stepZoom(1);
    else if (e.key === "-" || e.key === "_") stepZoom(-1);
    else if (e.key === "0") zoomTo(1);
    else return;
    e.preventDefault();
  };

  useLayoutEffect(() => {
    pickRef.current = pick;
  }, [pick]);

  // The card shows for the marker pointed at or focused, else for the selected one. With the sheet the selected one
  // is in the sheet: a tablet still shows the card on hover, a phone never.
  const cardGuid = sheetMode ? (phone ? undefined : hovered) : (hovered ?? selected);
  let card: { marker: MapMarker; place: MapPlace; dx: number; dy: number } | undefined;
  for (const place of places) {
    const i = place.markers.findIndex((m) => m.guid === cardGuid);
    if (i < 0) continue;
    const offset =
      place.markers.length > 1 && place.markers.length <= FAN_MAX ? fanOffsets(place.markers.length)[i] : undefined;
    card = { marker: place.markers[i]!, place, dx: offset?.dx ?? 0, dy: offset?.dy ?? 0 };
  }
  useLayoutEffect(placeCard, [placeCard, cardGuid]);

  // The sheet's character, the edge hint ("4 in Kalimdor") and the phone app bar's slot for the zone (WEB-28).
  const open = sheetMode && selected !== undefined ? placeOf(places, selected) : undefined;
  const hint = sheetMode && split !== undefined ? edgeHint(places, continent, split) : undefined;
  const titleSlot = open === undefined ? null : document.querySelector("[data-map-phone-title]");

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
            pick(undefined);
          }}
        >
          {children}
          <div className={styles.overlay}>
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
                      onSelect={pick}
                      onHover={hover}
                    />
                  ) : (
                    <ZoneCluster
                      place={place}
                      open={openZone === place.zone || (fan && (holdsSelection || level !== "world"))}
                      pinned={fan && level !== "world"}
                      onOpen={(open) => setOpenZone((z) => (open ? place.zone : z === place.zone ? undefined : z))}
                      selected={selected}
                      onSelect={pick}
                      onHover={hover}
                    />
                  )}
                </div>
              );
            })}
            {cardAnchor}
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

          onPanning={() => {
            dragged.current = true;
            byHand.current = true;
            resist();
          }}
          onWheel={() => {
            byHand.current = true;
          }}
          onPinch={() => {
            byHand.current = true;
          }}
        >
          <TransformWatch onApplied={onTransform} />
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
      {sheetMode && (
        <>
          {hint !== undefined && selected === undefined && (
            <button
              type="button"
              className={phoneStyles.hint}
              data-side={hint.side}
              onClick={() => frameContinent(hint.continent, true)}
            >
              <svg aria-hidden="true" viewBox="0 0 10 10" className={phoneStyles.chevron}>
                <path d={hint.side === "left" ? "M7 1L3 5l4 4" : "M3 1l4 4-4 4"} />
              </svg>
              {hint.label}
            </button>
          )}
          {selected === undefined && (
            <div className={phoneStyles.continent}>
              <FilterMenu
                name="Continent"
                kind="radio"
                label={CONTINENTS.find((c) => c.value === continent)!.label}
                active={false}
                items={CONTINENTS.map((c) => ({ key: c.value, label: c.label, checked: c.value === continent }))}
                onSelect={(key) => frameContinent(parseContinent(key), true)}
              />
            </div>
          )}
          <BottomSheet
            snap={snap}
            onSnap={(to) => {
              if (selectedNow.current !== undefined && to === "peek") closeSheet(true);
              else setSnap(to);
            }}
            handle={open === undefined ? { open: "Open roll call", collapse: "Collapse roll call" } : undefined}
          >
            {open === undefined ? (
              sheet
            ) : (
              <CharacterSheet
                key={open.marker.guid}
                marker={open.marker}
                next={open.next}
                onNext={(guid) => openInSheet(guid, "replace")}
                onClose={() => closeSheet(true)}
              />
            )}
          </BottomSheet>
          {open !== undefined &&
            titleSlot !== null &&
            createPortal(
              <>
                <span className={phoneStyles.title}>{open.place.zoneName}</span>
                <span className={phoneStyles.here}>{open.place.markers.length} here</span>
              </>,
              titleSlot,
            )}
        </>
      )}
    </>
  );
}
