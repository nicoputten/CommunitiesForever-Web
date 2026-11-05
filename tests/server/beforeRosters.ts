import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { membersBefore } from "@/server/db/schema";

/**
 * A site as it was before WEB-85: every upload without a roster (the fixtures here have none) makes every BattleTag it
 * names a member, as if all of them came before the first roster. For tests about other things than who is a member;
 * tests/server/members.test.ts tests the roster rule itself.
 */
export function beforeRosters(db: Db): Db {
  db.update(membersBefore).set({ lastUpload: Number.MAX_SAFE_INTEGER }).where(eq(membersBefore.id, 1)).run();
  return db;
}
