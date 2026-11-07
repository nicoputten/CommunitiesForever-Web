import { and, asc, eq, inArray } from "drizzle-orm";
import { dungeonById } from "@/core/gamedata/dungeons";
import { addonLootLua } from "@/core/recipes/addonLoot";
import type { BossDropRecord, BossRecord } from "@/core/recipes/bosses";
import type { ItemRecord } from "@/core/recipes/build";
import type { Db } from "./db";
import { bossDrops, dungeonBosses, itemImport, items } from "./db/schema";

// WEB-96: what the dungeon page (WEB-102, board DL04) and the addon's loot file read from the bosses and boss drops
// the item import writes (src/core/recipes/bosses.ts). Only reads rows. Imported by scripts/export-addon-loot.ts
// (Node's type stripping): no enums or parameter properties here.

export interface BossDropView extends BossDropRecord {
  /** The item's name, quality and icon (items), null when the import has no name for it. */
  name: string | null;
  quality: number | null;
  iconName: string | null;
  /** The tooltip fields (slot, type name, stats...); undefined when the item isn't in the items table. */
  item?: ItemRecord;
}

export interface BossView extends BossRecord {
  /** Highest chance first: every drop >= 1 % plus quest items and recipes. Show 6, then "Show N more". */
  drops: BossDropView[];
}

function bossRecord(r: typeof dungeonBosses.$inferSelect): BossRecord {
  const b: BossRecord = {
    id: r.id,
    name: r.name,
    dungeonId: r.dungeonId,
    position: r.position,
    final: r.final,
    optional: r.optional,
  };
  if (r.wingId !== null) b.wingId = r.wingId;
  return b;
}

function dropRecord(r: typeof bossDrops.$inferSelect): BossDropRecord {
  const d: BossDropRecord = { bossId: r.bossId, itemId: r.itemId, position: r.position, chance: r.chance };
  if (r.classId !== null) d.classId = r.classId;
  if (r.subclassId !== null) d.subclassId = r.subclassId;
  if (r.classes !== null) d.classes = r.classes;
  if (r.questId !== null) d.questId = r.questId;
  if (r.recipeId !== null) d.recipeId = r.recipeId;
  if (r.skill !== null) d.skill = r.skill;
  if (r.line !== null) d.line = r.line;
  return d;
}

/**
 * The bosses of a dungeon in the client's order, each with its drops. With `wingId` only that wing's (Scarlet
 * Monastery: "graveyard", "library", "armory", "cathedral"; Blackrock Spire: "lower", "upper"); without it, every
 * boss of the dungeon, wing by wing. Empty before the first import with bosses (WEB-96).
 */
export function dungeonBossViews(db: Db, dungeonId: string, wingId?: string): BossView[] {
  const where =
    wingId === undefined
      ? eq(dungeonBosses.dungeonId, dungeonId)
      : and(eq(dungeonBosses.dungeonId, dungeonId), eq(dungeonBosses.wingId, wingId));
  const bosses = db.select().from(dungeonBosses).where(where).all().map(bossRecord);
  // Wings in the dungeon's order (src/core/gamedata/dungeons.ts), then the client's order.
  const wings = dungeonById(dungeonId)?.wings?.map((w) => w.id) ?? [];
  bosses.sort(
    (a, b) => wings.indexOf(a.wingId ?? "") - wings.indexOf(b.wingId ?? "") || a.position - b.position || a.id - b.id,
  );
  if (bosses.length === 0) return [];
  const drops = db
    .select({
      drop: bossDrops,
      name: items.name,
      quality: items.quality,
      iconName: items.iconName,
      data: items.data,
    })
    .from(bossDrops)
    .leftJoin(items, eq(items.id, bossDrops.itemId))
    .where(
      inArray(
        bossDrops.bossId,
        bosses.map((b) => b.id),
      ),
    )
    .orderBy(asc(bossDrops.bossId), asc(bossDrops.position))
    .all();
  const byBoss = new Map<number, BossDropView[]>();
  for (const r of drops) {
    const view: BossDropView = {
      ...dropRecord(r.drop),
      name: r.name ?? null,
      quality: r.quality ?? null,
      iconName: r.iconName ?? null,
    };
    if (r.data !== null) view.item = r.data;
    (byBoss.get(view.bossId) ?? byBoss.set(view.bossId, []).get(view.bossId)!).push(view);
  }
  return bosses.map((b) => ({ ...b, drops: byBoss.get(b.id) ?? [] }));
}

/** The addon's `Data\Loot.lua` from the last import; undefined before the first import. */
export function addonLootFile(db: Db): string | undefined {
  const meta = db.select().from(itemImport).get();
  if (meta === undefined) return undefined;
  return addonLootLua({
    build: meta.build,
    cmangos: meta.cmangos,
    bosses: db.select().from(dungeonBosses).all().map(bossRecord),
    drops: db.select().from(bossDrops).all().map(dropRecord),
  });
}
