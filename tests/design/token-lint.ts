import ts from "typescript";

// The token lint (WEB-30, CLAUDE.md rule 11): raw colours, font sizes, font families, radii, shadows and durations
// belong in src/styles/tokens.css only. Everything else names a token with var(--…). Allowed without a token: 0,
// 100%, and CSS keywords (transparent, currentColor, inherit, none, easing keywords). Widths, spacing and sizes are
// not checked here: the boards' spacing scale is in the tokens, but a layout value (a 1px border, 200% for a
// gradient) is not a design value.

export interface Violation {
  file: string;
  line: number;
  /** The declaration as written, e.g. `color: #fff`. */
  text: string;
  why: string;
}

const RAW_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;

// CSS Color 4 named colours (https://www.w3.org/TR/css-color-4/#named-colors), without transparent and currentColor.
const NAMED_COLOURS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood " +
    "cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod " +
    "darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon " +
    "darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray " +
    "dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green " +
    "greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon " +
    "lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon " +
    "lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen " +
    "magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue " +
    "mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy " +
    "oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip " +
    "peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown " +
    "seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal " +
    "thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" "),
);

const COLOUR_PROPERTY =
  /^(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration(?:-color)?|column-rule(?:-color)?|stop-color|flood-color|lighting-color)$/;

const FONT_SIZE_KEYWORD = /\b(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)\b/;
const NUMBER = /(?<![\w-])-?(?:\d+\.?\d*|\.\d+)(?:[a-z]+|%)?/gi;
const DURATION = /(?<![\w-])(?:\d+\.?\d*|\.\d+)m?s\b/gi;

/** The value with every `var(--name)` removed (a var() with a raw fallback stays, so the fallback is checked). */
function withoutTokens(value: string): string {
  return value.replace(/var\(\s*--[\w-]+\s*\)/g, " ").replace(/!important/g, " ");
}

/** Numbers other than 0 (and 100% where allowed) left after the tokens are removed. */
function rawNumbers(value: string, allow100 = false): string[] {
  return (withoutTokens(value).match(NUMBER) ?? []).filter(
    (n) => !/^-?0*\.?0*(?:[a-z]+|%)?$/i.test(n) && !(allow100 && n === "100%"),
  );
}

/** Why a declaration breaks the token rule, or undefined when it is fine. `property` is kebab-case. */
export function checkDeclaration(property: string, value: string): string | undefined {
  const prop = property.trim().toLowerCase().replace(/^-(?:webkit|moz|ms)-/, "");
  if (prop.startsWith("--")) {
    // A custom property outside tokens.css may pass a token on, never define a raw design value.
    return RAW_COLOUR.test(value) ? "raw colour in a custom property" : undefined;
  }
  if (RAW_COLOUR.test(value)) return "raw colour";
  if (COLOUR_PROPERTY.test(prop)) {
    const words = withoutTokens(value).toLowerCase().match(/[a-z-]+/g) ?? [];
    const named = words.find((w) => NAMED_COLOURS.has(w));
    if (named !== undefined) return `named colour "${named}"`;
  }
  if (prop === "font-size") {
    if (rawNumbers(value, true).length > 0 || FONT_SIZE_KEYWORD.test(withoutTokens(value))) return "raw font size";
  }
  if (prop === "font-family" || prop === "font") {
    const rest = withoutTokens(value).trim();
    if (rest !== "" && rest !== "inherit") return "raw font family or size";
  }
  if (/^border(?:-[a-z]+)*-radius$/.test(prop) && rawNumbers(value, true).length > 0) return "raw radius";
  if ((prop === "box-shadow" || prop === "text-shadow") && rawNumbers(value).length > 0) return "raw shadow";
  if (/^(?:transition|animation)(?:-|$)/.test(prop)) {
    const raw = (withoutTokens(value).match(DURATION) ?? []).filter((d) => !/^0*\.?0*m?s$/i.test(d));
    if (raw.length > 0) return "raw duration";
  }
  if (prop === "filter" || prop === "backdrop-filter") {
    if (/blur\(\s*[\d.]/.test(value)) return "raw blur";
    if (/drop-shadow\(/.test(value) && rawNumbers(value).length > 0) return "raw shadow";
  }
  return undefined;
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/** Declarations in a CSS file (comments removed, positions kept). */
export function lintCss(file: string, source: string): Violation[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  const out: Violation[] = [];
  // A declaration ends at ; or }. Selectors (a:hover {) and media queries ((max-width: 767px) {) end at { and are
  // skipped by the lookahead.
  for (const m of text.matchAll(/([-\w]+)\s*:\s*([^;{}]+?)\s*(?=[;}])/g)) {
    const why = checkDeclaration(m[1]!, m[2]!);
    if (why !== undefined) {
      out.push({ file, line: lineAt(text, m.index), text: `${m[1]}: ${m[2]!.replace(/\s+/g, " ")}`, why });
    }
  }
  return out;
}

const kebab = (name: string) => (name.startsWith("--") ? name : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

// React adds px to a bare number for these, so 14 is 14px.
const PX_PROPERTIES = /^(?:font-size|border(?:-[a-z]+)*-radius)$/;

// SVG presentation attributes that take a colour.
const COLOUR_ATTRIBUTES = new Set(["fill", "stroke", "color", "stopColor", "floodColor", "lightingColor"]);

/** The text of a string or template literal; each `${…}` counts as a token. Undefined for anything else. */
function literalText(node: ts.Node): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((s) => `var(--x)${s.literal.text}`).join("");
  }
  return undefined;
}

const isCssProperties = (type: ts.TypeNode | undefined) =>
  type !== undefined && /\bCSSProperties\b/.test(type.getText());

/**
 * Inline styles in a .tsx file: object literals passed to `style`, or typed CSSProperties (`as`, `satisfies` or a
 * variable annotation); SVG colour attributes; and any string literal that is a raw colour.
 */
export function lintTsx(file: string, source: string): Violation[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Violation[] = [];
  const report = (node: ts.Node, text: string, why: string) =>
    out.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text, why });

  const styleObject = (obj: ts.ObjectLiteralExpression) => {
    for (const p of obj.properties) {
      if (!ts.isPropertyAssignment(p)) continue;
      const name = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : undefined;
      if (name === undefined) continue;
      const prop = kebab(name);
      let value = literalText(p.initializer);
      if (value === undefined && ts.isNumericLiteral(p.initializer)) {
        value = PX_PROPERTIES.test(prop) ? `${p.initializer.text}px` : p.initializer.text;
      }
      if (value === undefined) continue;
      const why = checkDeclaration(prop, value);
      if (why !== undefined) report(p, `${name}: ${value}`, why);
    }
  };

  const seen = new Set<ts.Node>();
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      const init = node.initializer;
      const expr = init !== undefined && ts.isJsxExpression(init) ? init.expression : init;
      if (name === "style" && expr !== undefined && ts.isObjectLiteralExpression(expr)) {
        seen.add(expr);
        styleObject(expr);
      }
      if (COLOUR_ATTRIBUTES.has(name) && expr !== undefined) {
        const value = literalText(expr);
        const why = value === undefined ? undefined : checkDeclaration(kebab(name), value);
        if (why !== undefined) report(node, `${name}="${value}"`, why);
      }
    }
    if ((ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) && isCssProperties(node.type)) {
      let inner: ts.Expression = node.expression;
      while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
      if (ts.isObjectLiteralExpression(inner) && !seen.has(inner)) {
        seen.add(inner);
        styleObject(inner);
      }
    }
    if (ts.isVariableDeclaration(node) && isCssProperties(node.type) && node.initializer !== undefined) {
      if (ts.isObjectLiteralExpression(node.initializer) && !seen.has(node.initializer)) {
        seen.add(node.initializer);
        styleObject(node.initializer);
      }
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // A whole-string hex colour ("#d4af6a") or a colour function anywhere, outside the style objects above.
      if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(node.text) || /\b(?:rgba?|hsla?|oklch)\(/i.test(node.text)) {
        if (!out.some((v) => v.line === sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1)) {
          report(node, JSON.stringify(node.text), "raw colour");
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
