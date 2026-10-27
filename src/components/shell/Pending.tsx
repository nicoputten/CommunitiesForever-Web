"use client";

import { useLinkStatus } from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { LoadingLine } from "@/components/ui/LoadingLine";

// The thin gold line while a page loads (loading board, WEB-29). Pages render on the server, so "loading" is a
// navigation that hasn't arrived yet: the shell's links report it, the shell draws one line under the top bar. No
// route loading.tsx, so a page's own status (404) and the map's first paint stay as they are.

const Report = createContext<(pending: boolean) => void>(() => {});

/** Around the shell: draws the line while any link reports a pending navigation. */
export function PendingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const report = useCallback((pending: boolean) => setCount((c) => c + (pending ? 1 : -1)), []);
  return (
    <Report value={report}>
      {children}
      {count > 0 && <LoadingLine />}
    </Report>
  );
}

/** Inside a Link: reports its navigation while it is pending. Renders nothing. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  const report = useContext(Report);
  useEffect(() => {
    if (!pending) return;
    report(true);
    return () => report(false);
  }, [pending, report]);
  return null;
}
