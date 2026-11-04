import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";
import { coreLayering } from "./eslint.layering.mjs";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  coreLayering,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
    "design/**",
    ".claude/**",
    ".venv-map/**",
  ]),
]);
