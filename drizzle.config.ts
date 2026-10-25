import { defineConfig } from "drizzle-kit";

// `npm run db:generate -- --name <what>` writes a new migration to drizzle/ (CLAUDE.md rule 5).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
});
