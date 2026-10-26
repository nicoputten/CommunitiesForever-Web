// The "Motion" setting (WEB-16, DESIGN.md §6). Stored per browser in localStorage; absent means "follow the system"
// (prefers-reduced-motion). It is applied as <html data-motion="on|off">, which the ambient CSS reads, and set before
// first paint by MOTION_SCRIPT so a reload never flashes motion. While the tab is hidden <html data-tab="hidden">
// pauses every ambient loop.

export type MotionSetting = "on" | "off";

export const MOTION_KEY = "cf-motion";
const REDUCE = "(prefers-reduced-motion: reduce)";
const CHANGE = "cf-motion-change";

/**
 * Inline in <head> (root layout), before any CSS paints: copies a stored setting onto <html>. A constant, never data.
 * Keep in sync with readStored/apply below.
 */
export const MOTION_SCRIPT = `try{var m=localStorage.getItem(${JSON.stringify(MOTION_KEY)});if(m==="on"||m==="off")document.documentElement.dataset.motion=m}catch(e){}`;

function readStored(): MotionSetting | undefined {
  try {
    const value = localStorage.getItem(MOTION_KEY);
    return value === "on" || value === "off" ? value : undefined;
  } catch {
    // Storage blocked (private mode, site data off): follow the system.
    return undefined;
  }
}

function apply(setting: MotionSetting | undefined) {
  const root = document.documentElement;
  if (setting === undefined) delete root.dataset.motion;
  else root.dataset.motion = setting;
}

/** Whether ambient motion runs now: the stored setting, else the system's. */
export function motionOn(): boolean {
  const setting = document.documentElement.dataset.motion;
  if (setting === "on") return true;
  if (setting === "off") return false;
  return !window.matchMedia(REDUCE).matches;
}

/** Stores and applies an explicit choice. Storage failing still changes this page. */
export function setMotion(on: boolean) {
  const setting: MotionSetting = on ? "on" : "off";
  try {
    localStorage.setItem(MOTION_KEY, setting);
  } catch {
    // Not stored; applies to this page only.
  }
  apply(setting);
  window.dispatchEvent(new Event(CHANGE));
}

/** For useSyncExternalStore: the system setting, another tab's choice and setMotion all notify. */
export function subscribeMotion(notify: () => void): () => void {
  const media = window.matchMedia(REDUCE);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== MOTION_KEY && e.key !== null) return;
    apply(readStored());
    notify();
  };
  media.addEventListener("change", notify);
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE, notify);
  return () => {
    media.removeEventListener("change", notify);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE, notify);
  };
}

/** Pauses the ambient loops while the tab is hidden; returns the cleanup. */
export function pauseWhenHidden(): () => void {
  const root = document.documentElement;
  const sync = () => {
    if (document.hidden) root.dataset.tab = "hidden";
    else delete root.dataset.tab;
  };
  sync();
  document.addEventListener("visibilitychange", sync);
  return () => document.removeEventListener("visibilitychange", sync);
}
