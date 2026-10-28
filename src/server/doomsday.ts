import type { DoomsdaySnapshot } from "@/core/doomsday/snapshot";
import { peopleViews } from "@/core/views/characters";
import type { Db } from "./db";
import { doomsdayFor } from "./doomsdayEngine";
import { doomsdaySample } from "./doomsdaySample";
import { loadState } from "./uploads";

// Doomsday for the pages (WEB-59..61): the engine's snapshot from the stored uploads (WEB-58). The test servers set
// DOOMSDAY_SAMPLE=1 for the made-up sample until the design sample uploads `goals`.

/** Undefined before any Doomsday data. */
export function loadDoomsday(
  db: Db,
  now: number,
  env: Record<string, string | undefined> = process.env,
): DoomsdaySnapshot | undefined {
  if (env.DOOMSDAY_SAMPLE === "1") {
    const data = loadState(db)?.data;
    return data === undefined ? undefined : doomsdaySample(peopleViews(data, now), now);
  }
  return doomsdayFor(db, now);
}
