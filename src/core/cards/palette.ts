// The design values of the card images (WEB-41d). Images can't read CSS variables, so the tokens they use are here
// as values; tests/unit/cards.test.ts checks each against src/styles/tokens.css, so tokens.css stays the one source.

/** Token name → value, as in tokens.css (colours lower case, sizes in px). */
export const CARD_TOKENS = {
  "--bg-night": "#070c15",
  "--page-glow": "#12233a",
  "--gold": "#d4af6a",
  "--gold-bright": "#f0d08e",
  "--gold-pale": "#f3dfae",
  "--text-strong": "#f3ebda",
  "--text": "#e6e1d6",
  "--text-muted": "#aeb6c3",
  "--text-dim": "#8e98a8",
  "--on-gold": "#0b0f14",
  "--on-shaman": "#ffffff",
  "--stale": "#e08a4a",
  "--stale-text": "#f0a774",
  "--line-box": "rgba(212, 175, 106, 0.22)",
  "--warrior": "#c69b6d",
  "--paladin": "#f48cba",
  "--hunter": "#aad372",
  "--rogue": "#fff468",
  "--priest": "#ffffff",
  "--shaman": "#0070dd",
  "--shaman-text": "#4da3ff",
  "--mage": "#3fc7eb",
  "--warlock": "#8788ee",
  "--warlock-text": "#a9aaf5",
  "--druid": "#ff7c0a",
  "--druid-text": "#ff9a45",
  "--card-w": "800px",
  "--card-wide": "1200px",
  "--card-h": "400px",
  "--card-pad": "40px",
  "--fs-card-overline": "20px",
  "--fs-card-title": "64px",
  "--fs-card-award": "46px",
  "--fs-card-name": "40px",
  "--fs-card-line": "26px",
  "--fs-card-stat": "36px",
  "--fs-card-meta": "20px",
  "--fs-card-initials": "64px",
  "--size-card-disc": "230px",
  "--size-card-disc-small": "60px",
  "--size-card-ring": "6px",
  "--size-card-marker": "28px",
  "--card-glow": "rgba(240, 208, 142, 0.3)",
  "--card-land": "#18233a",
  "--card-land-line": "rgba(126, 136, 152, 0.45)",
  "--card-zone": "#6b634f",
  "--card-label-bg": "rgba(7, 12, 21, 0.75)",
} as const;

export type CardToken = keyof typeof CARD_TOKENS;

/** A token's value. */
export function tok(name: CardToken): string {
  return CARD_TOKENS[name];
}

/** A px token as a number. */
export function px(name: CardToken): number {
  return Number.parseFloat(CARD_TOKENS[name]);
}

/** The class colour token of a classFile, and the token for text on it; gold for an unknown class. */
export function classColours(classFile: string | undefined): { fill: CardToken; text: CardToken; on: CardToken } {
  const c = (classFile ?? "").toLowerCase();
  const fill = (`--${c}` in CARD_TOKENS ? `--${c}` : "--gold") as CardToken;
  const text = (`--${c}-text` in CARD_TOKENS ? `--${c}-text` : fill) as CardToken;
  return { fill, text, on: c === "shaman" ? "--on-shaman" : "--on-gold" };
}
