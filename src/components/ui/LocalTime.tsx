"use client";

import { useSyncExternalStore } from "react";
import { clockTime } from "@/core/views/clock";
import { capitalize } from "@/core/views/text";

const subscribe = () => () => {};

/**
 * A clock time in the viewer's own time zone ("Today 21:14", "Thu 23 Oct, 23:40"; Nico, WEB-19). The server doesn't
 * know the viewer's zone, so it renders an empty <time> and the browser fills it in when the page hydrates.
 */
export function LocalTime({ at, capital = false }: { at: number; capital?: boolean }) {
  const text = useSyncExternalStore(
    subscribe,
    () => clockTime(at, Math.floor(Date.now() / 1000)),
    () => "",
  );
  return <time dateTime={new Date(at * 1000).toISOString()}>{capital ? capitalize(text) : text}</time>;
}
