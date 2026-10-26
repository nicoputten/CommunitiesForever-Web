import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkDeclaration, lintCss, lintTsx, type Violation } from "./token-lint";

// WEB-30 token lint: no raw design values outside src/styles/tokens.css (CLAUDE.md rule 11). A value that is really
// needed goes into tokens.css part 2 with the board it comes from (docs/DESIGN.md §3 "Derived from the boards").

const SRC = path.resolve(__dirname, "../../src");

/** The one file allowed to hold raw values. */
const TOKENS = path.join("styles", "tokens.css");

/**
 * Exceptions, each with its reason: `file` relative to src/ with forward slashes, `text` as the violation reports it.
 * Keep this short; a new entry needs Nico's OK like any deviation (CLAUDE.md rule 12).
 */
const ALLOWED: { file: string; text: string; why: string }[] = [];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

function lintSrc(): Violation[] {
  return files(SRC).flatMap((abs) => {
    const file = path.relative(SRC, abs).split(path.sep).join("/");
    if (file === TOKENS.split(path.sep).join("/")) return [];
    if (abs.endsWith(".css")) return lintCss(file, readFileSync(abs, "utf8"));
    if (abs.endsWith(".tsx")) return lintTsx(file, readFileSync(abs, "utf8"));
    return [];
  });
}

describe("token lint", () => {
  it("finds no raw design values in src/ outside tokens.css", () => {
    const found = lintSrc()
      .filter((v) => !ALLOWED.some((a) => a.file === v.file && a.text === v.text))
      .map((v) => `src/${v.file}:${v.line}  ${v.text}  (${v.why})`);
    expect(found, "Use a token from src/styles/tokens.css, or add one there with its source").toEqual([]);
  });

  it("allow-list entries still match something", () => {
    const all = lintSrc();
    const stale = ALLOWED.filter((a) => !all.some((v) => v.file === a.file && v.text === a.text));
    expect(stale).toEqual([]);
  });
});

describe("checkDeclaration", () => {
  it.each([
    ["color", "#fff"],
    ["color", "#D4AF6A"],
    ["background", "rgba(12, 18, 30, 0.78)"],
    ["border", "1px solid hsl(0 0% 50%)"],
    ["color", "white"],
    ["background", "linear-gradient(90deg, black, var(--sea))"],
    ["color", "var(--gold, #d4af6a)"],
    ["--accent", "#fff"],
    ["font-size", "14px"],
    ["font-size", "1.2rem"],
    ["font-size", "small"],
    ["font-size", "calc(var(--fs-body) * 1.5)"],
    ["font-family", "Inter, sans-serif"],
    ["font", "14px var(--font-ui)"],
    ["border-radius", "6px"],
    ["border-top-left-radius", "50%"],
    ["box-shadow", "0 2px 4px var(--line)"],
    ["box-shadow", "var(--glow-disc) color-mix(in srgb, var(--disc) 45%, transparent)"],
    ["text-shadow", "0 0 3px var(--bg-abyss)"],
    ["transition", "color 120ms var(--ease-out)"],
    ["animation", "fog 40s linear infinite"],
    ["animation-duration", ".3s"],
    ["-webkit-backdrop-filter", "blur(14px)"],
    ["filter", "drop-shadow(0 0 3px var(--bg-abyss))"],
  ])("flags %s: %s", (prop, value) => {
    expect(checkDeclaration(prop, value)).toBeDefined();
  });

  it.each([
    ["color", "var(--gold)"],
    ["background", "transparent"],
    ["border", "var(--border) solid var(--line)"],
    ["border-color", "currentColor"],
    ["background", "linear-gradient(180deg, var(--bar-fade-top), var(--bar-fade-end))"],
    ["--disc", "var(--warlock)"],
    ["font-size", "var(--fs-body)"],
    ["font-size", "100%"],
    ["font-size", "inherit"],
    ["font-family", "var(--font-display)"],
    ["font", "inherit"],
    ["border-radius", "var(--r-pill)"],
    ["border-radius", "0"],
    ["border-radius", "100%"],
    ["box-shadow", "none"],
    ["box-shadow", "var(--shadow-card)"],
    ["box-shadow", "var(--glow-disc) color-mix(in srgb, var(--disc) var(--glow-disc-mix), transparent)"],
    ["transition", "color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out)"],
    ["animation", "shimmer var(--dur-shimmer) ease-in-out infinite"],
    ["animation-duration", "0s !important"],
    ["backdrop-filter", "blur(var(--blur-surface))"],
    ["margin", "calc(-1 * var(--s-2))"],
    ["width", "1px"],
    ["background-position", "-200% 0"],
  ])("allows %s: %s", (prop, value) => {
    expect(checkDeclaration(prop, value)).toBeUndefined();
  });
});

describe("lintCss and lintTsx", () => {
  it("reads declarations, not selectors or media queries", () => {
    const css = `/* #fff in a comment */\n@media (max-width: 767px) {\n  a:hover { color: #fff; }\n  .x { font-size: var(--fs-body) }\n}\n`;
    expect(lintCss("x.module.css", css)).toEqual([
      { file: "x.module.css", line: 3, text: "color: #fff", why: "raw colour" },
    ]);
  });

  it("checks style objects, CSSProperties, SVG colour attributes and colour strings", () => {
    const tsx = [
      `import type { CSSProperties } from "react";`,
      `const a = <div style={{ fontSize: 14, color: "var(--gold)" }} />;`,
      `const b = { borderRadius: "6px" } as CSSProperties;`,
      `const c: CSSProperties = { transition: "opacity 200ms" };`,
      `const d = <path fill="#d4af6a" stroke="currentColor" />;`,
      `const GOLD = "rgb(212, 175, 106)";`,
      `const e = { "--disc": \`var(\${token})\` } as CSSProperties;`,
      `const f = <a href="#content">skip</a>;`,
    ].join("\n");
    expect(lintTsx("x.tsx", tsx).map((v) => [v.line, v.why])).toEqual([
      [2, "raw font size"],
      [3, "raw radius"],
      [4, "raw duration"],
      [5, "raw colour"],
      [6, "raw colour"],
    ]);
  });
});
