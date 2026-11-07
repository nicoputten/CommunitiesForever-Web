// The addon's loot file from the item database (WEB-96; src/core/recipes/addonLoot.ts):
//
//   npm run export:addon-loot -- <out> [--db <file>]
//
// <out> is the addon's `Data\Loot.lua`. Run the item import first (`npm run import:items`, or "Import item data" on
// the admin page and copy the database). The same database gives the same bytes.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { DB_FILE, dataDir, openDatabase } from "@/server/db";
import { addonLootFile } from "@/server/bossViews";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const args = process.argv.slice(2);
const out = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--db"));
if (out === undefined) {
  console.error("Usage: npm run export:addon-loot -- <out/Data/Loot.lua> [--db <file>]");
  process.exit(1);
}
const db = openDatabase(path.resolve(arg("db") ?? path.join(dataDir(), DB_FILE)));
const lua = addonLootFile(db);
db.$client.close();
if (lua === undefined) {
  console.error("The database has no item import yet: run npm run import:items first.");
  process.exit(1);
}
writeFileSync(path.resolve(out), lua);
console.log(`Wrote ${path.resolve(out)} (${lua.length} characters).`);
