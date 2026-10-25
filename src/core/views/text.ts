// Small display helpers the shared components use.

/**
 * Initials for a class disc or marker ("Ves Doombringer" → "VD"): the first letter of the first and the last word,
 * one letter for a one-word name, "?" without a name (a stub). Display only, never a key: the exception to "never
 * split names" (CLAUDE.md rule 3) that Nico approved for WEB-15.
 */
export function initials(name: string | undefined): string {
  const words = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter((w) => w !== "");
  const first = words[0];
  if (first === undefined) return "?";
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return (letter(first) + (last === undefined ? "" : letter(last))).toUpperCase();
}

/** The first character, a whole code point (so an accented or astral letter is not cut in half). */
function letter(word: string): string {
  return Array.from(word)[0] ?? "";
}

/** "yesterday" → "Yesterday", for a time that starts a line. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
