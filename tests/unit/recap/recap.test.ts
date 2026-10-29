import { describe, expect, it } from "vitest";
import { CARDS, LATER } from "@/core/recap/cards";
import { fill, nextPhrasing } from "@/core/recap/phrasing";
import { buildRecap, challengesFor, COOLDOWN_WEEKS } from "@/core/recap/recap";
import { CARD_TEXTS, CHALLENGE_TEXTS, CLOSING_TEXTS, HEADLINE_TEXTS } from "@/core/recap/texts";
import type { Cycles, History } from "@/core/recap/types";
import { EMPTY, HISTORY, NO_HISTORY, RICH, RICH_V2 } from "./sample";

// WEB-41: the cards, the rotation, the phrasing cycle and the texts (the `bot-recap` board, Nico 2026-10-27).

describe("the catalogue", () => {
  it("has the 64 cards of the boards (43 of WEB-41, 21 of recap v2), without the one that waits for the addon", () => {
    const ids = CARDS.map((c) => c.id);
    expect(ids).toHaveLength(64);
    expect(new Set(ids).size).toBe(64);
    for (const later of LATER) expect(ids).not.toContain(later);
  });

  it("every card has 3 to 5 phrasings", () => {
    for (const card of CARDS) {
      const n = CARD_TEXTS[card.id]?.length ?? 0;
      expect(n, card.id).toBeGreaterThanOrEqual(3);
      expect(n, card.id).toBeLessThanOrEqual(5);
    }
    expect(Object.keys(HEADLINE_TEXTS)).toHaveLength(12);
    expect(Object.keys(CHALLENGE_TEXTS)).toHaveLength(17);
  });

  it("uses no pronouns in any text", () => {
    const all = [
      ...Object.values(CARD_TEXTS).flatMap((ps) => ps.flatMap((p) => [p.title, p.text])),
      ...Object.values(HEADLINE_TEXTS).flat(),
      ...Object.values(CHALLENGE_TEXTS).flat(),
      ...CLOSING_TEXTS,
    ];
    for (const text of all) expect(text).not.toMatch(/\b(he|she|him|her|his|hers|they|them|their|theirs)\b/i);
  });
});

describe("every card", () => {
  it.each(CARDS.map((c) => [c.id, c] as const))("%s finds its example in a busy week, with a score", (_id, card) => {
    const found = card.find(RICH_V2, HISTORY);
    expect(found).toBeDefined();
    expect(found!.score).toBeGreaterThan(0);
  });

  it.each(CARDS.map((c) => [c.id, c] as const))("%s finds nothing in an empty week", (_id, card) => {
    expect(card.find(EMPTY, NO_HISTORY)).toBeUndefined();
  });

  it.each(CARDS.map((c) => [c.id, c] as const))("%s fills every phrasing from its facts", (id, card) => {
    const facts = { ...card.find(RICH_V2, HISTORY)!.facts, site: RICH.siteName };
    for (const p of CARD_TEXTS[id]!) {
      expect(fill(p.title, facts), `${id}: ${p.title}`).not.toMatch(/\{\w+\}/);
      expect(fill(p.text, facts), `${id}: ${p.text}`).not.toMatch(/\{\w+\}/);
    }
  });

  it("scores against earlier weeks: a usual value scores lower than a rare one", () => {
    const grinder = CARDS.find((c) => c.id === "A1")!;
    const rare = grinder.find(RICH, NO_HISTORY)!.score;
    const usual: History = { ...NO_HISTORY, weeks: [{ number: 1, cards: [], values: { A1: 20 }, levelsByFriend: {} }] };
    expect(grinder.find(RICH, usual)!.score).toBeLessThan(rare);
  });

  it("names the facts: the Grinder, the first footsteps, the ghost town", () => {
    const byId = (id: string) => CARDS.find((c) => c.id === id)!.find(RICH, HISTORY)!.facts;
    expect(byId("A1")).toMatchObject({ friend: "Ada", amount: "10 levels", runnerUp: "Bob" });
    expect(byId("F4")).toMatchObject({ zone: "Un'Goro Crater", character: "Ada Example", seen: 6, total: 39 });
    expect(byId("F3")).toMatchObject({ character: "Cid Second", zone: "Durotar", days: 20 });
    const riddle = CARDS.find((c) => c.id === "F12")!.find(RICH, HISTORY)!.facts;
    expect(String(riddle.riddle)).toMatch(/^A \w+ \w+\. Somewhere in the \d+s\./);
    expect(String(riddle.riddle)).not.toContain(String(riddle.character));
  });
});

describe("the recap", () => {
  it("has the award, one card per slot about different friends, a headline and a challenge", () => {
    const r = buildRecap(RICH, HISTORY);
    expect(r.quiet).toBe(false);
    expect(r.award?.slot).toBe("award");
    expect(r.award?.name).toMatch(/^Doombringers of the week · /);
    expect(r.cards.map((c) => c.slot)).toEqual(["stat", "progress", "social", "fun"]);
    const friends = [...(r.award?.friends ?? []), ...r.cards.flatMap((c) => c.friends)];
    expect(new Set(friends).size).toBe(friends.length);
    expect(r.headline.id).toBe("season");
    expect(r.headline.text).not.toMatch(/\{/);
    expect(r.challenge.text).not.toMatch(/\{/);
    expect(r.numbers).toEqual({ levels: 21, friendsPlayed: 4, runs: 2, newCharacters: 1 });
  });

  it("is the same on a re-run", () => {
    expect(buildRecap(RICH, HISTORY)).toEqual(buildRecap(RICH, HISTORY));
  });

  it("skips cards shown in the last 4 weeks", () => {
    const first = buildRecap(RICH, HISTORY);
    const shown = first.cards.map((c) => c.id);
    const history: History = {
      ...HISTORY,
      weeks: HISTORY.weeks.map((w) => (w.number === RICH.number - COOLDOWN_WEEKS ? { ...w, cards: shown } : w)),
    };
    const again = buildRecap(RICH, history);
    for (const id of shown) expect(again.cards.map((c) => c.id)).not.toContain(id);
    // Five weeks ago is long enough.
    const older: History = {
      ...HISTORY,
      weeks: HISTORY.weeks.map((w) => (w.number === RICH.number - COOLDOWN_WEEKS - 1 ? { ...w, cards: shown } : w)),
    };
    expect(buildRecap(RICH, older).cards.map((c) => c.id)).toEqual(shown);
  });

  it("gives a quiet week (under 3 levels) the short recap: no award, one fun card", () => {
    const quiet = { ...RICH, number: 4, after: { ...RICH.before } };
    const r = buildRecap(quiet, HISTORY);
    expect(r.quiet).toBe(true);
    expect(r.award).toBeUndefined();
    expect(r.cards.map((c) => c.slot)).toEqual(["fun"]);
    expect(r.headline.id).toBe("quiet");
  });

  it("keeps what the next weeks need", () => {
    const r = buildRecap({ ...RICH, number: 1, before: {} }, NO_HISTORY);
    expect(r.past.totals).toEqual({ characters: 6, levelSum: 182, at60: 1 });
    expect(r.past.levelsByFriend).toEqual({});
    const busy = buildRecap(RICH, HISTORY).past;
    expect(busy.prediction).toMatchObject({ name: "Bob Example", level: 36 });
    expect(busy.levelsByFriend).toEqual({ ada: 10, bob: 6, cid: 3, dee: 2 });
  });

  it("offers challenges that fit the week", () => {
    expect(challengesFor(RICH).map((c) => c.id)).toContain("groupDungeon");
    expect(challengesFor(EMPTY).map((c) => c.id)).toEqual(["newZone", "craftForFriend", "threeEvenings"]);
  });
});

describe("the phrasing cycle", () => {
  it("uses every phrasing once before any comes back, and a new round doesn't start with the last one", () => {
    let cycles: Cycles = {};
    const used: number[] = [];
    for (let week = 1; week <= 12; week++) {
      const next = nextPhrasing(cycles, "A1", 4, week);
      used.push(next.index);
      cycles = next.cycles;
    }
    for (let round = 0; round < 3; round++) {
      expect(new Set(used.slice(round * 4, round * 4 + 4)).size).toBe(4);
    }
    expect(used[4]).not.toBe(used[3]);
    expect(used[8]).not.toBe(used[7]);
  });

  it("starts over when the number of phrasings changed", () => {
    const cycles: Cycles = { A1: { order: [0, 1, 2], next: 1 } };
    expect(nextPhrasing(cycles, "A1", 4, 5).cycles.A1!.order).toHaveLength(4);
  });

  it("goes on across recaps", () => {
    const a = buildRecap(RICH, HISTORY);
    const b = buildRecap({ ...RICH, number: 11 }, { weeks: [...HISTORY.weeks, a.past], cycles: a.cycles });
    expect(b.closing).not.toBe(a.closing);
  });
});
