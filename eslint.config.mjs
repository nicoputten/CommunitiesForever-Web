import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";

// CLAUDE.md rule 1: src/core is pure TypeScript. Keep in sync with docs/ARCHITECTURE.md "Layering".
const coreRestrictions = {
  patterns: [
    { group: ["react", "react/*", "react-dom", "react-dom/*"], message: "src/core is pure TypeScript: no React." },
    { group: ["next", "next/*", "next-auth", "next-auth/*"], message: "src/core is pure TypeScript: no Next.js." },
    { group: ["node:*"], message: "src/core is pure TypeScript: no Node APIs." },
    {
      group: ["**/server", "**/server/*", "**/app", "**/app/*", "**/components", "**/components/*"],
      message: "src/core imports nothing from the other layers.",
    },
  ],
};

const nodeBuiltins = [
  "assert",
  "buffer",
  "child_process",
  "crypto",
  "dns",
  "events",
  "fs",
  "fs/promises",
  "http",
  "https",
  "net",
  "os",
  "path",
  "process",
  "stream",
  "tls",
  "url",
  "util",
  "worker_threads",
  "zlib",
].map((name) => ({ name, message: "src/core is pure TypeScript: no Node APIs." }));

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { ...coreRestrictions, paths: nodeBuiltins }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
  ]),
]);
