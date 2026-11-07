import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { ItemDatabase } from "@/core/recipes/build";
import type { Db } from "./db";
import { bossDrops, dungeonBosses, itemImport, items, recipeReagents, recipes, recipeSources } from "./db/schema";

// WEB-90 (run by scripts/import-items.ts, so it imports nothing that Node's type stripping can't load): writes the item and recipe database the import script built (src/core/recipes/build.ts). One transaction;
// the same data again changes nothing. Rows of Forever's own that only uploads brought (origin "upload") stay until
// the import has the same ID, which then replaces them. Not derived from uploads: a rebuild never touches it.

export interface ImportMeta {
  build: string;
  era: string;
  cmangos: string;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function insertAll<T>(rows: T[], insert: (slice: T[]) => void): void {
  for (let i = 0; i < rows.length; i += 200) insert(rows.slice(i, i + 200));
}

export function writeItemDatabase(db: Db, data: ItemDatabase, meta: ImportMeta, now: number): { changed: boolean } {
  // The build is deterministic (sorted by ID), so its JSON is stable.
  const hash = createHash("sha256").update(JSON.stringify({ data, meta })).digest("hex");
  return db.transaction((tx) => {
    if (tx.select({ hash: itemImport.hash }).from(itemImport).get()?.hash === hash) return { changed: false };
    tx.delete(items).where(eq(items.origin, "import")).run();
    tx.delete(recipes).where(eq(recipes.origin, "import")).run();
    tx.delete(recipeReagents).run();
    tx.delete(recipeSources).run();
    tx.delete(dungeonBosses).run();
    tx.delete(bossDrops).run();
    replaceUploaded(
      tx,
      data.items.map((i) => i.id),
      data.recipes.map((r) => r.id),
    );
    insertAll(data.items, (slice) =>
      tx
        .insert(items)
        .values(
          slice.map((i) => ({
            id: i.id,
            name: i.name ?? null,
            quality: i.quality ?? null,
            iconName: i.iconName ?? null,
            data: i,
            origin: "import" as const,
          })),
        )
        .run(),
    );
    insertAll(data.recipes, (slice) =>
      tx
        .insert(recipes)
        .values(
          slice.map((r) => ({
            id: r.id,
            name: r.name ?? null,
            skillLineId: r.skillLineId,
            createdItemId: r.createdItemId ?? null,
            orange: r.orange,
            yellow: r.yellow,
            green: r.green,
            grey: r.grey,
            category: r.category ?? null,
            obtainable: r.obtainable,
            foreverOnly: r.foreverOnly,
            origin: "import" as const,
          })),
        )
        .run(),
    );
    // A reagent listed twice for one recipe counts once with both counts.
    const reagents = new Map<string, { recipeId: number; itemId: number; count: number }>();
    for (const r of data.reagents) {
      const key = `${r.recipeId}:${r.itemId}`;
      const was = reagents.get(key);
      reagents.set(key, { ...r, count: (was?.count ?? 0) + r.count });
    }
    insertAll([...reagents.values()], (slice) => tx.insert(recipeReagents).values(slice).run());
    insertAll(data.sources, (slice) =>
      tx
        .insert(recipeSources)
        .values(
          slice.map((s) => ({
            recipeId: s.recipeId,
            kind: s.kind,
            place: s.place ?? null,
            npc: s.npc ?? null,
            quest: s.quest ?? null,
            faction: s.faction ?? null,
            rank: s.rank ?? null,
            isRare: s.isRare,
          })),
        )
        .run(),
    );
    // WEB-96: bosses and their own loot.
    insertAll(data.bosses, (slice) =>
      tx
        .insert(dungeonBosses)
        .values(
          slice.map((b) => ({
            id: b.id,
            dungeonId: b.dungeonId,
            wingId: b.wingId ?? null,
            position: b.position,
            name: b.name,
            final: b.final,
            optional: b.optional,
          })),
        )
        .run(),
    );
    insertAll(data.bossDrops, (slice) =>
      tx
        .insert(bossDrops)
        .values(
          slice.map((d) => ({
            bossId: d.bossId,
            itemId: d.itemId,
            position: d.position,
            chance: d.chance,
            classId: d.classId ?? null,
            subclassId: d.subclassId ?? null,
            classes: d.classes ?? null,
            questId: d.questId ?? null,
            recipeId: d.recipeId ?? null,
          })),
        )
        .run(),
    );
    tx.delete(itemImport).run();
    tx.insert(itemImport)
      .values({
        id: 1,
        build: meta.build,
        eraBuild: meta.era,
        cmangos: meta.cmangos,
        importedAt: now,
        items: data.items.length,
        recipes: data.recipes.length,
        hash,
      })
      .run();
    return { changed: true };
  });
}

/** Upload-only rows (Forever's own) the import now has: the import's row replaces them. */
function replaceUploaded(tx: Tx, itemIds: number[], recipeIds: number[]): void {
  insertAll(itemIds, (slice) => tx.delete(items).where(inArray(items.id, slice)).run());
  insertAll(recipeIds, (slice) => tx.delete(recipes).where(inArray(recipes.id, slice)).run());
}
