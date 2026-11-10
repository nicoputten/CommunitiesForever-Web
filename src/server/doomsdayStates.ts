import { huntTargets, targetKey } from "@/core/doomsday/hunt";
import type { DoomsdaySnapshot } from "@/core/doomsday/snapshot";

// Doomsday's data states of board doomsday-phone (WEB-61) for /dev/doomsday, the design checks' page: the engine's own
// snapshot (WEB-58), changed to day one or to only the uploader with data (WEB-63). Admin only; never stored.

export type DoomsdayState = "first-day" | "only-you" | "hunt" | "hunt-bagged";

/**
 * The snapshot in a state: day one (nobody has a point, nothing done yet) or only `uploader` (the viewer) with
 * Doomsday data.
 */
export function doomsdayState(snapshot: DoomsdaySnapshot, state: DoomsdayState, uploader?: string): DoomsdaySnapshot {
  const s = structuredClone(snapshot);
  if (state === "hunt" || state === "hunt-bagged") return huntState(s, state === "hunt-bagged", uploader);
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

/** Zones for the design sample's kills (WEB-110): real zone names, made-up kills. */
const ZONES = ["Ashenvale", "Hillsbrad Foothills", "Stonetalon Mountains"];

/**
 * The Hunt as the addon of pool 6 and WEB-108's census will give it (WEB-110, boards DS01HuntToday, DS02HuntMore): a
 * made-up census (seen this week per target; a few under 60, the rarest under 1 %), zones on today's kills and, for
 * `bagged`, the viewer's quarry bagged an hour ago. For the design checks only; never stored.
 */
function huntState(s: DoomsdaySnapshot, bagged: boolean, viewer: string | undefined): DoomsdaySnapshot {
  const counts: Record<string, number> = {};
  for (const hunted of ["Alliance", "Horde"] as const) {
    huntTargets(hunted).forEach((t, i) => (counts[targetKey(t)] = t.race >= 95 ? 30 + i : 120 + ((i * 97) % 480)));
  }
  s.census = { at: s.now, characters: 16400, counts };
  s.rare = Object.entries(counts)
    .filter(([, n]) => n < 60)
    .map(([k]) => k);
  s.friends.forEach((f, i) => {
    const today = (f.huntKills ?? []).find((k) => k.day === s.schedule.day);
    if (today !== undefined) today.zone = ZONES[i % ZONES.length]!;
  });
  // A friend bagged one 74 minutes after the reset (board DS01: "Grom 20:14 · Ashenvale").
  const other = s.friends.find(
    (f) => f.friendKey !== viewer && f.status === "active" && !f.pvpVirgin && f.today !== undefined,
  );
  const quarry = s.quarry?.today[other?.hunted ?? "Alliance"];
  if (other !== undefined && quarry !== undefined && !(other.huntKills ?? []).some((k) => k.day === s.schedule.day)) {
    const at = s.schedule.dayStart + 74 * 60;
    for (const g of other.today!.goals) if (g.goal.slot === "hunt") g.doneAt = at;
    other.huntKills = [...(other.huntKills ?? []), { day: s.schedule.day, at, zone: ZONES[0]!, ...quarry }];
  }
  if (bagged) {
    const me = s.friends.find((f) => f.friendKey === viewer);
    const target = s.quarry?.today[me?.hunted ?? "Alliance"];
    const goal = me?.today?.goals.find((g) => g.goal.slot === "hunt");
    if (me !== undefined && target !== undefined && goal !== undefined && goal.doneAt === undefined) {
      const at = s.now - 3600;
      for (const g of me.today!.goals) if (g.goal.slot === "hunt") g.doneAt = at;
      me.huntKills = [...(me.huntKills ?? []), { day: s.schedule.day, at, zone: ZONES[0]!, ...target }];
    }
  }
  return s;
}
