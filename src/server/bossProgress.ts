import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { battleTagKey } from "@/core/access";
import { scheduleAt } from "@/core/doomsday/engine";
import { dayOf, dayStart } from "@/core/doomsday/rules";
import type { RunnableDungeon } from "@/core/gamedata";
import { BEFORE_START, type BossKill } from "@/core/runProgress";
import type { RunRecord } from "@/core/runs";
import { groupOf, type LatestUpload } from "@/core/views/bossProgress";
import type { CharacterView } from "@/core/views/characters";
import type { TooltipItem } from "@/core/views/recipes";
import { dungeonBossViews, type BossView } from "./bossViews";
import type { Db } from "./db";
import { bossKills, characterProfessions, characterRecipes, uploads } from "./db/schema";
import { doomsdayResetSetting, getBotSettings } from "./discord";
import { withCreated } from "./recipeViews";

// WEB-97, WEB-102: what the run page and the dungeon page read for boss progress: a dungeon's bosses (the item import,
// WEB-96), the stored kills (src/server/history.ts recordBossKills), the newest upload of a run's group and the daily
// reset after a run's start (the Doomsday day boundary, as the addon's Runs tab, CF-106).

/** A runnable dungeon's bosses in the client's order: a wing's own, or every wing's for a whole instance. */
export function dungeonBosses(db: Db, dungeon: RunnableDungeon): BossView[] {
  return dungeonBossViews(db, dungeon.instanceId, dungeon.wingId);
}

/** Every stored kill of these bosses, from `from` (inclusive) to `to` (exclusive) when given. */
export function killsOf(db: Db, encounterIds: readonly number[], from?: number, to?: number): BossKill[] {
  if (encounterIds.length === 0) return [];
  const where = [inArray(bossKills.encounterId, [...encounterIds])];
  if (from !== undefined) where.push(gte(bossKills.at, from));
  if (to !== undefined) where.push(lt(bossKills.at, to));
  return db
    .select({ guid: bossKills.guid, encounterId: bossKills.encounterId, at: bossKills.at })
    .from(bossKills)
    .where(and(...where))
    .all();
}

/** The first daily reset after a moment: the Doomsday day boundary in the realm's time zone. */
export function resetAfter(db: Db, at: number): number {
  const settings = getBotSettings(db);
  const s = scheduleAt(settings.realmTimeZone, doomsdayResetSetting(settings), at);
  return dayStart(dayOf(at, s) + 1, s);
}

/** The newest accepted upload by the owner of a character in the run's group, since an hour before its start. */
export function latestGroupUpload(
  db: Db,
  run: RunRecord,
  characters: readonly CharacterView[],
): LatestUpload | undefined {
  const group = groupOf(run);
  const owners = new Set(
    characters.filter((c) => group.has(c.guid) && c.owner !== undefined).map((c) => battleTagKey(c.owner!)),
  );
  for (const a of run.answers) if (a.guid !== undefined && group.has(a.guid)) owners.add(battleTagKey(a.battleTag));
  if (owners.size === 0) return undefined;
  const rows = db
    .select({ at: uploads.uploadedAt, by: uploads.uploadedBy })
    .from(uploads)
    .where(and(eq(uploads.status, "ok"), gte(uploads.uploadedAt, run.startsAt - BEFORE_START)))
    .orderBy(desc(uploads.uploadedAt))
    .limit(200)
    .all();
  return rows.find((r) => owners.has(battleTagKey(r.by)));
}

/** The dungeon page's Bosses & loot and boss progress (WEB-102, WEB-97). */
export function dungeonLootData(db: Db, dungeon: RunnableDungeon) {
  const bosses = dungeonBosses(db, dungeon);
  const recipeIds = [
    ...new Set(bosses.flatMap((b) => b.drops.flatMap((d) => (d.recipeId === undefined ? [] : [d.recipeId])))),
  ];
  const known =
    recipeIds.length === 0
      ? []
      : db
          .select({ guid: characterRecipes.guid, recipeId: characterRecipes.recipeId })
          .from(characterRecipes)
          .where(inArray(characterRecipes.recipeId, recipeIds))
          .all();
  const professions =
    recipeIds.length === 0
      ? []
      : db
          .select({
            guid: characterProfessions.guid,
            skillLineId: characterProfessions.skillLineId,
            skill: characterProfessions.skill,
          })
          .from(characterProfessions)
          .all();
  return {
    bosses: bosses.map((b) => ({
      ...b,
      drops: b.drops.map((d) => ({
        ...d,
        ...(d.item?.inventoryType !== undefined ? { inventoryType: d.item.inventoryType } : {}),
      })),
    })),
    known,
    professions,
    kills: killsOf(
      db,
      bosses.map((b) => b.id),
    ),
    // A recipe drop's tooltip shows the item it makes (WEB-104).
    items: withCreated(
      db,
      bosses.flatMap((b) =>
        b.drops.map((d) => {
          const t: TooltipItem = { id: d.itemId, data: d.item ?? { id: d.itemId } };
          if (d.name !== null) t.name = d.name;
          if (d.quality !== null) t.quality = d.quality;
          if (d.iconName !== null) t.icon = d.iconName;
          return t;
        }),
      ),
      new Map(
        bosses.flatMap((b) =>
          b.drops.flatMap((d): [number, number][] => (d.recipeId === undefined ? [] : [[d.itemId, d.recipeId]])),
        ),
      ),
    ),
  };
}
