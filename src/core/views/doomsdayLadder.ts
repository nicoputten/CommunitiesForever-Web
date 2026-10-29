import { PVP_RANKS, rankName } from "../doomsday/feats";
import type { DoomsdaySnapshot, FriendDoomsday, LadderRow, Track } from "../doomsday/snapshot";
import { localTime } from "../runTime";
import { compareText } from "./characters";
import { countdown } from "./doomsday";
import { initials } from "./text";
import { ordinal } from "../names";

// The Doomsday page's Ladder and PvP tabs (WEB-60, board `doomsday-ladder`): one ranking per track, never added
// together, rows that open to the split per character, PvP Virgins shown and never ranked; the PvP details of one
// friend (picked with chips, the viewer first: Nico 2026-10-28). Names only, never BattleTags.

export type LadderScope = "week" | "allTime";

export function parseLadderScope(value: unknown): LadderScope {
  return value === "all" ? "allTime" : "week";
}

export interface LadderCharacterView {
  guid: string;
  name: string;
  classFile?: string;
  points: string;
}

export interface LadderRowView {
  key: string;
  place: number;
  name: string;
  initials: string;
  you: boolean;
  /** "120", "≈240". */
  points: string;
  /** This week only: "▲ 1", "▼ 2", "– 0", "new", with a label for screen readers. */
  movement?: { kind: "up" | "down" | "same" | "new"; text: string; label: string };
  characters: LadderCharacterView[];
  /** The friend's PvP details (PvP ladder only). */
  href?: string;
}

export interface LadderTrackView {
  track: Track;
  /** "this week", "all time". */
  when: string;
  rows: LadderRowView[];
  /** PvP only: friends with no kill on any character, ever. */
  virgins: { key: string; name: string; initials: string }[];
}

export interface LadderView {
  scope: LadderScope;
  /** "week resets Sunday 19:00 · in 2 d 22 h". */
  resets: string;
  tracks: [LadderTrackView, LadderTrackView];
}

const pointsText = (n: number, approx: boolean | undefined) =>
  `${approx === true ? "≈" : ""}${n.toLocaleString("en-GB")}`;

function movement(row: LadderRow): LadderRowView["movement"] {
  const m = row.movement;
  if (m === undefined) return undefined;
  const by = m.by ?? 0;
  switch (m.kind) {
    case "up":
      return { kind: "up", text: `▲ ${by}`, label: `up ${by} since last week` };
    case "down":
      return { kind: "down", text: `▼ ${by}`, label: `down ${by} since last week` };
    case "new":
      return { kind: "new", text: "new", label: "new on the ladder this week" };
    default:
      return { kind: "same", text: "– 0", label: "same place as last week" };
  }
}

function rowView(row: LadderRow, viewerKey: string | undefined, track: Track, scope: LadderScope): LadderRowView {
  const view: LadderRowView = {
    key: row.friendKey,
    place: row.place,
    name: row.name,
    initials: initials(row.name),
    you: row.friendKey === viewerKey,
    points: pointsText(row.points, row.approx),
    characters: row.characters.map((c) => {
      const ch: LadderCharacterView = { guid: c.guid, name: c.name, points: pointsText(c.points, c.approx) };
      if (c.classFile !== undefined) ch.classFile = c.classFile;
      return ch;
    }),
  };
  const move = scope === "week" ? movement(row) : undefined;
  if (move !== undefined) view.movement = move;
  if (track === "pvp") view.href = pvpHref(row.friendKey);
  return view;
}

export function pvpHref(friendKey: string): string {
  return `/doomsday/pvp?friend=${encodeURIComponent(friendKey)}`;
}

export function ladderView(
  s: DoomsdaySnapshot,
  scope: LadderScope,
  viewerKey: string | undefined,
  timeZone: string,
): LadderView {
  const ladders = scope === "week" ? s.ladders.week : s.ladders.allTime;
  const when = scope === "week" ? "this week" : "all time";
  const sorted = (rows: readonly LadderRow[]) => [...rows].sort((a, b) => a.place - b.place);
  const virgins = s.friends
    .filter((f) => f.status === "active" && f.pvpVirgin)
    .sort((a, b) => compareText(a.name, b.name))
    .map((f) => ({ key: f.friendKey, name: f.name, initials: initials(f.name) }));
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long" }).format(
    new Date(s.schedule.weekReset * 1000),
  );
  return {
    scope,
    resets: `week resets ${weekday} ${localTime(s.schedule.weekReset, timeZone)} · in ${countdown(s.schedule.weekReset, s.now)}`,
    tracks: [
      {
        track: "pve",
        when,
        rows: sorted(ladders.pve).map((r) => rowView(r, viewerKey, "pve", scope)),
        virgins: [],
      },
      {
        track: "pvp",
        when,
        rows: sorted(ladders.pvp).map((r) => rowView(r, viewerKey, "pvp", scope)),
        virgins,
      },
    ],
  };
}

// ── PvP details ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface PvpRankView {
  guid: string;
  name: string;
  classFile?: string;
  rank: number;
  /** "Stone Guard · rank 6"; "No rank yet" at 0. */
  rankText: string;
  /** "Mailbox Menace"; "Conscientious Objector" at 0. */
  title: string;
}

export interface DuelGridView {
  /** The friends in the grid, rows and columns in the same order. */
  names: { key: string; name: string }[];
  /** cells[row][column]: "4–2" with the row friend's result; undefined on the diagonal or without duels. */
  cells: ({ text: string; result: "won" | "lost" | "even" } | undefined)[][];
}

export interface PvpView {
  /** The friend chips, the viewer first. */
  friends: { key: string; name: string; href: string; current: boolean }[];
  name: string;
  you: boolean;
  /** No PvP data for this friend yet. */
  empty?: string;
  pvpVirgin: boolean;
  kills?: { total: string; detail: string; approx: boolean };
  ranks: PvpRankView[];
  byZone: { zone: string; kills: number; percent: number }[];
  duels?: {
    /** "7 won · 5 lost" as parts. */
    won: number;
    lost: number;
    grid: DuelGridView;
    elo?: {
      rating: string;
      change?: { kind: "up" | "down"; text: string };
      /** "2nd · Bob 1,112", "1st". */
      place: string;
    };
  };
  battlegrounds: { name: string; won: number; lost: number; kills: number }[];
  firstWins?: string;
}

/**
 * A character's rank. Without one: "Conscientious Objector" only while its friend is a PvP Virgin, otherwise "No rank
 * yet · 12 kills" (live test 2026-10-29).
 */
function rankView(
  c: NonNullable<FriendDoomsday["pvp"]>["characters"][number],
  virgin: boolean,
): PvpRankView | undefined {
  const rank = c.highestRank ?? c.rank;
  if (rank === undefined) return undefined;
  const now = c.rank ?? rank;
  const name = rankName(now, c.faction);
  const kills = c.hk ?? 0;
  const view: PvpRankView = {
    guid: c.guid,
    name: c.name,
    rank: now,
    rankText:
      name !== undefined
        ? `${name} · rank ${now}`
        : virgin
          ? "No rank yet"
          : `No rank yet · ${kills} ${kills === 1 ? "kill" : "kills"}`,
    title: now > 0 || virgin ? (PVP_RANKS[now]?.title ?? "") : "",
  };
  if (c.classFile !== undefined) view.classFile = c.classFile;
  return view;
}

/** The head-to-head grid between every friend with duels, from each friend's own record. */
function duelGrid(s: DoomsdaySnapshot): DuelGridView {
  const duelists = s.friends.filter((f) => f.pvp !== undefined && f.pvp.duels.vs.some((v) => v.won + v.lost > 0));
  const names = duelists.map((f) => ({ key: f.friendKey, name: f.name }));
  const cells = duelists.map((row) =>
    duelists.map((col) => {
      if (row.friendKey === col.friendKey) return undefined;
      const vs = row.pvp!.duels.vs.find((v) => v.friendKey === col.friendKey);
      if (vs === undefined || vs.won + vs.lost === 0) return undefined;
      const result: "won" | "lost" | "even" = vs.won > vs.lost ? "won" : vs.won < vs.lost ? "lost" : "even";
      return { text: `${vs.won}–${vs.lost}`, result };
    }),
  );
  return { names, cells };
}

export function pvpView(s: DoomsdaySnapshot, friendKey: string | undefined, viewerKey: string | undefined): PvpView {
  const active = s.friends.filter((f) => f.status === "active");
  const ordered = [...active].sort(
    (a, b) => Number(b.friendKey === viewerKey) - Number(a.friendKey === viewerKey) || compareText(a.name, b.name),
  );
  const picked =
    ordered.find((f) => f.friendKey === friendKey) ?? ordered.find((f) => f.friendKey === viewerKey) ?? ordered[0];
  const view: PvpView = {
    friends: ordered.map((f) => ({
      key: f.friendKey,
      name: f.name,
      href: pvpHref(f.friendKey),
      current: f.friendKey === picked?.friendKey,
    })),
    name: picked?.name ?? "",
    you: picked !== undefined && picked.friendKey === viewerKey,
    pvpVirgin: picked?.pvpVirgin === true,
    ranks: [],
    byZone: [],
    battlegrounds: [],
  };
  const pvp = picked?.pvp;
  if (picked === undefined || pvp === undefined) {
    view.empty = "No PvP data yet. It shows after an upload with a CommunitiesForever version that records PvP.";
    return view;
  }
  view.kills = {
    total: pvp.week.kills.toLocaleString("en-GB"),
    detail: `${pvp.week.solo} solo · ${pvp.week.skulls} ${pvp.week.skulls === 1 ? "skull" : "skulls"}`,
    approx: pvp.week.approx === true,
  };
  view.ranks = pvp.characters
    .map((c) => rankView(c, picked.pvpVirgin))
    .filter((r): r is PvpRankView => r !== undefined);
  const most = Math.max(1, ...pvp.byZone.map((z) => z.kills));
  view.byZone = pvp.byZone.map((z) => ({ zone: z.zone, kills: z.kills, percent: Math.round((z.kills / most) * 100) }));

  const duels: NonNullable<PvpView["duels"]> = { won: pvp.duels.won, lost: pvp.duels.lost, grid: duelGrid(s) };
  const elo = pvp.duels.elo;
  if (elo !== undefined) {
    const rated = active
      .filter((f) => f.pvp?.duels.elo !== undefined)
      .sort((a, b) => a.pvp!.duels.elo!.place - b.pvp!.duels.elo!.place);
    const leader = rated[0];
    const place =
      elo.place === 1 || leader === undefined || leader.friendKey === picked.friendKey
        ? ordinal(elo.place)
        : `${ordinal(elo.place)} · ${leader.name} ${leader.pvp!.duels.elo!.rating.toLocaleString("en-GB")}`;
    duels.elo = { rating: elo.rating.toLocaleString("en-GB"), place };
    if (elo.change !== 0) {
      duels.elo.change =
        elo.change > 0 ? { kind: "up", text: `▲ ${elo.change}` } : { kind: "down", text: `▼ ${-elo.change}` };
    }
  }
  view.duels = duels;
  view.battlegrounds = pvp.battlegrounds.map((b) => ({ name: b.name, won: b.won, lost: b.lost, kills: b.kills }));
  if (pvp.firstWins.length > 0) view.firstWins = `First wins unlocked: ${pvp.firstWins.join(", ")}`;
  return view;
}
