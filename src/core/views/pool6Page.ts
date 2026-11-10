import { huntDay, type HuntPlannedDay } from "../doomsday/hunt";
import { type MissionStats, type PlannedPeriod, type Settings, settingOf } from "../doomsday/missionPool";
import { goal, type GoalSlot, pool, THEME_LABEL, THEMES, themeOf } from "../doomsday/rules";
import type { DayRecipeView, RecipeTileView, ThemeCardView } from "./pool6";

// Pool version 6 (WEB-108): the Mission pool page's recipe bar, theme cards and 6-line day tiles (boards MP05, MP07),
// built from the plan, the settings and the stats (src/core/doomsday/missionPool.ts) and the Hunt plan
// (src/core/doomsday/hunt.ts). Pure; the page (WEB-109) renders them.

/** A weekly slot whose missions come back within this many days gets the orange tile (MP05: "within ~6 weeks"). */
export const SOON_DAYS = 42;

const isOff = (settings: Settings, id: string) => settingOf(settings, id).off;

/** The six recipe tiles: Daily PvE, The Hunt, Daily PvP, Weekly, Bounty, Off. `huntInDraw`: targets in the draw. */
export function recipeTiles(settings: Settings, huntInDraw: number): RecipeTileView[] {
  const on = (...slots: GoalSlot[]) => slots.flatMap((s) => pool(s)).filter((id) => !isOff(settings, id)).length;
  const tile = (
    id: RecipeTileView["id"],
    label: string,
    perPeriod: number,
    period: "day" | "week",
    size: number,
  ): RecipeTileView => {
    const t: RecipeTileView = { id, label, perPeriod, period, pool: size, soon: false };
    if (perPeriod > 0 && size > 0) {
      t.backEveryDays = Math.round((size / perPeriod) * (period === "week" ? 7 : 1));
      // Only the weekly slots (Weekly, Bounty): daily missions always come back within weeks (the board).
      t.soon = period === "week" && t.backEveryDays <= SOON_DAYS;
    }
    return t;
  };
  const off = (["daily", "skirmish", "duel", "weekly", "bounty"] as const)
    .flatMap((s) => pool(s))
    .filter((id) => isOff(settings, id)).length;
  return [
    tile("pve", "Daily PvE", 3, "day", on("daily")),
    tile("hunt", "The Hunt", 1, "day", huntInDraw),
    tile("pvp", "Daily PvP", 2, "day", on("skirmish", "duel")),
    tile("weekly", "Weekly", 3, "week", on("weekly")),
    tile("bounty", "Bounty", 1, "week", on("bounty")),
    tile("off", "Off", 0, "day", off),
  ];
}

/**
 * The nine theme cards (MP05 2.3): the six PvE themes, Skirmish, Weekly, Bounty; the Duel pool is a card of its own
 * after the Skirmish (MP07 groups it under the Skirmish). History over the stats: came up, done share (0..1).
 */
export function themeCards(settings: Settings, stats: ReadonlyMap<string, MissionStats>): ThemeCardView[] {
  const card = (id: ThemeCardView["id"], label: string, kind: ThemeCardView["kind"], missions: string[]) => {
    let cameUp = 0;
    let had = 0;
    let done = 0;
    for (const m of missions) {
      const s = stats.get(m);
      cameUp += s?.cameUp ?? 0;
      had += s?.had ?? 0;
      done += s?.done ?? 0;
    }
    const c: ThemeCardView = {
      id,
      label,
      kind,
      count: missions.length,
      off: missions.filter((m) => isOff(settings, m)).length,
      cameUp,
      fresh: missions.filter((m) => goal(m)?.since === 6).length,
      missions,
    };
    if (had > 0) c.donePct = done / had;
    return c;
  };
  const daily = pool("daily");
  return [
    ...THEMES.map((t) =>
      card(
        t,
        THEME_LABEL[t],
        "Daily PvE",
        daily.filter((id) => themeOf(id) === t),
      ),
    ),
    card("skirmish", "Skirmish", "PvP", pool("skirmish")),
    card("duel", "Duel", "PvP", pool("duel")),
    card("weekly", "Weekly", "Weekly", pool("weekly")),
    card("bounty", "Bounty", "PvP", pool("bounty")),
  ];
}

/** The calendar's day tiles (MP05 2.2): 3 PvE, the Hunt, the Skirmish, the Duel, from the plans of the same days. */
export function dayRecipes(days: readonly PlannedPeriod[], hunts: readonly HuntPlannedDay[]): DayRecipeView[] {
  return days.map((d) => {
    const h = hunts.find((x) => x.n === d.n);
    const v: DayRecipeView = {
      n: d.n,
      pve: d.plan.slice(0, 3),
      hunt: h !== undefined ? huntDay(h) : { n: d.n, targets: {}, pinned: {}, locked: d.locked },
      locked: d.locked,
      changed: d.changed,
    };
    if (d.plan[3] !== undefined) v.skirmish = d.plan[3];
    if (d.plan[4] !== undefined) v.duel = d.plan[4];
    return v;
  });
}
