import type { Milestone } from "../bot";
import { initials } from "../views/text";
import { timeAgo } from "../views/age";
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

export function cardSize(spec: CardSpec): { width: number; height: number } {
  return spec.kind === "award" || spec.kind === "zoneHeader" || spec.kind === "headline"
    ? { width: 1200, height: 400 }
    : { width: 800, height: 400 };
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

/** The Zone of the week card's map. */
export function zoneCard(zoneName: string, count: number, host: string): CardSpec | undefined {
  const zone = zoneByName(zoneName);
  const crop = zone !== undefined ? cropAround(zone.id, 2, 0.6, [0.45, 0.45]) : undefined;
  if (crop === undefined) return undefined;
  return { kind: "zone", overline: "Zone of the week", zone: zoneName, stat: friends(count), crop, host };
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
