// Which recipes an upload taught a character (WEB-90, handoff B4). Pure: the stored state comes in as arguments.
//
// The addon (CF-38) uploads every learned recipe of every profession on each scan (`GetAllRecipeIDs` returns them
// all at once), so the uploaded set is complete: ids not in it were unlearned (rare: a dropped profession).
// Baseline rule: the first scan of a character, and the first recipes of a profession the character had none of and
// never had scanned, are its baseline and never count as newly learned (else the first upload would post everything).

export interface LearnInput {
  /** The upload's set: recipe ID -> item ID (0: none). */
  uploaded: Readonly<Record<string, number>>;
  /** What the site already holds for the character: recipe ID -> its skill line, when known. */
  stored: ReadonlyMap<number, number | undefined>;
  /** Whether the character had a recipe scan before (`character_recipe_scans`). */
  scannedBefore: boolean;
  /** Skill lines whose window the addon had scanned before this upload (`character_professions.scanned_at`). */
  scannedProfessions: ReadonlySet<number>;
  /** A recipe's skill line: the item database first, else the addon's `recipeLines`. */
  skillLineOf: (recipe: number) => number | undefined;
}

export interface LearnedRecipe {
  recipe: number;
  /** Null when the addon says it makes no item. */
  item: number | null;
  skillLine?: number;
  /** True: part of a baseline, not newly learned. */
  baseline: boolean;
}

export interface LearnResult {
  added: LearnedRecipe[];
  removed: number[];
}

export function learnRecipes(input: LearnInput): LearnResult {
  const uploaded = new Map<number, number>();
  for (const [key, item] of Object.entries(input.uploaded)) uploaded.set(Number(key), item);
  const knownLines = new Set<number>();
  for (const line of input.stored.values()) if (line !== undefined) knownLines.add(line);

  const added: LearnedRecipe[] = [];
  for (const [recipe, item] of [...uploaded].sort((a, b) => a[0] - b[0])) {
    if (input.stored.has(recipe)) continue;
    const skillLine = input.skillLineOf(recipe);
    // A recipe of an unknown profession counts once the character has a baseline.
    const professionKnown =
      skillLine === undefined || knownLines.has(skillLine) || input.scannedProfessions.has(skillLine);
    const learned: LearnedRecipe = {
      recipe,
      item: item > 0 ? item : null,
      baseline: !input.scannedBefore || !professionKnown,
    };
    if (skillLine !== undefined) learned.skillLine = skillLine;
    added.push(learned);
  }
  const removed = [...input.stored.keys()].filter((recipe) => !uploaded.has(recipe)).sort((a, b) => a - b);
  return { added, removed };
}

export interface SourceKindOnly {
  kind: string;
  isRare: boolean;
}

/**
 * A "rare find" (handoff Decisions): a recipe learned from a world drop, boss drop or reputation vendor. One that a
 * trainer, a vendor or a quest also teaches is never one (it was most likely learned there), nor one without a
 * known source (Forever's own recipes, until a source is known).
 */
export function isRareRecipe(sources: readonly SourceKindOnly[]): boolean {
  return sources.length > 0 && sources.every((s) => s.isRare);
}
