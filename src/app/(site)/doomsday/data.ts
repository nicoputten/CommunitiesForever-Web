import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { getViewer } from "@/app/viewer";
import { sameBattleTag } from "@/core/access";
import type { DoomsdaySnapshot } from "@/core/doomsday/snapshot";
import { peopleViews } from "@/core/views/characters";
import { doomsdayPage, type DoomsdayPage } from "@/core/views/doomsday";
import { getDb } from "@/server/db";
import { effectiveTimeZone } from "@/server/discord";
import { loadDoomsday } from "@/server/doomsday";
import { loadState } from "@/server/uploads";

export interface DoomsdayContext {
  snapshot: DoomsdaySnapshot;
  viewerKey?: string;
  timeZone: string;
  /** The header, Today, Week and the board (WEB-59). */
  page: DoomsdayPage;
}

/** Doomsday for the signed-in viewer (WEB-59, WEB-60); undefined before any Doomsday data. */
export async function doomsdayContext(): Promise<DoomsdayContext | undefined> {
  const viewer = await getViewer();
  if (viewer === undefined) notFound();
  const db = getDb();
  const now = nowSeconds();
  const snapshot = loadDoomsday(db, now);
  if (snapshot === undefined) return undefined;
  const data = loadState(db)?.data;
  const me =
    data === undefined ? undefined : peopleViews(data, now).find((p) => sameBattleTag(p.battleTag, viewer.battleTag));
  const timeZone = effectiveTimeZone(db, viewer.battleTag);
  const viewerKey = me?.key;
  return {
    snapshot,
    ...(viewerKey === undefined ? {} : { viewerKey }),
    timeZone,
    page: doomsdayPage({ snapshot, timeZone, ...(viewerKey === undefined ? {} : { viewerKey }) }),
  };
}

/** The Doomsday page's view for the signed-in viewer (WEB-59); undefined before any Doomsday data. */
export async function doomsdayData(): Promise<DoomsdayPage | undefined> {
  return (await doomsdayContext())?.page;
}
