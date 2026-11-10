import { CENSUS_LICENCE, CENSUS_URL, type CensusInfo, type HuntKill } from "@/core/views/pool6";
import type { HuntPageData } from "@/core/views/doomsdayHunt";
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

/** Zones for the design sample's kills (WEB-110): real zone names, made-up kills. */
const ZONES = ["Ashenvale", "Hillsbrad Foothills", "Stonetalon Mountains"];

/** A made-up census count for a target key: Skyborne under 60 (rare on the realm), the others 120 to 599. */
function sampleSeen(key: string): number {
  const [race = 0, cls = 0] = key.split(":").map(Number);
  return race >= 95 ? 45 + cls : 120 + ((race * 97 + cls * 31) % 480);
}

/**
 * The Hunt as the addon of pool 6 and WEB-108's census give it (WEB-110, boards DS01HuntToday, DS02HuntMore), for the
 * design checks: a made-up census, a friend who bagged the quarry 74 minutes after the reset in Ashenvale, and for
 * `bagged` the viewer's quarry an hour ago. Never stored.
 */
export function huntState(
  snapshot: DoomsdaySnapshot,
  data: HuntPageData,
  bagged: boolean,
  viewer: string | undefined,
): { snapshot: DoomsdaySnapshot; hunt: HuntPageData } {
  const s = structuredClone(snapshot);
  const d = structuredClone(data);
  const census: CensusInfo = {
    at: s.now,
    asOf: s.now,
    characters: 16400,
    installs: 13,
    source: "everloot",
    roundTo: 5,
    stale: false,
    url: CENSUS_URL,
    licence: CENSUS_LICENCE,
  };
  for (const q of Object.values(d.hunt.quarry)) {
    q.seen = sampleSeen(q.target.key);
    q.census = census;
  }
  for (const f of d.friends) {
    const t = f.trophies;
    t.census = census;
    t.rarest = undefined;
    for (const c of t.races.flatMap((r) => r.cells)) {
      c.seen = sampleSeen(c.key);
      c.scarce = c.seen < 60;
      if (c.count > 0 && (t.rarest === undefined || c.seen < t.rarest.seen)) t.rarest = { target: c, seen: c.seen };
    }
    if (t.rarest === undefined) delete t.rarest;
    if (f.todayKill !== undefined && f.todayKill.zone === undefined) f.todayKill.zone = ZONES[0]!;
  }
  const bag = (owner: string, at: number) => {
    const f = d.friends.find((x) => x.owner === owner);
    const q = f === undefined ? undefined : d.hunt.quarry[f.hunts[0] ?? "Alliance"];
    if (f === undefined || q === undefined || f.todayDone) return;
    const guid = s.friends.find((x) => x.friendKey === owner)?.friendKey ?? owner;
    const kill: HuntKill = { owner, guid, day: s.schedule.day, at, zone: ZONES[0]!, target: q.target, quarry: true };
    f.todayDone = true;
    f.todayKill = kill;
    f.bagged = [kill, ...f.bagged];
    const me = s.friends.find((x) => x.friendKey === owner);
    for (const g of me?.today?.goals ?? []) if (g.goal.slot === "hunt") g.doneAt = at;
  };
  const other = s.friends.find(
    (f) => f.friendKey !== viewer && f.status === "active" && !f.pvpVirgin && f.today !== undefined,
  );
  if (other !== undefined) bag(other.friendKey, s.schedule.dayStart + 74 * 60);
  if (bagged && viewer !== undefined) bag(viewer, s.now - 3600);
  // The Hunt today's order: bagged first by time.
  const done = (o: string) => d.friends.find((x) => x.owner === o);
  d.hunt.friends = d.friends
    .map((f) => (f.todayKill !== undefined ? { owner: f.owner, kill: f.todayKill } : { owner: f.owner }))
    .sort(
      (a, b) =>
        Number(done(b.owner)?.todayDone) - Number(done(a.owner)?.todayDone) ||
        (a.kill?.at ?? Infinity) - (b.kill?.at ?? Infinity) ||
        (a.owner < b.owner ? -1 : 1),
    );
  d.hunt.bagged = d.friends.filter((f) => f.todayDone).length;
  return { snapshot: s, hunt: d };
}
