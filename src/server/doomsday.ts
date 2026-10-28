import type { DoomsdaySnapshot } from "@/core/doomsday/snapshot";
import { peopleViews } from "@/core/views/characters";
import type { Db } from "./db";
import { doomsdaySample } from "./doomsdaySample";
import { loadState } from "./uploads";

// Doomsday for the pages (WEB-59..61). The engine (WEB-58) computes it from the stored uploads; until it lands there is
// no Doomsday data, except the made-up sample on the test servers (DOOMSDAY_SAMPLE=1).

/** Undefined before any Doomsday data. */
export function loadDoomsday(
  db: Db,
  now: number,
  env: Record<string, string | undefined> = process.env,
): DoomsdaySnapshot | undefined {
  const data = loadState(db)?.data;
  if (data === undefined) return undefined;
  if (env.DOOMSDAY_SAMPLE === "1") return doomsdaySample(peopleViews(data, now), now);
  return undefined;
}
