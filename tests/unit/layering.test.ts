import { Linter } from "eslint";
import { describe, expect, it } from "vitest";
import { coreLayering } from "../../eslint.layering.mjs";

// CLAUDE.md rule 1: the ESLint config keeps src/core free of React, Next.js, Node and the other layers.
// The in-memory Linter with only the layering block (eslint.config.mjs spreads in the same object): loading
// eslint-config-next for this took 2 to 4 s of the first assertion in a full run, near the 5 s timeout.
const linter = new Linter();

function restrictedImports(code: string, filename: string): number {
  return linter.verify(code, [coreLayering], { filename }).filter((m) => m.ruleId === "no-restricted-imports").length;
}

describe("src/core layering", () => {
  it.each([
    'import { useState } from "react";',
    'import Link from "next/link";',
    'import { readFile } from "node:fs/promises";',
    'import { readFile } from "fs";',
    'import path from "path";',
    'import { db } from "@/server/db";',
    'import { Map } from "@/components/Map";',
    'import { db } from "../server/db";',
  ])("rejects %s", (code) => {
    expect(restrictedImports(code, "src/core/example.ts")).toBe(1);
  });

  it("allows imports within core", () => {
    expect(restrictedImports('import { parse } from "./lua";', "src/core/example.ts")).toBe(0);
  });

  it("allows the same imports outside core", () => {
    expect(restrictedImports('import { readFile } from "node:fs/promises";', "src/server/example.ts")).toBe(0);
  });
});
