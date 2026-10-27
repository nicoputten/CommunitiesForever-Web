import type { Cycles } from "./types";

// The phrasing cycle (WEB-41, Nico 2026-10-27): every card, headline and challenge has several phrasings; one is not
// used again until all of them were used. Each key keeps a shuffled order (seeded by the week number) and where it
// is; when the order is used up a new one starts, never with the phrasing that was used last.

/** A small seeded generator (mulberry32): the same seed gives the same numbers, so a re-run is identical. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number from a text, to mix into a seed. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffled(count: number, seed: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  const random = seeded(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/**
 * The phrasing to use for `key` this week, and the cycles after using it. `count` is how many phrasings the key has;
 * a stored cycle for another count (texts were added) starts over.
 */
export function nextPhrasing(
  cycles: Cycles,
  key: string,
  count: number,
  week: number,
): { index: number; cycles: Cycles } {
  let cycle = cycles[key];
  if (cycle === undefined || cycle.order.length !== count || cycle.next >= count) {
    const last = cycle !== undefined && cycle.next > 0 ? cycle.order[cycle.next - 1] : undefined;
    const order = shuffled(count, hash(key) ^ (week * 2654435761));
    // A new round never starts with the phrasing that ended the last one.
    if (count > 1 && order[0] === last) [order[0], order[1]] = [order[1]!, order[0]!];
    cycle = { order, next: 0 };
  }
  const index = cycle.order[cycle.next]!;
  return { index, cycles: { ...cycles, [key]: { order: cycle.order, next: cycle.next + 1 } } };
}

/** Fills `{name}` placeholders; one without a fact stays visible, so a test catches it. */
export function fill(template: string, facts: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in facts ? String(facts[key]) : whole));
}
