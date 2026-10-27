import { PROFESSIONS, type ProfessionKind } from "../gamedata";
import type { Dataset } from "../model";
import { dict } from "../normalize";
import { byLevel, compareText, peopleViews, recordCharacters, type CharacterView } from "./characters";

// The professions page (board `professions`): the best in the group per profession, its status, and the
// character × profession matrix.

/** Covered: someone at 225 or higher; thin: best 175–224; gap: best under 175 or nobody (docs/DESIGN.md §8). */
export type Coverage = "covered" | "thin" | "gap";

export const COVERED_FROM = 225;
export const THIN_FROM = 175;

export function coverage(best: number | undefined): Coverage {
  if (best === undefined || best < THIN_FROM) return "gap";
  return best >= COVERED_FROM ? "covered" : "thin";
}

export interface ProfessionColumn {
  skillLine: string;
  name: string;
  /** Undefined for a skill line the professions table does not know. */
  kind?: ProfessionKind;
}

export interface ProfessionEntry {
  character: CharacterView;
  rank: number;
  max?: number;
  /** ★ the best in the group (every character at the best rank). */
  best: boolean;
  /** The owner's data is 7 days old or more (the board fades Ruk's bars). */
  old: boolean;
}

export interface ProfessionSummary extends ProfessionColumn {
  status: Coverage;
  /** The highest rank in the group; undefined when nobody has it. */
  best?: number;
  /** Highest rank first. */
  entries: ProfessionEntry[];
}

export interface MatrixRow {
  character: CharacterView;
  /** By skill line; a missing key: the character does not have it. */
  cells: Record<string, { rank: number; max?: number }>;
  /** "No professions yet". */
  none: boolean;
}

export interface ProfessionsView {
  /** Primary professions, then secondary, each by name; then skill lines the table does not know. */
  professions: ProfessionSummary[];
  covered: ProfessionSummary[];
  thin: ProfessionSummary[];
  gaps: ProfessionSummary[];
  matrix: { columns: ProfessionColumn[]; rows: MatrixRow[] };
  /** Nobody in the group has a profession yet. */
  empty: boolean;
}

const kindOrder = (kind: ProfessionKind | undefined) => (kind === "primary" ? 0 : kind === "secondary" ? 1 : 2);

export function professions(d: Dataset, now: number): ProfessionsView {
  const characters = recordCharacters(d, now);
  const oldOwners = new Set(peopleViews(d, now).flatMap((p) => (p.old ? [p.key] : [])));
  const isOld = (c: CharacterView) => c.owner !== undefined && oldOwners.has(c.owner);

  const columns = new Map<string, ProfessionColumn>();
  for (const info of Object.values(PROFESSIONS)) {
    columns.set(String(info.skillLineID), { skillLine: String(info.skillLineID), name: info.name, kind: info.kind });
  }
  for (const c of characters) {
    for (const p of c.professions) {
      if (!columns.has(p.skillLine)) columns.set(p.skillLine, { skillLine: p.skillLine, name: p.name });
    }
  }
  const ordered = [...columns.values()].sort(
    (a, b) =>
      kindOrder(a.kind) - kindOrder(b.kind) || compareText(a.name, b.name) || compareText(a.skillLine, b.skillLine),
  );

  const summaries = ordered.map((column): ProfessionSummary => {
    const entries: ProfessionEntry[] = [];
    for (const character of characters) {
      const p = character.professions.find((x) => x.skillLine === column.skillLine);
      if (p === undefined) continue;
      const entry: ProfessionEntry = { character, rank: p.rank, best: false, old: isOld(character) };
      if (p.max !== undefined) entry.max = p.max;
      entries.push(entry);
    }
    entries.sort((a, b) => b.rank - a.rank || byLevel(a.character, b.character));
    const best = entries[0]?.rank;
    for (const e of entries) e.best = e.rank === best;
    const summary: ProfessionSummary = { ...column, status: coverage(best), entries };
    if (best !== undefined) summary.best = best;
    return summary;
  });

  const rows: MatrixRow[] = characters
    .map((character) => {
      const cells = dict<MatrixRow["cells"][string]>();
      for (const p of character.professions)
        cells[p.skillLine] = p.max !== undefined ? { rank: p.rank, max: p.max } : { rank: p.rank };
      return { character, cells, none: character.professions.length === 0 };
    })
    .sort((a, b) => Number(a.none) - Number(b.none) || byLevel(a.character, b.character));

  return {
    professions: summaries,
    covered: summaries.filter((s) => s.status === "covered"),
    thin: summaries.filter((s) => s.status === "thin"),
    gaps: summaries.filter((s) => s.status === "gap"),
    matrix: { columns: ordered, rows },
    empty: summaries.every((s) => s.entries.length === 0),
  };
}
