import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// CLAUDE.md rule 1: the ESLint config keeps src/core free of React, Next.js, Node and the other layers.
const eslint = new ESLint();

async function restrictedImports(code: string, filePath: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.filter((m) => m.ruleId === "no-restricted-imports").length ?? 0;
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
  ])("rejects %s", async (code) => {
    expect(await restrictedImports(code, "src/core/example.ts")).toBe(1);
  });

  it("allows imports within core", async () => {
    expect(await restrictedImports('import { parse } from "./lua";', "src/core/example.ts")).toBe(0);
  });

  it("allows the same imports outside core", async () => {
    expect(await restrictedImports('import { readFile } from "node:fs/promises";', "src/server/example.ts")).toBe(0);
  });
});
