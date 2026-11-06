"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import missions from "@/components/missions/MissionPool.module.css";
import styles from "./CoAdmins.module.css";
import { RefusedLine } from "./CoAdmins";

type Action = () => Promise<void>;

/** How often the page asks again while an import runs. */
const REFRESH_MS = 2000;

/**
 * The owner's Item data box (WEB-91, no board; the Probe results box's entry look and button): what the last import
 * brought, "Import item data", and while it runs what it is doing (the page refreshes itself until it is done). A
 * failed run says why.
 */
export function ItemImport({
  line,
  running,
  error,
  action,
}: {
  /** The last import, or what the running one is doing, already formatted. */
  line: ReactNode;
  running: boolean;
  error?: string;
  action: Action;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!running) return;
    const refresh = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(refresh);
  }, [running, router]);
  return (
    <div className={missions.entry}>
      <p className={styles.hint} data-testid="item-import-line" role={running ? "status" : undefined}>
        {line}
      </p>
      {error !== undefined && !running && <RefusedLine>Import failed: {error}</RefusedLine>}
      {!running && (
        <form action={action}>
          <button type="submit" className={`${missions.button} ${missions.secondary}`}>
            Import item data
          </button>
        </form>
      )}
    </div>
  );
}
