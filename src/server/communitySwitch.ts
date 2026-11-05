import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "./db";
import { communitySwitches, uploads } from "./db/schema";

// Switching the community (WEB-83): the owner moves the site to another in-game community (another `settings.clubId`,
// for example from the guild to a real community once Blizzard allows one) without hiding anything. A switch makes the
// community "not set" for the uploads after it; the owner's next accepted upload sets the new one, as after the launch
// cut-off (WEB-74). The upload check and the rebuild (src/server/uploads.ts) read the stored switches. Old databases
// have none: the community is then exactly as before.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface CommunitySwitch {
  id: number;
  /** The newest upload id when it was pressed: uploads after it start without a community. */
  afterUpload: number;
  setBy: string;
  setAt: number;
}

/** Every switch, oldest first (the rebuild walks them alongside the uploads). */
export function listSwitches(db: Db | Tx): CommunitySwitch[] {
  return db
    .select()
    .from(communitySwitches)
    .orderBy(asc(communitySwitches.afterUpload), asc(communitySwitches.id))
    .all();
}

/** The newest switch, or undefined when the community was never switched. */
export function latestSwitch(db: Db | Tx): CommunitySwitch | undefined {
  return db.select().from(communitySwitches).orderBy(desc(communitySwitches.id)).get();
}

/** The upload id after which the community starts anew because of a switch; 0 without one. */
export function switchedAfter(db: Db | Tx): number {
  return latestSwitch(db)?.afterUpload ?? 0;
}

/** Stores a switch now: every upload from here on starts without a community until the owner's next one. */
export function storeSwitch(db: Db | Tx, by: string, now: number): CommunitySwitch {
  const newest = db.select({ id: uploads.id }).from(uploads).orderBy(desc(uploads.id)).get()?.id ?? 0;
  return db.insert(communitySwitches).values({ afterUpload: newest, setBy: by, setAt: now }).returning().get();
}

/** Takes a switch back (Undo). The caller checks that the owner hasn't set a new community since. */
export function removeSwitch(db: Db | Tx, id: number): boolean {
  return db.delete(communitySwitches).where(eq(communitySwitches.id, id)).run().changes > 0;
}
