import type { DoomsdaySnapshot } from "@/core/doomsday/snapshot";

// Doomsday's data states of board doomsday-phone (WEB-61) for /dev/doomsday, the design checks' page: the engine's own
// snapshot (WEB-58), changed to day one or to only the uploader with data (WEB-63). Admin only; never stored.

export type DoomsdayState = "first-day" | "only-you";

/**
 * The snapshot in a state: day one (nobody has a point, nothing done yet) or only `uploader` (the viewer) with
 * Doomsday data.
 */
export function doomsdayState(snapshot: DoomsdaySnapshot, state: DoomsdayState, uploader?: string): DoomsdaySnapshot {
  const s = structuredClone(snapshot);
  if (state === "first-day") {
    delete s.crown;
    s.feats = [];
    for (const f of s.friends) {
      for (const g of [...(f.today?.goals ?? []), ...(f.week?.goals ?? [])]) {
        delete g.doneAt;
        if (g.progress !== undefined) g.progress = { value: 0, target: g.progress.target };
      }
      if (f.today !== undefined) {
        delete f.today.finishedAt;
        f.today.duels = { first: [], open: f.today.duels.open, points: 0 };
      }
      if (f.points !== undefined)
        f.points = { today: { pve: 0, pvp: 0 }, week: { pve: 0, pvp: 0 }, allTime: { pve: 0, pvp: 0 } };
      if (f.streak !== undefined) f.streak = { current: 0, best: 0 };
      if (f.heatmap !== undefined) f.heatmap = f.heatmap.map((_, i, all) => (i === all.length - 1 ? 0 : null));
    }
    for (const scope of [s.ladders.week, s.ladders.allTime]) {
      scope.pve = [];
      scope.pvp = [];
    }
  } else {
    delete s.crown;
    for (const f of s.friends) {
      if (f.friendKey === uploader || f.status !== "active") continue;
      f.status = "noDoomsday";
      for (const k of ["today", "week", "points", "streak", "heatmap", "pvp", "featProgress"] as const) delete f[k];
    }
    for (const scope of [s.ladders.week, s.ladders.allTime]) {
      scope.pve = scope.pve.filter((r) => r.friendKey === uploader).map((r) => ({ ...r, place: 1 }));
      scope.pvp = scope.pvp.filter((r) => r.friendKey === uploader).map((r) => ({ ...r, place: 1 }));
    }
    s.feats = s.feats.filter((f) => f.friendKey === uploader);
  }
  return s;
}
