// Character levels and talent points (docs/WOW-FOREVER.md "Level cap", docs/DESIGN.md §8). Sources:
// - Level cap 60: Game Informer, "Blizzard announces World of Warcraft: Forever" (content covers 1–60,
//   https://gameinformer.com/blizzcon-2026/2026/09/12/blizzard-announces-world-of-warcraft-forever-expanding-vanilla-wow-with).
// - Talent points: one per level from level 10, so level − 9 (51 at level 60); the deepest talent of a tree needs 31
//   points in it. Vanilla rules (warcraft.wiki.gg "Talent", https://warcraft.wiki.gg/wiki/Talent), kept for Forever's
//   three trees per class (CommunitiesForever docs/API-FINDINGS.md V20, V29) and decided in the design workshop.

export const MAX_LEVEL = 60;

/** Talent points available at a level: level − 9, none before level 10. */
export function talentPointsAt(level: number): number {
  return Math.max(0, Math.min(level, MAX_LEVEL) - 9);
}

/** Points to reach the deepest talent of a tree: talent bars are drawn out of this. */
export const MAX_TREE_POINTS = 31;
