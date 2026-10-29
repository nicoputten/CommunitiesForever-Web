import { CARDS, groupFit, prediction } from "./cards";
import {
  best,
  byFriend,
  friendsByZone,
  friendsPlayed,
  levelGains,
  levelOf,
  MAX_LEVEL,
  newCharacters,
  professionGains,
  runs,
  zonesByFriend,
} from "./facts";
import { fill, hash, nextPhrasing, seeded } from "./phrasing";
import { v2Totals } from "./cardsV2";
import { CARD_TEXTS, CHALLENGE_TEXTS, CLOSING_TEXTS, HEADLINE_TEXTS } from "./texts";
import type { Candidate, CardDef, Cycles, History, PastWeek, Recap, RecapCard, Slot, Week } from "./types";

// The weekly recap (WEB-41; rotation rules on the `bot-recap` board, decided with Nico 2026-10-27):
// - the core numbers, a headline, the award (<site> of the week), four rotating cards (one stat, one progress, one
//   social, one fun) and a challenge;
// - a card only when the week meets its threshold and it wasn't shown in the last 4 weeks; the highest score per
//   slot; ties broken with the week number as seed, so a re-run gives the same recap;
// - at most one card per friend, and the award winner on no other card;
// - a quiet week (under 3 levels in total) gets the short recap: the numbers, one fun card and a challenge.

export const COOLDOWN_WEEKS = 4;
export const QUIET_LEVELS = 3;
const ROTATING: Slot[] = ["stat", "progress", "social", "fun"];

interface Found {
  def: CardDef;
  candidate: Candidate;
  /** Tie breaker: seeded by the week number and the card. */
  tie: number;
}

function findAll(week: Week, history: History): Found[] {
  const out: Found[] = [];
  for (const def of CARDS) {
    const candidate = def.find(week, history);
    if (candidate === undefined) continue;
    out.push({ def, candidate, tie: seeded(hash(def.id) ^ week.number)() });
  }
  return out;
}

const better = (a: Found, b: Found) => b.candidate.score - a.candidate.score || b.tie - a.tie;

function onCooldown(history: History, week: number): Set<string> {
  return new Set(
    history.weeks.filter((w) => w.number >= week - COOLDOWN_WEEKS && w.number < week).flatMap((w) => w.cards),
  );
}

/** Picks the award and the rotating cards. */
export function rotate(
  week: Week,
  history: History,
  found: Found[],
  quiet: boolean,
): { award?: Found; cards: Found[] } {
  const award = quiet ? undefined : found.filter((f) => f.def.slot === "award").sort(better)[0];
  const taken = new Set(award?.candidate.friends ?? []);
  const cooldown = onCooldown(history, week.number);
  const cards: Found[] = [];
  for (const slot of quiet ? (["fun"] as Slot[]) : ROTATING) {
    const pick = found
      .filter((f) => f.def.slot === slot && !cooldown.has(f.def.id))
      .filter((f) => f.candidate.friends.every((friend) => !taken.has(friend)))
      .sort(better)[0];
    if (pick === undefined) continue;
    cards.push(pick);
    for (const friend of pick.candidate.friends) taken.add(friend);
  }
  return award === undefined ? { cards } : { award, cards };
}

/** The headline's kind and facts: the week's biggest story, in this order. */
/** WEB-57: the PvP headline (kills >= 200, one zone >= 40% of them) and the danger one (deaths >= 25, at least 1.5x the
 * average of the last 4 weeks). */
export const PVP_HEADLINE_KILLS = 200;
export const DANGER_DEATHS = 25;

export function headlineFor(
  week: Week,
  quiet: boolean,
  history: History = { weeks: [], cycles: {} },
): { id: string; facts: Record<string, string | number> } {
  const levels = [...levelGains(week).values()].reduce((a, b) => a + b, 0);
  const hit60 = Object.values(week.after)
    .filter(
      (c) => levelOf(c) >= MAX_LEVEL && week.before[c.guid] !== undefined && levelOf(week.before[c.guid]) < MAX_LEVEL,
    )
    .sort((a, b) => a.name.localeCompare(b.name))[0];
  const at60 = Object.values(week.after).filter((c) => levelOf(c) >= MAX_LEVEL).length;
  const dungeonRuns = runs(week).filter((r) => r.kind === "party" || r.kind === "raid").length;
  const points = [...professionGains(week).values()].reduce((a, b) => a + b, 0);
  const zones = Math.max(0, ...[...zonesByFriend(week).values()].map((z) => z.size));
  const busiest = best(new Map([...friendsByZone(week)].map(([z, f]) => [z, f.size])))?.[0] ?? "Azeroth";
  const alts = newCharacters(week).length;
  if (week.number % 10 === 0) return { id: "season", facts: { weeks: week.number } };
  if (week.number === 1) return { id: "first", facts: {} };
  if (hit60 !== undefined) return { id: at60 > 1 ? "club" : "sixty", facts: { character: hit60.name } };
  const t = v2Totals(week);
  if (t.kills >= PVP_HEADLINE_KILLS && t.topKillZone !== undefined && t.topKillZone.kills >= 0.4 * t.kills) {
    return { id: "pvp", facts: { zone: t.topKillZone.zone, kills: t.kills } };
  }
  const past = history.weeks
    .filter((w) => w.number >= week.number - 4 && w.number < week.number)
    .map((w) => w.values.deaths)
    .filter((v): v is number => v !== undefined);
  const average = past.length > 0 ? past.reduce((a, b) => a + b, 0) / past.length : 0;
  if (t.deaths >= DANGER_DEATHS && t.deaths >= 1.5 * average) return { id: "danger", facts: { deaths: t.deaths } };
  if (quiet) return { id: "quiet", facts: {} };
  if (alts >= 2) return { id: "alts", facts: { alts } };
  if (dungeonRuns >= 5) return { id: "dungeons", facts: { runs: dungeonRuns } };
  if (points >= 50) return { id: "crafters", facts: { points } };
  if (zones >= 7) return { id: "tourists", facts: { zones } };
  return { id: "levels", facts: { levels, zone: busiest } };
}

/** The challenges that fit the week, in order of preference. */
export function challengesFor(
  week: Week,
  happened: { headline?: string; cards?: string[] } = {},
): { id: string; facts: Record<string, string | number> }[] {
  const out: { id: string; facts: Record<string, string | number> }[] = [];
  const chars = Object.values(week.after);
  if (week.number % 10 === 0) out.push({ id: "nextSeason", facts: {} });
  // WEB-57: the PvP challenges, after the week that calls for them (boards `bot-recap-v2-cards`).
  const t = v2Totals(week);
  if (happened.headline === "danger") out.push({ id: "noDeaths", facts: {} });
  if (happened.headline === "pvp") out.push({ id: "kills25", facts: {} });
  if (t.bgGames >= 3) out.push({ id: "bgGroup", facts: {} });
  if (t.topKillZones.includes("Hillsbrad Foothills")) out.push({ id: "tarrenMill", facts: {} });
  if (happened.cards?.includes("F15")) out.push({ id: "duelEveryone", facts: {} });
  if (chars.some((c) => levelOf(c) > 0 && levelOf(c) < 10)) out.push({ id: "everyoneTo10", facts: {} });
  const group = groupFit(week);
  if (group !== undefined) {
    out.push({ id: "groupDungeon", facts: { dungeon: group.dungeon, names: group.names.slice(0, 3).join(", ") } });
  }
  const crafting = ["Alchemy", "Blacksmithing", "Enchanting", "Engineering", "Leatherworking", "Tailoring"];
  for (const prof of crafting) {
    const top = Math.max(0, ...chars.flatMap((c) => c.professions.filter((p) => p.name === prof).map((p) => p.rank)));
    if (top > 0 && top < 150) {
      out.push({ id: "closeGap", facts: { profession: prof } });
      break;
    }
  }
  const p = prediction(week);
  if (p !== undefined)
    out.push({ id: "nextTen", facts: { character: p.name, target: Math.min(60, Math.floor(p.level / 10) * 10 + 10) } });
  if (chars.filter((c) => levelOf(c) >= 26 && levelOf(c) <= 45).length >= 3) out.push({ id: "scarlet", facts: {} });
  const at60 = new Set(chars.filter((c) => levelOf(c) >= MAX_LEVEL).map((c) => c.owner));
  if (at60.size >= 3) out.push({ id: "sixtyDungeon", facts: {} });
  if (chars.some((c) => levelOf(c) >= 10 && c.professions.length < 2)) out.push({ id: "professionPair", facts: {} });
  const questZone = best(
    new Map([
      ...week.days.reduce((m, d) => {
        for (const [z, n] of Object.entries(d.entry.quests)) m.set(z, (m.get(z) ?? 0) + n);
        return m;
      }, new Map<string, number>()),
    ]),
  );
  if (questZone !== undefined) out.push({ id: "questZone", facts: { zone: questZone[0] } });
  if (week.totalZones > new Set([...week.zonesBefore, ...week.sightings.map((s) => s.zone)]).size) {
    out.push({ id: "newZone", facts: {} });
  }
  out.push({ id: "craftForFriend", facts: {} }, { id: "threeEvenings", facts: {} });
  return out;
}

function phrase(cycles: Cycles, key: string, options: readonly string[], week: number) {
  const next = nextPhrasing(cycles, key, options.length, week);
  return { text: options[next.index]!, cycles: next.cycles };
}

function cardText(found: Found, cycles: Cycles, week: Week): { card: RecapCard; cycles: Cycles } {
  const phrasings = CARD_TEXTS[found.def.id]!;
  const next = nextPhrasing(cycles, found.def.id, phrasings.length, week.number);
  const { title, text } = phrasings[next.index]!;
  const facts: Record<string, string | number> = { ...found.candidate.facts, site: week.siteName };
  let body = fill(text, facts);
  if (found.def.slot === "award" && facts.runnerUp !== undefined) {
    body += ` Runner-up: ${facts.runnerUp} with ${facts.runnerUpAmount}.`;
  }
  const name = found.def.slot === "award" ? `${week.siteName} of the week · ${found.def.name}` : found.def.name;
  return {
    card: {
      id: found.def.id,
      slot: found.def.slot,
      name,
      title: fill(title, facts),
      text: body,
      facts: found.candidate.facts,
      friends: found.candidate.friends,
    },
    cycles: next.cycles,
  };
}

/** The recap of a week: computed once and stored (WEB-41c), so a re-run never changes what was posted. */
export function buildRecap(week: Week, history: History): Recap {
  const gains = levelGains(week);
  const levels = [...gains.values()].reduce((a, b) => a + b, 0);
  const quiet = levels < QUIET_LEVELS;
  const found = findAll(week, history);
  const { award, cards } = rotate(week, history, found, quiet);
  let cycles = history.cycles;

  let awardCard: RecapCard | undefined;
  if (award !== undefined) {
    const r = cardText(award, cycles, week);
    awardCard = r.card;
    cycles = r.cycles;
  }
  const recapCards: RecapCard[] = [];
  for (const f of cards) {
    const r = cardText(f, cycles, week);
    recapCards.push(r.card);
    cycles = r.cycles;
  }

  const headline = headlineFor(week, quiet, history);
  const h = phrase(cycles, `headline:${headline.id}`, HEADLINE_TEXTS[headline.id]!, week.number);
  cycles = h.cycles;

  const lastChallenges = new Set(
    history.weeks
      .filter((w) => w.number >= week.number - COOLDOWN_WEEKS && w.number < week.number)
      .map((w) => w.challenge),
  );
  const options = challengesFor(week, { headline: headline.id, cards: cards.map((f) => f.def.id) });
  const challenge = options.find((c) => !lastChallenges.has(c.id)) ?? options[options.length - 1]!;
  const c = phrase(cycles, `challenge:${challenge.id}`, CHALLENGE_TEXTS[challenge.id]!, week.number);
  cycles = c.cycles;

  const closing = phrase(cycles, "closing", CLOSING_TEXTS, week.number);
  cycles = closing.cycles;

  const values: Record<string, number> = {};
  for (const f of found) values[f.def.id] = f.candidate.value;
  // WEB-57: the week's deaths, for the danger headline's 4-week average.
  values.deaths = v2Totals(week).deaths;
  const past: PastWeek = {
    number: week.number,
    cards: cards.map((f) => f.def.id),
    headline: headline.id,
    challenge: challenge.id,
    values,
    levelsByFriend: Object.fromEntries(byFriend(week, gains)),
  };
  if (award !== undefined) past.award = { card: award.def.id, friend: award.candidate.friends[0]! };
  const p = prediction(week);
  if (p !== undefined) past.prediction = { guid: p.guid, name: p.name, level: p.level, weeks: p.weeks };
  if (week.number === 1) {
    const all = Object.values(week.after);
    past.totals = {
      characters: all.length,
      levelSum: all.reduce((a, ch) => a + levelOf(ch), 0),
      at60: all.filter((ch) => levelOf(ch) >= MAX_LEVEL).length,
    };
  }

  const recap: Recap = {
    week: week.number,
    start: week.start,
    end: week.end,
    quiet,
    headline: { id: headline.id, text: fill(h.text, { ...headline.facts, site: week.siteName }) },
    numbers: {
      levels,
      friendsPlayed: friendsPlayed(week).size,
      runs: runs(week).filter((r) => r.kind === "party" || r.kind === "raid").length,
      newCharacters: newCharacters(week).length,
    },
    cards: recapCards,
    challenge: { id: challenge.id, text: fill(c.text, { ...challenge.facts, site: week.siteName }) },
    closing: closing.text,
    past,
    cycles,
  };
  if (awardCard !== undefined) recap.award = awardCard;
  return recap;
}
