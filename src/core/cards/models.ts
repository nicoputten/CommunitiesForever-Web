import type { Milestone } from "../bot";
import { type FeatFields, type FeatKind, featCardSize, featText, MAX_PVP_RANK, type Notable } from "../doomsday/feats";
import { initials } from "../views/text";
import { timeAgo } from "../views/age";
import type { BoardData, boardSummary } from "../doomsday/posts";
import { clockAt, duration } from "../doomsday/rules";
import { cropAround, type Crop, inCrop, zoneByName } from "./mapCrop";
import { type CardToken, classColours } from "./palette";

// What each card image shows (WEB-41d; Nico's references in design/cards/). Pure: the server gathers the facts, the
// renderer (src/server/cards/render.tsx) draws these. Full character names, display names for friends, never
// BattleTags; initials only on a disc (CLAUDE.md rule 3).

export interface Disc {
  initials: string;
  fill: CardToken;
  on: CardToken;
}

export type CardSpec =
  | {
      /** Milestones: level 60, new character at 60, profession 300 (800 × 400). */
      kind: "milestone";
      overline: string;
      title: string;
      name: string;
      nameColour: CardToken;
      lines: string[];
      disc: Disc;
      host: string;
    }
  | {
      /** Recap header with the award winner (1200 × 400). */
      kind: "award";
      overline: string;
      title: string;
      name: string;
      stat: string;
      disc: Disc;
      host: string;
    }
  | {
      /** Recap header with the busiest zone (1200 × 400), or the Zone of the week card (800 × 400). */
      kind: "zoneHeader" | "zone";
      overline: string;
      label?: string;
      zone: string;
      stat: string;
      crop: Crop;
      host: string;
    }
  | {
      /** Recap header of a week without award or zone: the headline (1200 × 400). */
      kind: "headline";
      overline: string;
      title: string;
      stat: string;
      host: string;
    }
  | FeatCardSpec
  | StripCardSpec
  | BoardCardSpec
  | {
      /** /whereis: where a character was last seen, with earlier sightings (800 × 400). */
      kind: "whereis";
      name: string;
      nameColour: CardToken;
      line: string;
      disc: Disc;
      crop: Crop;
      markers: { x: number; y: number; label: string; age: "now" | "recent" | "old" }[];
      host: string;
    };

/** The drawn icons of the feat cards (board doomsday-feat-cards; the ones it lacks drawn in its style, Nico 2026-10-28). */
export type FeatIcon =
  | "rank"
  | "epic"
  | "mount"
  | "jack"
  | "reaper"
  | "kills"
  | "bar"
  | "cloth"
  | "leather"
  | "fish"
  | "pole"
  | "level"
  | "skull";

/** A strip feat card (WEB-66, board `bot-visual-feats`, 800 × 240): the icon left, the texts right. */
export interface StripCardSpec {
  kind: "strip";
  icon: FeatIcon;
  rank?: number;
  title: string;
  name: string;
  nameColour: CardToken;
  line: string;
  firstInGroup: boolean;
}

/** A feat card (WEB-56, 800 × 400): the icon or rank badge left in its glow, the texts right. */
export interface FeatCardSpec {
  kind: "feat";
  icon: FeatIcon;
  /** The rank on a rank badge. */
  rank?: number;
  title: string;
  /** Epic purple for the first epic's item name, else pale gold. */
  titleColour: CardToken;
  /** Long titles use the smaller size. */
  longTitle: boolean;
  name: string;
  nameColour: CardToken;
  line: string;
  meta?: string;
  firstInGroup: boolean;
  /** Rank 14: a second, wider frame. */
  special: boolean;
  glow: CardToken;
  host: string;
}

export function cardSize(spec: CardSpec): { width: number; height: number } {
  if (spec.kind === "award" || spec.kind === "zoneHeader" || spec.kind === "headline")
    return { width: 1200, height: 400 };
  if (spec.kind === "strip") return { width: 800, height: 240 };
  if (spec.kind === "board") return { width: 800, height: 560 };
  // WEB-66: the recap's zone crop is 800 × 450.
  if (spec.kind === "zone") return { width: 800, height: 450 };
  return { width: 800, height: 400 };
}

function disc(name: string, classFile: string | undefined): Disc {
  const c = classColours(classFile);
  return { initials: initials(name), fill: c.fill, on: c.on };
}

/** "Undead Mage · Frost" from what is known. */
function lineage(c: { race?: string; classLabel?: string; spec?: string }): string {
  const who = [c.race, c.classLabel].filter(Boolean).join(" ");
  return [who, c.spec].filter(Boolean).join(" · ");
}

export interface CharacterFacts {
  name: string;
  classFile?: string;
  classLabel?: string;
  race?: string;
  spec?: string;
  owner?: string;
}

/**
 * A milestone worth an image: a character at 60, a new character first seen at 60, a profession at 300. Other
 * milestones (every 10 levels, lower caps) are posted as text only; undefined for them.
 */
export function milestoneCard(m: Milestone, c: CharacterFacts, host: string): CardSpec | undefined {
  const colours = classColours(c.classFile);
  const base = { name: c.name, nameColour: colours.text, disc: disc(c.name, c.classFile), host };
  const second = lineage(c);
  if (m.kind === "maxLevel") {
    const first = c.owner !== undefined ? `From level ${m.from} · ${c.owner}` : `From level ${m.from}`;
    return { kind: "milestone", overline: "Milestone", title: `Level ${m.level}`, lines: [first, second], ...base };
  }
  if (m.kind === "newCharacter" && (m.character.level ?? 0) >= 60) {
    return {
      kind: "milestone",
      overline: "New character",
      title: "Level 60",
      lines: ["New character · first seen at 60", second],
      ...base,
    };
  }
  if (m.kind === "professionCap" && m.rank >= 300) {
    const profession = m.profession ?? "Profession";
    const first = c.owner !== undefined ? `${profession} mastered · ${c.owner}` : `${profession} mastered`;
    return {
      kind: "milestone",
      overline: "Milestone",
      title: `${profession} ${m.rank}`,
      lines: [first, second],
      ...base,
    };
  }
  return undefined;
}

export interface RecapHeaderInput {
  /** "WEEKLY RECAP · 20–26 OCT" is built from it. */
  dates: string;
  headline: string;
  award?: { title: string; friend: string; amount: string; classFile?: string };
  /** The busiest zone and how many friends were in it. */
  zone?: { name: string; friends: number };
}

/** The recap's header: the award winner, else the busiest zone, else the headline. */
export function recapHeader(r: RecapHeaderInput, host: string): CardSpec {
  const overline = `Weekly recap · ${r.dates}`;
  if (r.award !== undefined) {
    return {
      kind: "award",
      overline,
      title: r.award.title,
      name: r.award.friend,
      stat: r.award.amount,
      disc: { ...disc(r.award.friend, r.award.classFile), initials: initials(r.award.friend).slice(0, 1) },
      host,
    };
  }
  const zone = r.zone !== undefined ? zoneByName(r.zone.name) : undefined;
  const crop = zone !== undefined ? cropAround(zone.id, 0.45 * 3, 0.7, [0.6, 0.5]) : undefined;
  if (r.zone !== undefined && crop !== undefined) {
    return {
      kind: "zoneHeader",
      overline,
      label: "Busiest zone",
      zone: r.zone.name,
      stat: friends(r.zone.friends),
      crop,
      host,
    };
  }
  return { kind: "headline", overline, title: r.headline, stat: "", host };
}

const friends = (n: number) => `${n} ${n === 1 ? "friend" : "friends"}`;

/**
 * The zone crop of a recap card with a map (800 × 450 since WEB-66): Zone of the week with its friends, or Bloodbath
 * zone with its honorable kills.
 */
export function zoneCard(
  zoneName: string,
  count: number,
  host: string,
  bloodbath?: { kills: number },
): CardSpec | undefined {
  const zone = zoneByName(zoneName);
  const crop = zone !== undefined ? cropAround(zone.id, 800 / 450, 0.6, [0.45, 0.45]) : undefined;
  if (crop === undefined) return undefined;
  return bloodbath !== undefined
    ? {
        kind: "zone",
        overline: "Bloodbath zone",
        zone: zoneName,
        stat: `${bloodbath.kills.toLocaleString("en-US")} honorable kills`,
        crop,
        host,
      }
    : { kind: "zone", overline: "Zone of the week", zone: zoneName, stat: friends(count), crop, host };
}

export interface Seen {
  zone: string;
  seenAt: number;
}

/**
 * /whereis: the newest sighting's zone on the map, and up to two earlier ones in other zones. A sighting older than
 * 7 days is "old" (the data age scale's week, DESIGN.md §4).
 */
export function whereisCard(
  c: CharacterFacts,
  sightings: readonly Seen[],
  now: number,
  host: string,
): CardSpec | undefined {
  const newest = [...sightings].sort((a, b) => b.seenAt - a.seenAt);
  const last = newest[0];
  const zone = last !== undefined ? zoneByName(last.zone) : undefined;
  if (last === undefined || zone === undefined) return undefined;
  const crop = cropAround(zone.id, 2, 0.5, [0.5, 0.68])!;
  const shown: Seen[] = [last];
  for (const s of newest.slice(1)) {
    if (shown.length >= 3) break;
    if (!shown.some((x) => x.zone === s.zone) && zoneByName(s.zone) !== undefined) shown.push(s);
  }
  const markers = shown.flatMap((s, i) => {
    const z = zoneByName(s.zone)!;
    const [x, y] = inCrop(crop, z.lx, z.ly);
    // Off the crop, or under the name in the top left corner: left out.
    if (x < 0.05 || x > 0.8 || y < 0.12 || y > 0.85 || (y < 0.3 && x < 0.75)) return [];
    const ageDays = (now - s.seenAt) / 86400;
    const age: "now" | "recent" | "old" = i === 0 ? "now" : ageDays > 7 ? "old" : "recent";
    return [{ x, y, label: timeAgo(s.seenAt, now), age }];
  });
  return {
    kind: "whereis",
    name: c.name,
    nameColour: classColours(c.classFile).text,
    line: `Last seen in ${last.zone} · ${timeAgo(last.seenAt, now)}`,
    disc: disc(c.name, c.classFile),
    crop,
    markers,
    host,
  };
}

const NOTABLE_ICONS: Readonly<Record<Notable, FeatIcon>> = {
  arcaniteReaper: "reaper",
  arcaniteTransmute: "bar",
  mooncloth: "cloth",
  devilsaur: "leather",
  extravaganzaJoined: "fish",
  extravaganzaWon: "pole",
};

/** The icon of a feat (the drawn icons of the feat cards; WEB-66 adds level and skull for the strip cards). */
export function featIcon(kind: FeatKind, fields: FeatFields): FeatIcon {
  switch (kind) {
    case "pvpRank":
      return "rank";
    case "firstEpic":
      return "epic";
    case "mount":
    case "epicMount":
      return "mount";
    case "jackOfAllTrades":
      return "jack";
    case "notableItem":
      return NOTABLE_ICONS[fields.notable ?? "arcaniteReaper"];
    case "firstCatch":
      return "fish";
    case "deaths100":
      return "skull";
    case "professionCap":
      return "bar";
    case "level":
    case "maxLevel":
    case "newCharacter":
      return "level";
    default:
      return "kills";
  }
}

/** Titles longer than this use the smaller title size (the board's 46 px ones). */
const LONG_TITLE = 14;

/**
 * The card of a feat of WEB-56 (the kinds of WEB-38 keep milestoneCard), as the board doomsday-feat-cards draws it.
 * Undefined for a feat without an image.
 */
export function featCard(m: Milestone, c: CharacterFacts, host: string): CardSpec | undefined {
  const fields = m as FeatFields;
  if (m.kind === "level" || m.kind === "maxLevel" || m.kind === "professionCap" || m.kind === "newCharacter") {
    return undefined;
  }
  if (featCardSize({ kind: m.kind, fields, firstInGroup: m.firstInGroup === true }) !== "big") return undefined;
  const t = featText({ kind: m.kind, fields }, c.name);
  const who = lineage(c);
  const icon = featIcon(m.kind, fields);
  let meta = t.flavour;
  if (m.kind === "pvpRank") {
    meta = [who, fields.rank === MAX_PVP_RANK ? "the summit. Please go outside." : undefined]
      .filter(Boolean)
      .join(" · ");
  }
  const spec: FeatCardSpec = {
    kind: "feat",
    icon,
    title: t.title,
    titleColour: m.kind === "firstEpic" ? "--epic" : "--gold-pale",
    longTitle: t.title.length > LONG_TITLE,
    name: c.name,
    nameColour: classColours(c.classFile).text,
    line: t.line,
    firstInGroup: m.firstInGroup === true,
    special: m.kind === "pvpRank" && fields.rank === MAX_PVP_RANK,
    glow: m.kind === "firstEpic" ? "--card-epic-glow" : "--card-feat-glow",
    host,
  };
  if (fields.rank !== undefined && m.kind === "pvpRank") spec.rank = fields.rank;
  if (meta !== undefined && meta !== "") spec.meta = meta;
  return spec;
}

/**
 * The strip card (WEB-66, 800 × 240) of a feat that has no big card: the icon, FEAT UNLOCKED, the title, the character
 * in class colour and one line. Undefined for a new character.
 */
export function stripCard(m: Milestone, c: CharacterFacts): StripCardSpec | undefined {
  if (m.kind === "newCharacter") return undefined;
  const fields: FeatFields =
    m.kind === "level" || m.kind === "maxLevel"
      ? { level: m.level }
      : m.kind === "professionCap"
        ? { rank: m.rank, ...(m.title !== undefined ? { title: m.title } : {}) }
        : (m as FeatFields);
  const profession = m.kind === "professionCap" ? m.profession : undefined;
  const t = featText({ kind: m.kind, fields, ...(profession !== undefined ? { profession } : {}) }, c.name);
  const spec: StripCardSpec = {
    kind: "strip",
    icon: featIcon(m.kind, fields),
    title: t.title,
    name: c.name,
    nameColour: classColours(c.classFile).text,
    line: t.flavour !== undefined ? `${t.line} · ${t.flavour}` : t.line,
    firstInGroup: m.firstInGroup === true,
  };
  if (m.kind === "pvpRank" && fields.rank !== undefined) spec.rank = fields.rank;
  return spec;
}

/** The daily Doomsday board image (WEB-66, board `bot-visual-daily`, 800 × 560). */
export interface BoardCardSpec {
  kind: "board";
  /** "Wed evening · just started", "Wed evening · Thu 13:10", "Wed evening · final". */
  title: string;
  columns: { track: "pve" | "pvp"; label: string }[];
  rows: {
    name: string;
    /** All PvE dailies done. */
    struck: boolean;
    crown: boolean;
    done: boolean[];
    virgin: boolean;
    today: { pve: number; pvp: number | null };
    streak: number;
  }[];
  /** "resets Thu 19:00", "resets in 5 h 50 m", "Mira first at 23:13 · 14 goals done". */
  footer: string;
  host: string;
}

/** At most this many friends on the board image; it is read at 300 px on a phone (the most goals done first). */
export const BOARD_ROWS = 6;

/**
 * The board image of a `doomsdayBoard` or `doomsdayBoardUpdate` event as it was at `at` (its creation), in realm time.
 * Friends without Doomsday data are left out (the news line counts them).
 */
export function boardCard(
  data: BoardData & { final?: boolean; summary?: ReturnType<typeof boardSummary> },
  at: number,
  timeZone: string,
  host: string,
): BoardCardSpec {
  const clock = (t: number) => clockAt(t, data.start, timeZone);
  const fresh = !data.final && at - data.start < 10 * 60;
  const state = data.final === true ? "final" : fresh ? "just started" : clock(at);
  const resetAt = clockAt(data.end, data.start, timeZone);
  const goalsDone = data.summary?.goalsDone ?? 0;
  const footer =
    data.final === true
      ? [
          data.crown !== null ? `${data.crown.name} first at ${clock(data.crown.at)}` : undefined,
          `${goalsDone} goals done`,
        ]
          .filter((x) => x !== undefined)
          .join(" · ")
      : fresh
        ? `resets ${resetAt}`
        : `resets in ${duration(data.end - at)}`;
  return {
    kind: "board",
    title: `${data.label} · ${state}`,
    columns: data.goals.map((g) => ({ track: g.track, label: g.shortLabel })),
    rows: data.friends.slice(0, BOARD_ROWS).map((f) => ({
      name: f.name,
      struck: f.crossedOut,
      crown: data.crown?.name === f.name,
      done: data.goals.map((g) => f.goals.some((x) => x.slot === g.slot && x.done)),
      virgin: f.pvpVirgin,
      today: f.today,
      streak: f.streak,
    })),
    footer,
    host,
  };
}
