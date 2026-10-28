import { and, desc, eq } from "drizzle-orm";
import type { Milestone, MilestonesEvent } from "@/core/bot";
import {
  type CardSpec,
  type CharacterFacts,
  featCard,
  milestoneCard,
  recapHeader,
  whereisCard,
  zoneCard,
} from "@/core/cards/models";
import { classLabel } from "@/core/recap/cards";
import { recapChar } from "@/core/recap/input";
import { recapDates } from "@/core/recap/when";
import type { Db } from "../db";
import { botEvents, recaps, sightings } from "../db/schema";
import { recapSchedule } from "../recap";
import { loadState } from "../uploads";

// Which card image an id names (WEB-41d, docs/BOT-API.md "Card images"), from what the site has stored:
// - `recap-<week>-header`: the recap's header (the award winner, else the busiest zone, else the headline)
// - `recap-<week>-zone`: the Zone of the week card's map, when the recap has that card
// - `milestone-<event>-<n>`: the n-th milestone of a `milestones` event, when it is worth an image (feats: WEB-56)
// - `whereis-<guid>`: where a character was last seen (for /whereis)
// Undefined for anything else, so the route answers 404.

/** The site's host for the cards' footer ("wow.vestras.nl"), from AUTH_URL. */
export function cardHost(env: Record<string, string | undefined> = process.env): string {
  try {
    return new URL(env.AUTH_URL ?? "").host;
  } catch {
    return "";
  }
}

function facts(db: Db, guid: string): CharacterFacts | undefined {
  const state = loadState(db);
  const c = state?.data.characters[guid];
  const rc = c !== undefined ? recapChar(c) : undefined;
  if (rc === undefined) return undefined;
  const out: CharacterFacts = { name: rc.name };
  if (rc.classFile !== undefined) {
    out.classFile = rc.classFile;
    out.classLabel = classLabel(rc.classFile);
  }
  if (rc.race !== undefined) out.race = rc.race;
  if (rc.spec !== undefined) out.spec = rc.spec;
  const owner = state?.data.people[rc.owner]?.displayName;
  if (owner !== undefined) out.owner = owner;
  return out;
}

function recapCard(db: Db, week: number, which: string, host: string): CardSpec | undefined {
  const row = db.select().from(recaps).where(eq(recaps.week, week)).get();
  if (row === undefined) return undefined;
  const r = row.data;
  const zoneCardFacts = r.cards.find((c) => c.id === "S1")?.facts;
  if (which === "zone") {
    return zoneCardFacts === undefined
      ? undefined
      : zoneCard(String(zoneCardFacts.zone), Number(zoneCardFacts.friends), host);
  }
  if (which !== "header") return undefined;
  const winner = r.award?.friends[0];
  const winnerClass = Object.values(row.snapshot)
    .filter((c) => c.owner === winner)
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0]?.classFile;
  return recapHeader(
    {
      dates: recapDates(recapSchedule(db).timeZone, r.start, r.end),
      headline: r.headline.text,
      ...(r.award !== undefined
        ? {
            award: {
              title: r.award.name.split(" · ")[0]!,
              friend: String(r.award.facts.friend ?? r.award.title),
              amount: String(r.award.facts.amount ?? ""),
              ...(winnerClass !== undefined ? { classFile: winnerClass } : {}),
            },
          }
        : {}),
      ...(zoneCardFacts !== undefined
        ? { zone: { name: String(zoneCardFacts.zone), friends: Number(zoneCardFacts.friends) } }
        : {}),
    },
    host,
  );
}

function milestone(db: Db, eventId: number, n: number, host: string): CardSpec | undefined {
  const event = db
    .select()
    .from(botEvents)
    .where(and(eq(botEvents.id, eventId), eq(botEvents.type, "milestones")))
    .get();
  const m: Milestone | undefined = (event?.data as MilestonesEvent | undefined)?.milestones?.[n];
  if (m === undefined) return undefined;
  const known = facts(db, m.character.guid);
  const c: CharacterFacts = known ?? { name: m.character.name ?? "A character" };
  if (known === undefined && m.character.classFile !== undefined) c.classFile = m.character.classFile;
  if (c.owner === undefined && m.character.ownerName !== undefined) c.owner = m.character.ownerName;
  return featCard(m, c, host) ?? milestoneCard(m, c, host);
}

function whereis(db: Db, guid: string, now: number, host: string): CardSpec | undefined {
  const c = facts(db, guid);
  if (c === undefined) return undefined;
  const seen = db
    .select({ zone: sightings.zone, seenAt: sightings.seenAt })
    .from(sightings)
    .where(eq(sightings.guid, guid))
    .orderBy(desc(sightings.seenAt))
    .limit(20)
    .all();
  return whereisCard(c, seen, now, host);
}

/** The card an id names, or undefined. */
export function cardFor(db: Db, id: string, now: number, host = cardHost()): CardSpec | undefined {
  let m = /^recap-(\d{1,5})-(header|zone)$/.exec(id);
  if (m !== null) return recapCard(db, Number(m[1]), m[2]!, host);
  m = /^milestone-(\d{1,15})-(\d{1,3})$/.exec(id);
  if (m !== null) return milestone(db, Number(m[1]), Number(m[2]), host);
  m = /^whereis-([A-Za-z0-9-]{1,64})$/.exec(id);
  if (m !== null) return whereis(db, m[1]!, now, host);
  return undefined;
}
