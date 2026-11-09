import { eq } from "drizzle-orm";
import type { ClassTalentsRecord } from "@/core/talents/build";
import type { Db } from "./db";
import { talentTrees } from "./db/schema";

// WEB-100: a class's talent trees as the item import wrote them (src/core/talents/build.ts). Only reads.

/** The class's trees; undefined before an import that has them, or for an unknown class. */
export function classTalents(db: Db, classFile: string | undefined): ClassTalentsRecord | undefined {
  if (classFile === undefined) return undefined;
  return db.select({ data: talentTrees.data }).from(talentTrees).where(eq(talentTrees.classFile, classFile)).get()
    ?.data;
}
