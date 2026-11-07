import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Dataset } from "@/core/model";
import { LIVE_UNTIL } from "@/core/views/age";
import {
  hasRecipes,
  type CharacterProfessionData,
  type ItemData,
  type KnownData,
  type ReagentData,
  type RecipeData,
  type SourceData,
  type TooltipItem,
} from "@/core/views/recipes";
import type { Db } from "./db";
import { characterProfessions, characterRecipes, items, recipeReagents, recipes, recipeSources } from "./db/schema";

// WEB-92: what the recipe pages read from the item database and the derived recipe tables (WEB-90). The view models
// are pure (src/core/views/recipes.ts); this only reads rows.

function chunked<T, R>(list: readonly T[], read: (slice: T[]) => R[]): R[] {
  const out: R[] = [];
  for (let i = 0; i < list.length; i += 500) out.push(...read(list.slice(i, i + 500)));
  return out;
}

const recipeColumns = {
  id: recipes.id,
  name: recipes.name,
  skillLineId: recipes.skillLineId,
  createdItemId: recipes.createdItemId,
  orange: recipes.orange,
  yellow: recipes.yellow,
  green: recipes.green,
  grey: recipes.grey,
  category: recipes.category,
  obtainable: recipes.obtainable,
  foreverOnly: recipes.foreverOnly,
};

const itemColumns = { id: items.id, name: items.name, quality: items.quality, iconName: items.iconName };

export interface RecipeRows {
  recipes: RecipeData[];
  items: Map<number, ItemData>;
  sources: SourceData[];
  reagents: ReagentData[];
  known: KnownData[];
  professions: CharacterProfessionData[];
}

/** One profession's recipes (or every recipe profession's, for the search) with everything their rows show. */
export function recipeRows(db: Db, skillLine?: number): RecipeRows {
  const recipeList: RecipeData[] = (
    skillLine === undefined
      ? db.select(recipeColumns).from(recipes).where(isNotNull(recipes.skillLineId)).all()
      : db.select(recipeColumns).from(recipes).where(eq(recipes.skillLineId, skillLine)).all()
  ).filter((r) => r.skillLineId !== null && hasRecipes(r.skillLineId));
  const ids = recipeList.map((r) => r.id);
  const sources = chunked(ids, (slice) =>
    db.select().from(recipeSources).where(inArray(recipeSources.recipeId, slice)).all(),
  );
  const reagents = chunked(ids, (slice) =>
    db.select().from(recipeReagents).where(inArray(recipeReagents.recipeId, slice)).all(),
  );
  const known = chunked(ids, (slice) =>
    db
      .select({ guid: characterRecipes.guid, recipeId: characterRecipes.recipeId })
      .from(characterRecipes)
      .where(inArray(characterRecipes.recipeId, slice))
      .all(),
  );
  const itemIds = [
    ...new Set([
      ...recipeList.flatMap((r) => (r.createdItemId == null ? [] : [r.createdItemId])),
      ...reagents.map((r) => r.itemId),
    ]),
  ];
  const itemList = chunked(itemIds, (slice) =>
    db.select(itemColumns).from(items).where(inArray(items.id, slice)).all(),
  );
  const professions = (
    skillLine === undefined
      ? db.select().from(characterProfessions).all()
      : db.select().from(characterProfessions).where(eq(characterProfessions.skillLineId, skillLine)).all()
  ).map((p) => ({
    guid: p.guid,
    skillLineId: p.skillLineId,
    skill: p.skill,
    spec: p.spec,
    scannedAt: p.scannedAt,
  }));
  return {
    recipes: recipeList,
    items: new Map(itemList.map((i) => [i.id, i])),
    sources,
    reagents,
    known,
    professions,
  };
}

/** "112 of 185": every recipe's skill line and whether it counts, and who knows what. */
export function recipeTotalRows(db: Db): { recipes: RecipeData[]; known: KnownData[] } {
  return {
    recipes: db
      .select({
        id: recipes.id,
        skillLineId: recipes.skillLineId,
        obtainable: recipes.obtainable,
        foreverOnly: recipes.foreverOnly,
      })
      .from(recipes)
      .all(),
    known: db.select({ guid: characterRecipes.guid, recipeId: characterRecipes.recipeId }).from(characterRecipes).all(),
  };
}

/** A character's professions as scanned, and how many recipes it knows per skill line (RC01). */
export function characterRecipeRows(
  db: Db,
  guid: string,
): { professions: CharacterProfessionData[]; counts: Map<number, number> } {
  const professions = db
    .select()
    .from(characterProfessions)
    .where(eq(characterProfessions.guid, guid))
    .all()
    .map((p) => ({ guid: p.guid, skillLineId: p.skillLineId, skill: p.skill, spec: p.spec, scannedAt: p.scannedAt }));
  const counts = new Map<number, number>();
  for (const r of db
    .select({ line: recipes.skillLineId })
    .from(characterRecipes)
    .innerJoin(recipes, eq(recipes.id, characterRecipes.recipeId))
    .where(and(eq(characterRecipes.guid, guid), isNotNull(recipes.skillLineId)))
    .all()) {
    counts.set(r.line!, (counts.get(r.line!) ?? 0) + 1);
  }
  return { professions, counts };
}

/** Items with their tooltip data, by ID (no gold: the item data has no sell price). */
export function tooltipItems(db: Db, ids: readonly number[]): TooltipItem[] {
  return chunked([...new Set(ids)], (slice) => db.select().from(items).where(inArray(items.id, slice)).all()).map(
    (i) => {
      const t: TooltipItem = { id: i.id, data: i.data };
      if (i.name !== null) t.name = i.name;
      if (i.quality !== null) t.quality = i.quality;
      if (i.iconName !== null) t.icon = i.iconName;
      return t;
    },
  );
}

/** Characters seen in game within the "new" window of the data age scale (DESIGN.md §4): "· online" in the drawer. */
export function onlineGuids(data: Dataset, now: number): Set<string> {
  const out = new Set<string>();
  for (const [guid, p] of Object.entries(data.presence)) if (now - p.lastSeen < LIVE_UNTIL) out.add(guid);
  return out;
}
