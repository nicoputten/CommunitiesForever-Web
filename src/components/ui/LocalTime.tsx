"use client";

import { useSyncExternalStore } from "react";
import { clockTime, clockTimeAt } from "@/core/views/clock";
import { capitalize } from "@/core/views/text";

const subscribe = () => () => {};

/**
 * A clock time in the viewer's own time zone ("Today 21:14", "Thu 23 Oct, 23:40"; Nico, WEB-19). The server doesn't
 * know the viewer's zone, so it renders an empty <time> and the browser fills it in when the page hydrates.
 */
export function LocalTime({
  at,
  capital = false,
  phrase = false,
}: {
  at: number;
  capital?: boolean;
  /** "today at 21:14", "on Thu 23 Oct at 23:40": after "uploaded" (WEB-20). */
  phrase?: boolean;
}) {
  const text = useSyncExternalStore(
    subscribe,
    () => (phrase ? clockTimeAt : clockTime)(at, Math.floor(Date.now() / 1000)),
    () => "",
  );
  return <time dateTime={new Date(at * 1000).toISOString()}>{capital ? capitalize(text) : text}</time>;
}
