// Lets Node run the repo's TypeScript scripts directly (WEB-90, `npm run import:items`): Node strips the types
// itself (Node 24); these hooks resolve what the bundler-style imports leave out: the `@/` alias (tsconfig `paths`)
// and extensionless relative imports, and JSON imports without `with { type: "json" }` (src/core/gamedata, WEB-96).
// No dependency. Use: `node --import ./scripts/ts-hooks.mjs <script.ts>`.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = specifier;
    if (specifier.startsWith("@/")) target = pathToFileURL(SRC + specifier.slice(2)).href;
    const relative = target.startsWith("./") || target.startsWith("../") || target.startsWith("file:");
    if (relative && !/\.[cm]?[jt]s$|\.json$/.test(target)) {
      const base = new URL(target, context.parentURL);
      for (const ext of [".ts", "/index.ts"]) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    if (target.endsWith(".json")) {
      const importAttributes = { ...context.importAttributes, type: "json" };
      return { ...nextResolve(target, { ...context, importAttributes }), importAttributes };
    }
    return nextResolve(target, context);
  },
});
