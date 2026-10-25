// Text from the uploaded file is untrusted (CLAUDE.md rule 2): WoW escape sequences are removed from every string.
// A whole sequence goes, not just its '|' (deleting only '|' would turn "|cffff0000Red|r" into "cffff0000Redr"):
// ||  a literal pipe, kept as "|"
// |cAARRGGBB, |cn<COLOR_NAME>:, |r  colors
// |T...|t, |A...|a  textures and atlases
// |H<payload>|h<text>|h  hyperlinks, the link text stays
// |K...|k  protected Battle.net names
// Any other '|' is removed.
const ESCAPES = /\|\||\|c[0-9a-fA-F]{8}|\|cn[^:|]*:|\|r|\|T[^|]*\|t|\|A[^|]*\|a|\|H[^|]*\|h|\|h|\|K[^|]*\|k|\|/g;

export function stripEscapes(text: string): string {
  return text.replace(ESCAPES, (match) => (match === "||" ? "|" : ""));
}

/** Same cap as the addon (Merge.MAX_DISPLAY_NAME). */
export const MAX_DISPLAY_NAME = 24;

/** Addon rule (Merge.cleanName): plain text, whitespace collapsed and trimmed, at most 24 characters; empty: undefined. */
export function cleanName(text: unknown): string | undefined {
  if (typeof text !== "string") return undefined;
  const plain = stripEscapes(text).replace(/\s+/g, " ").trim();
  const capped = Array.from(plain).slice(0, MAX_DISPLAY_NAME).join("").trimEnd();
  return capped === "" ? undefined : capped;
}
