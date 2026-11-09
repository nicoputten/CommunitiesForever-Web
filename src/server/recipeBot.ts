import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { milestoneCharacter } from "@/core/bot";
import type { Dataset } from "@/core/model";
import {
  bestColor,
  type BotItem,
  type BotSource,
  botItem,
  botSource,
  type CraftableName,
  craftableNames,
  crafterDifficulty,
  professionName,
  qualityColor,
  type RecipeRow,
  recipeUrl,
} from "@/core/recipes/bot";
import type { Difficulty } from "@/core/recipes/skill";
import { reagentSourceLines, type ReagentSourceLine } from "@/core/views/reagentSources";
import { getBotSettings } from "./discord";
import type { Db } from "./db";
import {
  botEvents,
  characterProfessions,
  characterRecipes,
  items,
  reagentSources,
  recipeFinds,
  recipeReagents,
  recipes,
  recipeSources,
} from "./db/schema";

// The Discord bot's recipes (WEB-93, recipes handoff Part D, board RC08, docs/BOT-API.md "Recipes"): the `recipeFinds`
// event, one per character per upload with new rare finds (src/server/recipes.ts decides which), and the `/craft`
// look-ups. Names only, never a BattleTag or gold.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface RecipeFind {
  recipeId: number;
  item: BotItem;
  /** The profession and the character's skill in it. */
  profession?: { skillLine: number; name: string; skill?: number };
  sources: BotSource[];
  /** The recipe's drawer on the site, a path (`/professions/tailoring?recipe=18457`). */
  url?: string;
}

export interface RecipeFindsEvent {
  uploadId: number;
  uploadedAt: number;
  character: ReturnType<typeof milestoneCharacter>;
  /** Best quality first. */
  finds: RecipeFind[];
  /** The best item's quality colour (RC08: the embed's colour bar). */
  color: string;
}

function recipeRow(db: Db | Tx, id: number): RecipeRow | undefined {
  return db
    .select({
      id: recipes.id,
      name: recipes.name,
      skillLineId: recipes.skillLineId,
      createdItemId: recipes.createdItemId,
      orange: recipes.orange,
      yellow: recipes.yellow,
      green: recipes.green,
      grey: recipes.grey,
    })
    .from(recipes)
    .where(eq(recipes.id, id))
    .get();
}

function itemRow(db: Db | Tx, id: number | null) {
  if (id === null) return undefined;
  return db
    .select({ id: items.id, name: items.name, quality: items.quality, iconName: items.iconName })
    .from(items)
    .where(eq(items.id, id))
    .get();
}

function sourcesOf(db: Db | Tx, recipeId: number): BotSource[] {
  return db.select().from(recipeSources).where(eq(recipeSources.recipeId, recipeId)).all().map(botSource);
}

function skillOf(db: Db | Tx, guid: string, skillLine: number | null): number | undefined {
  if (skillLine === null) return undefined;
  return (
    db
      .select({ skill: characterProfessions.skill })
      .from(characterProfessions)
      .where(and(eq(characterProfessions.guid, guid), eq(characterProfessions.skillLineId, skillLine)))
      .get()?.skill ?? undefined
  );
}

/** One rare find as the bot gets it; undefined for a recipe without a name. */
function findOf(tx: Tx, guid: string, recipeId: number): RecipeFind | undefined {
  const recipe = recipeRow(tx, recipeId);
  if (recipe === undefined) return undefined;
  const item = botItem(recipe, itemRow(tx, recipe.createdItemId));
  if (item === undefined) return undefined;
  const find: RecipeFind = { recipeId, item, sources: sourcesOf(tx, recipeId) };
  const name = professionName(recipe.skillLineId);
  if (name !== undefined && recipe.skillLineId !== null) {
    const skill = skillOf(tx, guid, recipe.skillLineId);
    find.profession = { skillLine: recipe.skillLineId, name, ...(skill !== undefined ? { skill } : {}) };
  }
  const url = recipeUrl(recipe.skillLineId, recipeId);
  if (url !== undefined) find.url = url;
  return find;
}

/**
 * Writes a `recipeFinds` event per character with new rare finds, in the upload's transaction (live uploads only; a
 * rebuild never calls it). Off with the admin's feats switch (`milestones`), like the feats: turning it on later
 * posts nothing old. Returns whether it wrote one.
 */
export function recordRecipeFinds(
  tx: Tx,
  upload: { id: number; uploadedAt: number },
  rare: Readonly<Record<string, number[]>>,
  after: Dataset,
): boolean {
  if (Object.keys(rare).length === 0 || !getBotSettings(tx).milestones) return false;
  let wrote = false;
  for (const [guid, recipeIds] of Object.entries(rare).sort(([a], [b]) => a.localeCompare(b))) {
    const finds = recipeIds
      .flatMap((id) => findOf(tx, guid, id) ?? [])
      .sort((a, b) => b.item.quality - a.item.quality || a.item.name.localeCompare(b.item.name, "en"));
    if (finds.length === 0) continue;
    const data: RecipeFindsEvent = {
      uploadId: upload.id,
      uploadedAt: upload.uploadedAt,
      character: milestoneCharacter(after, guid),
      finds,
      color: bestColor(finds.map((f) => f.item)),
    };
    tx.insert(botEvents).values({ type: "recipeFinds", data, createdAt: upload.uploadedAt, uploadId: upload.id }).run();
    wrote = true;
  }
  return wrote;
}

/** The bot posted a `recipeFinds` event: its finds are posted (`recipe_finds.posted_at`). */
export function markFindsPosted(tx: Tx, data: unknown, now: number): void {
  const d = data as Partial<RecipeFindsEvent> | null;
  if (typeof d?.uploadId !== "number" || typeof d.character?.guid !== "string") return;
  tx.update(recipeFinds)
    .set({ postedAt: now })
    .where(
      and(eq(recipeFinds.uploadId, d.uploadId), eq(recipeFinds.guid, d.character.guid), isNull(recipeFinds.postedAt)),
    )
    .run();
}

// --- /craft ---------------------------------------------------------------------------------------------------------

/** What recipes make (items by name, enchants by the recipe's name), with how many characters know each. */
function craftables(db: Db, present: ReadonlySet<string>): { recipeId: number; name: string; crafters: number }[] {
  const known = new Map<number, number>();
  for (const r of db
    .select({ recipe: characterRecipes.recipeId, guid: characterRecipes.guid })
    .from(characterRecipes)
    .all()) {
    if (present.has(r.guid)) known.set(r.recipe, (known.get(r.recipe) ?? 0) + 1);
  }
  const rows = db
    .select({
      id: recipes.id,
      recipeName: recipes.name,
      obtainable: recipes.obtainable,
      itemName: items.name,
    })
    .from(recipes)
    .leftJoin(items, eq(items.id, recipes.createdItemId))
    .where(isNotNull(recipes.skillLineId))
    .all();
  return rows.flatMap((r) => {
    const crafters = known.get(r.id) ?? 0;
    const name = r.itemName ?? r.recipeName;
    // An unobtainable recipe only while someone knows it.
    if (name === null || (!r.obtainable && crafters === 0)) return [];
    return [{ recipeId: r.id, name, crafters }];
  });
}

/** `/craft`'s autocomplete. */
export function craftableList(db: Db, d: Dataset, q: string): CraftableName[] {
  return craftableNames(craftables(db, new Set(Object.keys(d.characters))), q);
}

/** The recipe `/craft` means: a recipe ID (from the autocomplete), else an item or recipe name, exactly (no case). */
export function findCraft(db: Db, d: Dataset, given: string): number | undefined {
  const text = given.trim();
  if (text === "") return undefined;
  if (/^\d{1,9}$/.test(text)) {
    const id = Number(text);
    if (recipeRow(db, id) !== undefined) return id;
  }
  const wanted = text.toLowerCase();
  return craftableNames(
    craftables(db, new Set(Object.keys(d.characters))).filter((r) => r.name.toLowerCase() === wanted),
    "",
    1,
  )
    .map((r) => Number(r.value))
    .at(0);
}

export interface Crafter {
  guid: string;
  name: string;
  classFile?: string;
  ownerName?: string;
  skill?: number;
  /** What crafting it gives them (RC08's dot): orange, yellow, green or grey. */
  difficulty?: Difficulty;
}

export interface CraftAnswer {
  recipe: { id: number; name?: string; skillLine?: number; profession?: string; skill?: number };
  item: BotItem;
  /** Everyone who knows it, highest skill first. */
  crafters: Crafter[];
  reagents: {
    id: number;
    name?: string;
    count: number;
    quality?: number;
    qualityColor?: string;
    /** WEB-98: where to get it, best first, at most 3 (empty: none known); left out before the import has any. */
    sources?: BotReagentSource[];
  }[];
  /** Where it is learned: always sent, the bot shows it when nobody knows it. */
  sources: BotSource[];
  url?: string;
}

/** A reagent's source as the drawer shows it (src/core/views/reagentSources.ts); a crafted one with its recipe's link. */
export type BotReagentSource = ReagentSourceLine & { url?: string };

/** WEB-98: where to get each reagent, by item; undefined before an import has any reagent sources. */
function reagentSourcesOf(db: Db, d: Dataset, itemIds: readonly number[]): Map<number, BotReagentSource[]> | undefined {
  if (itemIds.length === 0 || !db.select({ itemId: reagentSources.itemId }).from(reagentSources).limit(1).get()) {
    return undefined;
  }
  const rows = db
    .select()
    .from(reagentSources)
    .where(inArray(reagentSources.itemId, [...itemIds]))
    .all();
  const makers = [...new Set(rows.flatMap((r) => (r.recipeId === null ? [] : [r.recipeId])))];
  const makerRows = new Map(
    (makers.length === 0
      ? []
      : db
          .select({
            id: recipes.id,
            name: recipes.name,
            skillLineId: recipes.skillLineId,
            createdItemId: recipes.createdItemId,
            orange: recipes.orange,
          })
          .from(recipes)
          .where(inArray(recipes.id, makers))
          .all()
    ).map((r) => [r.id, r]),
  );
  const madeItems = [...makerRows.values()].flatMap((r) => (r.createdItemId === null ? [] : [r.createdItemId]));
  const names = new Map(
    (madeItems.length === 0
      ? []
      : db.select({ id: items.id, name: items.name }).from(items).where(inArray(items.id, madeItems)).all()
    ).map((i) => [i.id, i.name]),
  );
  const known = new Set(
    (makers.length === 0
      ? []
      : db
          .select({ guid: characterRecipes.guid, recipeId: characterRecipes.recipeId })
          .from(characterRecipes)
          .where(inArray(characterRecipes.recipeId, makers))
          .all()
    )
      .filter((k) => d.characters[k.guid] !== undefined)
      .map((k) => k.recipeId),
  );
  const crafted = (id: number) => {
    const r = makerRows.get(id);
    const profession = professionName(r?.skillLineId);
    const name = (r?.createdItemId != null ? names.get(r.createdItemId) : undefined) ?? r?.name;
    if (r === undefined || profession === undefined || name == null) return undefined;
    return { name, profession, known: known.has(id), ...(r.orange !== null ? { skill: r.orange } : {}) };
  };
  const out = new Map<number, BotReagentSource[]>();
  for (const id of itemIds) {
    out.set(
      id,
      reagentSourceLines(
        rows.filter((r) => r.itemId === id),
        crafted,
      ).map((line): BotReagentSource => {
        if (line.kind !== "crafted") return line;
        const url = recipeUrl(makerRows.get(line.recipeId)?.skillLineId, line.recipeId);
        return url === undefined ? line : { ...line, url };
      }),
    );
  }
  return out;
}

export function craftAnswer(db: Db, d: Dataset, recipeId: number): CraftAnswer | undefined {
  const recipe = recipeRow(db, recipeId);
  if (recipe === undefined) return undefined;
  const item = botItem(recipe, itemRow(db, recipe.createdItemId));
  if (item === undefined) return undefined;
  const crafters: Crafter[] = [];
  for (const { guid } of db
    .select({ guid: characterRecipes.guid })
    .from(characterRecipes)
    .where(eq(characterRecipes.recipeId, recipeId))
    .all()) {
    const c = d.characters[guid];
    if (c === undefined || c.name === undefined) continue;
    const skill = skillOf(db, guid, recipe.skillLineId);
    const owner = c.owner !== undefined ? d.people[c.owner]?.displayName : undefined;
    const diff = crafterDifficulty(recipe, skill);
    crafters.push({
      guid,
      name: c.name,
      ...(c.classFile !== undefined ? { classFile: c.classFile } : {}),
      ...(owner !== undefined ? { ownerName: owner } : {}),
      ...(skill !== undefined ? { skill } : {}),
      ...(diff !== undefined ? { difficulty: diff } : {}),
    });
  }
  crafters.sort((a, b) => (b.skill ?? -1) - (a.skill ?? -1) || a.name.localeCompare(b.name, "en"));
  const reagentRows = db.select().from(recipeReagents).where(eq(recipeReagents.recipeId, recipeId)).all();
  const reagentItems = new Map(
    (reagentRows.length > 0
      ? db
          .select({ id: items.id, name: items.name, quality: items.quality })
          .from(items)
          .where(
            inArray(
              items.id,
              reagentRows.map((r) => r.itemId),
            ),
          )
          .all()
      : []
    ).map((i) => [i.id, i]),
  );
  const where = reagentSourcesOf(
    db,
    d,
    reagentRows.map((r) => r.itemId),
  );
  const reagents = reagentRows.map((r) => {
    const i = reagentItems.get(r.itemId);
    const sources = where?.get(r.itemId);
    return {
      id: r.itemId,
      count: r.count,
      ...(i?.name ? { name: i.name } : {}),
      ...(i?.quality !== null && i?.quality !== undefined
        ? { quality: i.quality, qualityColor: qualityColor(i.quality) }
        : {}),
      ...(sources !== undefined ? { sources } : {}),
    };
  });
  const profession = professionName(recipe.skillLineId);
  const url = recipeUrl(recipe.skillLineId, recipeId);
  return {
    recipe: {
      id: recipeId,
      ...(recipe.name !== null ? { name: recipe.name } : {}),
      ...(recipe.skillLineId !== null ? { skillLine: recipe.skillLineId } : {}),
      ...(profession !== undefined ? { profession } : {}),
      ...(recipe.orange !== null ? { skill: recipe.orange } : {}),
    },
    item,
    crafters,
    reagents,
    sources: sourcesOf(db, recipeId),
    ...(url !== undefined ? { url } : {}),
  };
}
