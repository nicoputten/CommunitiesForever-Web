import { and, eq, inArray } from "drizzle-orm";
import type { Character, Dataset } from "@/core/model";
import { isRareRecipe, learnRecipes } from "@/core/recipes/learned";
import type { Db } from "./db";
import {
  characterProfessions,
  characterRecipes,
  characterRecipeScans,
  items,
  recipeFinds,
  recipes,
  recipeSources,
} from "./db/schema";

// WEB-90 (handoff B4): who knows which recipe, from every accepted upload in its transaction and in upload order, so
// a rebuild holds the same again (src/server/uploads.ts). The rare finds an upload brings are written for the bot's
// feed (Part D) only by the live upload, never by a rebuild.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface RecipeUpload {
  id: number;
  uploadedAt: number;
}

/** What the recipes of an upload changed. */
export interface RecipeChanges {
  /** Newly learned (not baseline) recipes per character GUID. */
  learned: Record<string, number[]>;
  /** The rare finds among them, per character GUID. */
  rare: Record<string, number[]>;
}

/** The derived recipe tables, emptied before a rebuild replays the uploads. */
export function clearRecipes(tx: Tx): void {
  tx.delete(characterProfessions).run();
  tx.delete(characterRecipes).run();
  tx.delete(characterRecipeScans).run();
}

function chunks<T>(list: T[], each: (slice: T[]) => void): void {
  for (let i = 0; i < list.length; i += 200) each(list.slice(i, i + 200));
}

/**
 * Brings the recipe tables in line with the merged data after an upload. A character whose record has no `recipes`
 * (older addons, or a relay that lacks them) keeps what is stored. `live`: the upload itself (writes rare finds).
 */
export function recordRecipes(tx: Tx, upload: RecipeUpload, after: Dataset, live: boolean): RecipeChanges {
  const changes: RecipeChanges = { learned: {}, rare: {} };
  const characters = Object.values(after.characters).filter((c) => c.hasRecord);
  const present = new Set(characters.map((c) => c.guid));

  // Characters no longer in the data take their rows with them.
  const storedGuids = new Set([
    ...tx
      .select({ guid: characterRecipeScans.guid })
      .from(characterRecipeScans)
      .all()
      .map((r) => r.guid),
    ...tx
      .select({ guid: characterProfessions.guid })
      .from(characterProfessions)
      .all()
      .map((r) => r.guid),
  ]);
  const gone = [...storedGuids].filter((g) => !present.has(g));
  chunks(gone, (slice) => {
    tx.delete(characterProfessions).where(inArray(characterProfessions.guid, slice)).run();
    tx.delete(characterRecipes).where(inArray(characterRecipes.guid, slice)).run();
    tx.delete(characterRecipeScans).where(inArray(characterRecipeScans.guid, slice)).run();
  });

  const lineOf = new Map<number, number | null>();
  const skillLine = (recipe: number, c: Character): number | undefined => {
    if (!lineOf.has(recipe)) {
      lineOf.set(
        recipe,
        tx.select({ line: recipes.skillLineId }).from(recipes).where(eq(recipes.id, recipe)).get()?.line ?? null,
      );
    }
    return lineOf.get(recipe) ?? c.recipeLines?.[String(recipe)];
  };

  for (const c of characters) {
    const scannedProfessions = syncProfessions(tx, c);
    if (c.recipes === undefined) continue;
    const scan = tx.select().from(characterRecipeScans).where(eq(characterRecipeScans.guid, c.guid)).get();
    const stored = new Map<number, number | undefined>();
    for (const r of tx
      .select({ recipe: characterRecipes.recipeId })
      .from(characterRecipes)
      .where(eq(characterRecipes.guid, c.guid))
      .all()) {
      stored.set(r.recipe, skillLine(r.recipe, c));
    }
    const result = learnRecipes({
      uploaded: c.recipes,
      stored,
      scannedBefore: scan !== undefined,
      scannedProfessions,
      skillLineOf: (recipe) => skillLine(recipe, c),
    });
    rememberUploaded(tx, c, result.added);
    const seenAt = c.recipesAt ?? upload.uploadedAt;
    chunks(result.added, (slice) =>
      tx
        .insert(characterRecipes)
        .values(
          slice.map((a) => ({
            guid: c.guid,
            recipeId: a.recipe,
            itemId: a.item,
            firstSeenAt: seenAt,
            baseline: a.baseline,
            uploadId: upload.id,
          })),
        )
        .run(),
    );
    chunks(result.removed, (slice) =>
      tx
        .delete(characterRecipes)
        .where(and(eq(characterRecipes.guid, c.guid), inArray(characterRecipes.recipeId, slice)))
        .run(),
    );
    if (scan === undefined) {
      tx.insert(characterRecipeScans)
        .values({
          guid: c.guid,
          owner: c.owner ?? null,
          recipesAt: c.recipesAt ?? null,
          firstUploadId: upload.id,
          uploadId: upload.id,
        })
        .run();
    } else if (
      scan.recipesAt !== (c.recipesAt ?? null) ||
      scan.owner !== (c.owner ?? null) ||
      result.added.length > 0
    ) {
      tx.update(characterRecipeScans)
        .set({ owner: c.owner ?? null, recipesAt: c.recipesAt ?? null, uploadId: upload.id })
        .where(eq(characterRecipeScans.guid, c.guid))
        .run();
    }

    const learned = result.added.filter((a) => !a.baseline).map((a) => a.recipe);
    if (learned.length === 0) continue;
    changes.learned[c.guid] = learned;
    const rare = learned.filter((recipe) =>
      isRareRecipe(
        tx
          .select({ kind: recipeSources.kind, isRare: recipeSources.isRare })
          .from(recipeSources)
          .where(eq(recipeSources.recipeId, recipe))
          .all(),
      ),
    );
    if (rare.length === 0) continue;
    changes.rare[c.guid] = rare;
    if (!live) continue;
    tx.insert(recipeFinds)
      .values(
        rare.map((recipeId) => ({
          uploadId: upload.id,
          guid: c.guid,
          owner: c.owner ?? null,
          recipeId,
          at: upload.uploadedAt,
        })),
      )
      .onConflictDoNothing()
      .run();
  }
  return changes;
}

/**
 * The character's professions as its record has them. A field the record lacks (an older addon's relay) keeps the
 * stored value. Returns the skill lines that had been scanned before this upload.
 */
function syncProfessions(tx: Tx, c: Character): Set<number> {
  const stored = new Map(
    tx
      .select()
      .from(characterProfessions)
      .where(eq(characterProfessions.guid, c.guid))
      .all()
      .map((r) => [r.skillLineId, r]),
  );
  const scanned = new Set<number>();
  for (const [line, row] of stored) if (row.scannedAt !== null) scanned.add(line);
  const listed = new Set<number>();
  for (const [key, p] of Object.entries(c.professions)) {
    const line = Number(key);
    if (!Number.isInteger(line) || line <= 0) continue;
    listed.add(line);
    const was = stored.get(line);
    const row = {
      guid: c.guid,
      skillLineId: line,
      owner: c.owner ?? null,
      name: p.name ?? was?.name ?? null,
      skill: p.rank ?? null,
      max: p.max ?? null,
      spec: p.spec ?? was?.spec ?? null,
      link: p.link ?? was?.link ?? null,
      linkType: p.linkType ?? was?.linkType ?? null,
      scannedAt: Math.max(p.scannedAt ?? 0, was?.scannedAt ?? 0) || null,
    };
    if (was === undefined) {
      tx.insert(characterProfessions).values(row).run();
    } else if (JSON.stringify({ ...was }) !== JSON.stringify({ ...was, ...row })) {
      tx.update(characterProfessions)
        .set(row)
        .where(and(eq(characterProfessions.guid, c.guid), eq(characterProfessions.skillLineId, line)))
        .run();
    }
  }
  const dropped = [...stored.keys()].filter((line) => !listed.has(line));
  if (dropped.length > 0) {
    tx.delete(characterProfessions)
      .where(and(eq(characterProfessions.guid, c.guid), inArray(characterProfessions.skillLineId, dropped)))
      .run();
  }
  return scanned;
}

/**
 * Forever's own recipes and items (amendment 2): a recipe or item the database doesn't have is stored from the
 * uploaded pair (origin "upload"), with the addon's skill line where it sent one, so the site can show it without a
 * name or tooltip. Where the database has it, the database wins.
 */
function rememberUploaded(tx: Tx, c: Character, added: { recipe: number; item: number | null }[]): void {
  for (const a of added) {
    const line = c.recipeLines?.[String(a.recipe)];
    tx.insert(recipes)
      .values({
        id: a.recipe,
        skillLineId: line ?? null,
        createdItemId: a.item,
        obtainable: true,
        foreverOnly: true,
        origin: "upload",
      })
      .onConflictDoNothing()
      .run();
    if (a.item !== null) {
      tx.insert(items)
        .values({ id: a.item, data: { id: a.item }, origin: "upload" })
        .onConflictDoNothing()
        .run();
    }
  }
}
