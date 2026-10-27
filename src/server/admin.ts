import { eq } from "drizzle-orm";
import { adminView, type AdminView } from "@/core/views/admin";
import { adminBattleTag, listBlocks, listGuests, listLastSeen } from "./access";
import type { Db } from "./db";
import { blocks, members, uploads } from "./db/schema";
import { displayNames } from "./uploads";

// The admin page's data (WEB-18): members with the upload that added them, the guest list, blocks, last seen.

export function loadAdminView(db: Db, now: number, admin = adminBattleTag()): AdminView {
  const blocked = new Set(
    db
      .select({ key: blocks.key })
      .from(blocks)
      .all()
      .map((r) => r.key),
  );
  const rows = db
    .select({
      key: members.key,
      battleTag: members.battleTag,
      id: uploads.id,
      uploadedAt: uploads.uploadedAt,
      uploadedBy: uploads.uploadedBy,
    })
    .from(members)
    .innerJoin(uploads, eq(members.firstUpload, uploads.id))
    .all();
  return adminView(
    {
      admin,
      members: rows.map((r) => ({
        battleTag: r.battleTag,
        blocked: blocked.has(r.key),
        firstUpload: { id: r.id, uploadedAt: r.uploadedAt, uploadedBy: r.uploadedBy },
      })),
      guests: listGuests(db),
      blocks: listBlocks(db),
      names: displayNames(db),
      lastSeen: listLastSeen(db),
    },
    now,
  );
}
