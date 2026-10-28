// One rule for how a character's level fits a level range (WEB-47, decided with Nico 2026-10-27): the runs list, a
// run's page, Plan and Edit, the bot's run data, "could join" and the roster's bands all use it, so a character is
// never "too low" on one page and "16 levels short" on another.

export type FitKind = "fits" | "over" | "carry" | "low" | "tooLow";

export interface LevelFit {
  kind: FitKind;
  /** "fits", "+3 over", "carry · +12", "4 below". */
  label: string;
  /** May answer I'm in with it (tooLow only Maybe). */
  canPick: boolean;
  /** Shown as a suggestion ("could fill"), and counts for "Runs I can join". */
  suggested: boolean;
  /** A one-line note when picked: the XP for a carry, how tough it is when low. */
  note?: string;
}

/** Levels above the range from which a character carries the group (and gets little XP). */
export const CARRY_FROM = 10;
/** Levels below the range a character may still join ("tough"); more is Maybe only. */
export const LOW_UNTIL = 5;

/** How `level` fits `min`–`max`; an unknown level counts as too low (nothing to go by). */
export function levelFit(level: number | undefined, min: number, max: number): LevelFit {
  if (level === undefined) return { kind: "tooLow", label: "level unknown", canPick: false, suggested: false };
  if (level > max) {
    const over = level - max;
    return over >= CARRY_FROM
      ? { kind: "carry", label: `carry · +${over}`, canPick: true, suggested: false, note: "Little XP for you here." }
      : { kind: "over", label: `+${over} over`, canPick: true, suggested: true };
  }
  if (level < min) {
    const below = min - level;
    return below <= LOW_UNTIL
      ? { kind: "low", label: `${below} below`, canPick: true, suggested: false, note: "This will be tough." }
      : { kind: "tooLow", label: `${below} below`, canPick: false, suggested: false };
  }
  return { kind: "fits", label: "fits", canPick: true, suggested: true };
}
