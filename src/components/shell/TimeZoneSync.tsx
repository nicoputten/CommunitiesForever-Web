"use client";

import { useEffect } from "react";

/**
 * Sends the browser's time zone once, while the signed-in user has none stored (WEB-39): rendered by the site layout
 * only then. The server keeps it only if still none is stored; the Discord page changes it.
 */
export function TimeZoneSync({ action }: { action: (timeZone: string) => Promise<void> }) {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) void action(tz).catch(() => undefined);
  }, [action]);
  return null;
}
