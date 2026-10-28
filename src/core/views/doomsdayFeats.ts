import { PVP_RANKS } from "../doomsday/feats";
import type { DoomsdaySnapshot, FeatRecord } from "../doomsday/snapshot";
import { compareText } from "./characters";
import { clockTime } from "./clock";

// The Doomsday page's Feats tab (WEB-60, board `doomsday-feats`): the group's feats newest first with "First in the
// group", a friend's own feats with the next steps (no total: Nico 2026-10-28), and the PvP rank titles. Feats a
// character already had when tracking began show only in that friend's own feats, as "before tracking".

/** The drawn icon of a feat (board `doomsday-feats`). */
export type FeatIcon = "rank" | "epic" | "mount" | "fish" | "skull" | "cook" | "sword" | "star";

const ICONS: Record<string, FeatIcon> = {
  pvpRank: "rank",
  firstEpic: "epic",
  notableItem: "epic",
  mount: "mount",
  epicMount: "mount",
  firstCatch: "fish",
  deaths100: "skull",
  professionCap: "cook",
  jackOfAllTrades: "cook",
  honorKills: "sword",
  duelWins: "sword",
  bgFirstWin: "sword",
};

export interface FeatView {
  key: string;
  icon: FeatIcon;
  /** The rank for a rank feat's insignia. */
  rank?: number;
  /** The title, split around the epic item so it can show in epic purple. */
  title: { before: string; epic?: string; after?: string };
  character: { name: string; classFile?: string };
  /** "today 20:14 · chest · item level 66", "before tracking". */
  meta: string;
  firstInGroup: boolean;
}

export interface OwnFeatView {
  key: string;
  title: string;
  /** "Ada Nightshade · 2 Oct", "412 / 1,000", "not yet", "Ada Nightshade · before tracking". */
  meta: string;
  done: boolean;
}

export interface FeatsView {
  group: FeatView[];
  friends: { key: string; name: string; href: string; current: boolean }[];
  /** "Your feats", "Mira's feats". */
  ownTitle: string;
  /** "4"; how many feats the friend has. */
  ownCount: number;
  own: OwnFeatView[];
  ranks: { rank: number; horde: string; alliance: string; title: string }[];
}

function when(at: number, now: number, timeZone: string): string {
  const text = clockTime(at, now, timeZone);
  // A day without its time for anything older than yesterday ("Sun 26 Oct").
  return text.startsWith("today ")
    ? text
    : text.startsWith("yesterday ")
      ? "yesterday"
      : text.replace(/, \d\d:\d\d$/, "");
}

function splitTitle(f: FeatRecord): FeatView["title"] {
  if (f.epicItem === undefined) return { before: f.title };
  const i = f.title.indexOf(f.epicItem);
  if (i < 0) return { before: f.title };
  const title: FeatView["title"] = { before: f.title.slice(0, i), epic: f.epicItem };
  const after = f.title.slice(i + f.epicItem.length);
  if (after !== "") title.after = after;
  return title;
}

function featView(f: FeatRecord, now: number, timeZone: string): FeatView {
  const view: FeatView = {
    key: f.id,
    icon: ICONS[f.kind] ?? "star",
    title: splitTitle(f),
    character: { name: f.character.name },
    meta: [f.alreadyHad ? "before tracking" : when(f.at, now, timeZone), f.detail]
      .filter((x) => x !== undefined)
      .join(" · "),
    firstInGroup: f.firstInGroup && !f.alreadyHad,
  };
  if (f.character.classFile !== undefined) view.character.classFile = f.character.classFile;
  if (f.rank !== undefined) view.rank = f.rank;
  return view;
}

export const GROUP_FEATS = 30;

export function featsView(
  s: DoomsdaySnapshot,
  friendKey: string | undefined,
  viewerKey: string | undefined,
  timeZone: string,
): FeatsView {
  const active = s.friends.filter((f) => f.status === "active");
  const ordered = [...active].sort(
    (a, b) => Number(b.friendKey === viewerKey) - Number(a.friendKey === viewerKey) || compareText(a.name, b.name),
  );
  const picked =
    ordered.find((f) => f.friendKey === friendKey) ?? ordered.find((f) => f.friendKey === viewerKey) ?? ordered[0];
  const byNewest = [...s.feats].sort((a, b) => b.at - a.at);
  const mine = byNewest.filter((f) => f.friendKey === picked?.friendKey);
  const own: OwnFeatView[] = mine.map((f) => ({
    key: f.id,
    title: f.title,
    meta: `${f.character.name} · ${f.alreadyHad ? "before tracking" : when(f.at, s.now, timeZone)}`,
    done: true,
  }));
  for (const p of picked?.featProgress ?? []) {
    own.push({
      key: `next:${p.kind}:${p.character?.guid ?? ""}:${p.title}`,
      title: p.title,
      meta:
        p.progress === undefined
          ? "not yet"
          : `${p.progress.value.toLocaleString("en-GB")} / ${p.progress.target.toLocaleString("en-GB")}`,
      done: false,
    });
  }
  const you = picked !== undefined && picked.friendKey === viewerKey;
  return {
    group: byNewest
      .filter((f) => !f.alreadyHad)
      .slice(0, GROUP_FEATS)
      .map((f) => featView(f, s.now, timeZone)),
    friends: ordered.map((f) => ({
      key: f.friendKey,
      name: f.name,
      href: `/doomsday/feats?friend=${encodeURIComponent(f.friendKey)}`,
      current: f.friendKey === picked?.friendKey,
    })),
    ownTitle: you || picked === undefined ? "Your feats" : `${picked.name}'s feats`,
    ownCount: mine.length,
    own,
    ranks: PVP_RANKS.map((r, rank) => ({
      rank,
      horde: rank === 0 ? "none" : r.horde,
      alliance: rank === 0 ? "none" : r.alliance,
      title: r.title,
    })),
  };
}
