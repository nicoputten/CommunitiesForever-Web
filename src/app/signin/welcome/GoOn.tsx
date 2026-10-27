"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** How long "Checking the guest list…" stays before going on (WEB-17, Nico: about a second). */
const SHOW_MS = 1000;

/** Goes on to `to` after a moment, replacing the welcome step in the history. */
export function GoOn({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setTimeout(() => router.replace(to), SHOW_MS);
    return () => clearTimeout(timer);
  }, [router, to]);
  return null;
}
