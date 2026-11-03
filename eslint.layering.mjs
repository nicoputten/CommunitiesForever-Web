// CLAUDE.md rule 1: src/core is pure TypeScript. Keep in sync with docs/ARCHITECTURE.md "Layering".
// Its own module without plugins, so tests/unit/layering.test.ts checks it without loading eslint-config-next.
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

export const coreLayering = {
  files: ["src/core/**/*.ts"],
  rules: {
    "no-restricted-imports": ["error", { ...coreRestrictions, paths: nodeBuiltins }],
  },
};
