import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// WEB-48 and WEB-49: the site has its own dropdown, date and time controls. This fails when a native <select>, date
// or time input comes back in a page or component (they bring the browser's own look and OS icons).

const SRC = path.join(__dirname, "..", "..", "src");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

describe("no native form controls", () => {
  it("has no <select>, date, time or datetime-local input in src", () => {
    const found = files(SRC).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => !line.trim().startsWith("//") && /<select\b|type=["'](date|time|datetime-local)["']/.test(line))
        .map(({ i }) => `${path.relative(SRC, file)}:${i + 1}`),
    );
    expect(found).toEqual([]);
  });
});
