import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { launchCutoff } from "./db/schema";

// The launch cut-off (WEB-62): the stored moment. The rebuild (src/server/uploads.ts) and the readers of runs, asks
// and recaps use it; the admin page sets it and takes it back (Undo), each followed by a rebuild.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface Cutoff {
  at: number;
  setBy: string;
  setAt: number;
}

export function getCutoff(db: Db | Tx): Cutoff | undefined {
  return db.select().from(launchCutoff).where(eq(launchCutoff.id, 1)).get();
}

/** The cut-off moment, or 0 without one (so `>= cutoffAt(db)` keeps everything). */
export function cutoffAt(db: Db | Tx): number {
  return getCutoff(db)?.at ?? 0;
}

export function storeCutoff(db: Db, at: number, by: string, now: number): void {
  const row = { at, setBy: by, setAt: now };
  db.insert(launchCutoff)
    .values({ id: 1, ...row })
    .onConflictDoUpdate({ target: launchCutoff.id, set: row })
    .run();
}

export function clearCutoff(db: Db): void {
  db.delete(launchCutoff).where(eq(launchCutoff.id, 1)).run();
}
