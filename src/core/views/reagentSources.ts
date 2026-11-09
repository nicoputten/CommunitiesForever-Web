import type { ReagentSourceKind } from "../recipes/reagentSources";

// WEB-98 (board reagent-sources, Nico's confirmed order): where to get a reagent, under each reagent in the recipe
// drawer. At most 3 lines, best first: a vendor without a stock limit, crafted by someone in the group, gathered
// (skinning, herbalism, mining), a vendor with a limited stock, crafted by nobody yet, then a drop by chance. One line
// per kind (the best vendor, the best nodes); crafted, one line per recipe that makes it. Gold is never shown.

/** A row of the item import's reagent_sources (src/core/recipes/reagentSources.ts). */
export interface ReagentSourceData {
  itemId: number;
  kind: ReagentSourceKind;
  position: number;
  name?: string | null;
  zone?: string | null;
  chance?: number | null;
  recipeId?: number | null;
  creatureType?: string | null;
  minLevel?: number | null;
  maxLevel?: number | null;
}

export type ReagentSourceLine =
  | { kind: "vendor"; npc: string; zone?: string; limited: boolean }
  | {
      kind: "crafted";
      recipeId: number;
      /** The reagent's name as the recipe makes it ("Cured Heavy Hide"). */
      name: string;
      profession: string;
      /** The skill to learn it (orange). */
      skill?: number;
      /** Someone in the group knows the recipe. */
      known: boolean;
    }
  | { kind: "skinning"; creatureType?: string; minLevel?: number; maxLevel?: number }
  | { kind: "herbalism" | "mining"; nodes: string[] }
  | { kind: "drop"; creatures: { name: string; chance: number }[] };

export const REAGENT_SOURCES_MAX = 3;

/** What a crafted line needs of the recipe that makes the reagent; undefined: a recipe the site doesn't list. */
export interface CraftedInfo {
  name: string;
  profession: string;
  skill?: number;
  known: boolean;
}

const text = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? undefined : v);

/** A reagent's source lines, best first, at most 3; empty: none known ("No known source"). */
export function reagentSourceLines(
  rows: readonly ReagentSourceData[],
  crafted: (recipeId: number) => CraftedInfo | undefined,
): ReagentSourceLine[] {
  const of = (kind: ReagentSourceKind) => rows.filter((r) => r.kind === kind).sort((a, b) => a.position - b.position);
  const vendor = (kind: "vendor" | "vendor_limited"): ReagentSourceLine[] => {
    const best = of(kind).find((r) => text(r.name) !== undefined);
    if (best === undefined) return [];
    const line: ReagentSourceLine = { kind: "vendor", npc: best.name!, limited: kind === "vendor_limited" };
    const zone = text(best.zone);
    if (zone !== undefined) line.zone = zone;
    return [line];
  };
  const craftedLines = of("crafted").flatMap((r): ReagentSourceLine[] => {
    if (r.recipeId === null || r.recipeId === undefined) return [];
    const info = crafted(r.recipeId);
    if (info === undefined) return [];
    const line: ReagentSourceLine = {
      kind: "crafted",
      recipeId: r.recipeId,
      name: info.name,
      profession: info.profession,
      known: info.known,
    };
    if (info.skill !== undefined && info.skill > 1) line.skill = info.skill;
    return [line];
  });
  const skinning = of("skinning")
    .slice(0, 1)
    .map((r): ReagentSourceLine => {
      const line: ReagentSourceLine = { kind: "skinning" };
      const type = text(r.creatureType);
      if (type !== undefined) line.creatureType = type;
      if (r.minLevel != null && r.minLevel > 0) line.minLevel = r.minLevel;
      if (r.maxLevel != null && r.maxLevel > 0) line.maxLevel = r.maxLevel;
      return line;
    });
  const nodes = (kind: "herbalism" | "mining"): ReagentSourceLine[] => {
    const names = of(kind).flatMap((r) => (text(r.name) === undefined ? [] : [r.name!]));
    return names.length === 0 ? [] : [{ kind, nodes: names.slice(0, 2) }];
  };
  const creatures = of("drop").flatMap((r) =>
    text(r.name) === undefined || r.chance == null ? [] : [{ name: r.name!, chance: r.chance }],
  );
  const drop: ReagentSourceLine[] = creatures.length === 0 ? [] : [{ kind: "drop", creatures: creatures.slice(0, 2) }];
  return [
    ...vendor("vendor"),
    ...craftedLines.filter((l) => l.kind === "crafted" && l.known),
    ...skinning,
    ...nodes("herbalism"),
    ...nodes("mining"),
    ...vendor("vendor_limited"),
    ...craftedLines.filter((l) => l.kind === "crafted" && !l.known),
    ...drop,
  ].slice(0, REAGENT_SOURCES_MAX);
}

/** "Beasts": a creature type as a plural, lower case ("Dragonkin" and "Undead" stay as they are). */
export function creatureTypePlural(type: string): string {
  const lower = type.toLowerCase();
  if (lower.endsWith("kin") || lower === "undead") return lower;
  return `${lower}s`;
}

/** "level 30–45", "level 12"; undefined without levels. */
export function levelRange(min: number | undefined, max: number | undefined): string | undefined {
  const lo = min ?? max;
  const hi = max ?? min;
  if (lo === undefined || hi === undefined) return undefined;
  return lo === hi ? `level ${lo}` : `level ${lo}–${hi}`;
}
