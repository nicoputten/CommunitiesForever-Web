import { eq } from "drizzle-orm";
import { siteName } from "@/core/views";
import { adminBattleTag } from "@/server/access";
import { getDb } from "@/server/db";
import { meta, uploads } from "@/server/db/schema";

// What the shell shows about the data: the site name and when the last upload was.

export interface SiteInfo {
  name: string;
  /** Unix seconds of the newest accepted upload; undefined before the first one. */
  lastUploadAt?: number;
}

export function getSiteInfo(): SiteInfo {
  const db = getDb();
  const ok = db
    .select({ uploadedBy: uploads.uploadedBy, uploadedAt: uploads.uploadedAt })
    .from(uploads)
    .where(eq(uploads.status, "ok"))
    .all();
  // Uploads do not store their own clubName yet, so every upload carries the merged community name (WEB-06 makes
  // every accepted upload the same community). siteName() still picks the admin's uploads only.
  const communityName = db.select().from(meta).where(eq(meta.id, 1)).get()?.data.community.name;
  const admin = adminBattleTag() ?? "";
  const name = siteName(
    ok.map((u) => ({ ...u, communityName })),
    admin,
  );
  const lastUploadAt = ok.reduce<number | undefined>((max, u) => Math.max(max ?? 0, u.uploadedAt), undefined);
  return lastUploadAt === undefined ? { name } : { name, lastUploadAt };
}
