// The item and recipe database import from the command line (WEB-90, docs/SOURCE-DATA.md "Item database"). The
// owner runs the same import from the admin page ("Import item data", WEB-91); this is for a developer's machine:
//
//   npm run import:items -- [--build 1.60.1.70790] [--era 1.15.9.70576] [--cache <dir>] [--db <file>] [--offline]
//     [--download-only] [--dump <file.json>]
//
// Without --build and --era: the newest Forever and Classic Era builds wago.tools lists. The code is
// src/server/itemImport.ts.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { DB_FILE, dataDir, openDatabase } from "@/server/db";
import { writeItemDatabase } from "@/server/itemDb";
import { buildFromSources, CMANGOS_COMMIT, defaultCache, summaryOf } from "@/server/itemImport";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const cache = path.resolve(arg("cache") ?? defaultCache());
  const dbFile = path.resolve(arg("db") ?? path.join(dataDir(), DB_FILE));
  const options = {
    cache,
    offline: process.argv.includes("--offline"),
    downloadOnly: process.argv.includes("--download-only"),
    onStep: (step: string) => console.log(`  ${step}`),
    ...(arg("build") !== undefined ? { build: arg("build") } : {}),
    ...(arg("era") !== undefined ? { era: arg("era") } : {}),
  };
  console.log(`Item import, cache ${cache}`);
  const { build, era, data } = await buildFromSources(options);
  console.log(`Forever build ${build}, Era ${era}, cmangos ${CMANGOS_COMMIT.slice(0, 7)}`);
  if (data === undefined) return;
  const dump = arg("dump");
  if (dump !== undefined) writeFileSync(dump, JSON.stringify(data, null, 1));
  const db = openDatabase(dbFile);
  const { changed } = writeItemDatabase(
    db,
    data,
    { build, era, cmangos: CMANGOS_COMMIT },
    Math.floor(Date.now() / 1000),
  );
  db.$client.close();
  const s = summaryOf(build, era, data, changed);
  console.log(
    `Done: ${s.items} items, ${s.recipes} recipes (${s.foreverOnly} Forever's own, ${s.unobtainable} unobtainable), ` +
      `${s.sources} sources. Changed: ${changed ? "yes" : "no"}.`,
  );
}

await main();
