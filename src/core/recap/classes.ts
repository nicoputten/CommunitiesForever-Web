import type { RecapCard, RecapChar, RecapFriend } from "./types";

// The class per name in a recap card (WEB-72), so the bot can put its class icon before each name in the card's
// texts. A character named in the title or text has its own class; a friend of the card (or named in it) has the
// class of their highest-level character, as the award's colour (WEB-66). Names are matched whole, never split.

/** Whether `name` appears in `text` as a whole name, not as part of a longer word ("Mira" in "Miranda"). */
function names(text: string, name: string): boolean {
  if (name === "") return false;
  let from = 0;
  for (;;) {
    const at = text.indexOf(name, from);
    if (at < 0) return false;
    const before = text[at - 1];
    const after = text[at + name.length];
    if (
      (before === undefined || !/[\p{L}\p{N}]/u.test(before)) &&
      (after === undefined || !/[\p{L}\p{N}]/u.test(after))
    )
      return true;
    from = at + 1;
  }
}

/** A friend's class: that of their highest-level character at the end of the week. */
function friendClass(key: string, chars: readonly RecapChar[]): string | undefined {
  return chars
    .filter((c) => c.owner === key && c.classFile !== undefined)
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0]?.classFile;
}

/**
 * Name → classFile for every character and friend the card names in its title or text, plus the card's own friends.
 * Undefined when there is none.
 */
export function cardClasses(
  card: Pick<RecapCard, "title" | "text" | "friends">,
  after: Readonly<Record<string, RecapChar>>,
  friends: readonly RecapFriend[],
): Record<string, string> | undefined {
  const text = `${card.title}\n${card.text}`;
  const chars = Object.values(after);
  const out: Record<string, string> = {};
  for (const c of chars) {
    if (c.classFile !== undefined && names(text, c.name)) out[c.name] = c.classFile;
  }
  for (const f of friends) {
    if (out[f.name] !== undefined || (!card.friends.includes(f.key) && !names(text, f.name))) continue;
    const cls = friendClass(f.key, chars);
    if (cls !== undefined) out[f.name] = cls;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
