import { logChange } from "./admins";
import type { Db } from "./db";
import { itemImport } from "./db/schema";
import { ImportError, importItems, type ImportOptions, type ImportSummary } from "./itemImport";

// The owner's "Import item data" on the admin page (WEB-91): the import of `npm run import:items`
// (src/server/itemImport.ts) run by the server, in the background, one at a time. The page shows what it is doing
// and how the last run ended. The state lives in this process (on globalThis, so Next's module copies share it): a
// restart forgets a run's error, never the data, which is in the database (`item_import`).

export interface ImportRunState {
  running: boolean;
  /** What the running import is doing. */
  step?: string;
  startedAt?: number;
  by?: string;
  /** How this process's last run ended. */
  last?: { at: number; summary: ImportSummary } | { at: number; error: string };
}

interface Holder {
  state: ImportRunState;
  done?: Promise<void>;
}

const KEY = Symbol.for("cf.itemImportRun");

function holder(): Holder {
  const g = globalThis as unknown as Record<symbol, Holder | undefined>;
  return (g[KEY] ??= { state: { running: false } });
}

export function importRunState(): ImportRunState {
  return { ...holder().state };
}

/** The last import that wrote the database (any process, the command line too). */
export function lastImport(db: Db) {
  return db.select().from(itemImport).get();
}

/**
 * Starts an import unless one is running; false when one is. Logs it in Admin changes when it wrote new data.
 * `options` are for tests (a fake fetch, a cache folder).
 */
export function startItemImport(db: Db, by: string, now: number, options: ImportOptions = {}): boolean {
  const h = holder();
  if (h.state.running) return false;
  h.state = { running: true, step: "Starting", startedAt: now, by, ...(h.state.last ? { last: h.state.last } : {}) };
  h.done = (async () => {
    try {
      const summary = await importItems(db, {
        ...options,
        now,
        onStep: (step) => {
          h.state = { ...h.state, step };
        },
      });
      if (summary.changed) logChange(db, by, "itemImport", Math.floor(Date.now() / 1000), undefined, summary.build);
      h.state = { running: false, last: { at: Math.floor(Date.now() / 1000), summary } };
    } catch (e) {
      // Our own errors say what went wrong; anything else is a bug: a short line, details in the server log.
      if (!(e instanceof ImportError)) console.error("Item import failed", e);
      const error = e instanceof ImportError ? e.message : "Something went wrong; the server log has the details.";
      h.state = { running: false, last: { at: Math.floor(Date.now() / 1000), error } };
    }
  })();
  return true;
}

/** Tests: waits for the running import, if any. */
export async function importFinished(): Promise<void> {
  await holder().done;
}
