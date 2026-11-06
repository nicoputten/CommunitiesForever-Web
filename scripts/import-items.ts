// The item and recipe database import (WEB-90, docs/SOURCE-DATA.md "Item database"). Run by hand once per game patch:
//
//   npm run import:items -- [--build 1.60.1.70790] [--era 1.15.9.70576] [--cache <dir>] [--db <file>] [--offline]
//     [--download-only] [--dump <file.json>]
//
// Downloads the client's DB2 tables of the Forever build from wago.tools (CSV) and cmangos classic-db's full dump
// (GPL-3.0, where recipes are learned) into the cache folder (outside the repo, never committed), builds the database
// with src/core/recipes/build.ts and writes it in one transaction (src/server/itemDb.ts). Idempotent: running it
// again with the same inputs changes nothing. Never scrapes Wowhead.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { parseCsv, int } from "@/core/recipes/csv";
import { buildItemDatabase, CMANGOS_TABLES, DB2_TABLES, type ImportInput } from "@/core/recipes/build";
import { readColumns, readRows } from "@/core/recipes/sqlDump";
import { DB_FILE, dataDir, openDatabase } from "@/server/db";
import { writeItemDatabase } from "@/server/itemDb";

/** The Forever client build on wago.tools (product `wowf`; WOW_PROJECT_ID 18, Interface 16001). */
const FOREVER_BUILD = "1.60.1.70790";
/** The newest Classic Era build: recipes Forever has that Era lacks are Forever's own (kept without a source). */
const ERA_BUILD = "1.15.9.70576";
/** cmangos classic-db's full dump, pinned to a commit (GPL-3.0, https://github.com/cmangos/classic-db). */
const CMANGOS_COMMIT = "28ef6259c782928b08a8dc9cacf6bc02e64f2b29";
const CMANGOS_FILE = "Full_DB/ClassicDB_1_12_1_z2815.sql.gz";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const build = arg("build") ?? FOREVER_BUILD;
const eraBuild = arg("era") ?? ERA_BUILD;
const cache = path.resolve(arg("cache") ?? path.join(dataDir(), "import-cache"));
const dbFile = path.resolve(arg("db") ?? path.join(dataDir(), DB_FILE));
const offline = process.argv.includes("--offline");

/** Extra filters per table, to download less (wago's `filter[col]` matches what contains it; `exact:` exactly). */
const FILTERS: Partial<Record<string, string>> = { ManifestInterfaceData: "filter%5BFilePath%5D=ICONS" };

/**
 * One DB2 table as CSV. wago.tools cuts long exports off after a few seconds, so the download continues from the
 * last whole row with `filter[ID]=>last` (asked for in ID order, and checked) until a request ends cleanly.
 */
async function db2(
  table: string,
  version: string,
  filter = FILTERS[table],
  name = table,
): Promise<Record<string, string>[]> {
  const file = path.join(cache, version, `${name}.csv`);
  if (!existsSync(file)) {
    if (offline) throw new Error(`Missing ${file} (--offline).`);
    mkdirSync(path.dirname(file), { recursive: true });
    let header = "";
    const parts: string[] = [];
    let last: number | undefined;
    for (let attempt = 0; attempt < 200; attempt++) {
      const filters = ["sort%5BID%5D=asc", filter, last !== undefined ? `filter%5BID%5D=%3E${last}` : undefined]
        .filter((f) => f !== undefined)
        .join("&");
      const url = `https://wago.tools/db2/${table}/csv?build=${version}${filters !== "" ? `&${filters}` : ""}`;
      const { text, complete } = await download(url);
      const csv = parseCsv(text, complete);
      if (csv.header.length === 0) throw new Error(`${table}: no header from ${url}`);
      const firstLine = text.slice(0, text.search(/\r?\n/));
      header ||= firstLine;
      let previous = last ?? -Infinity;
      for (const row of csv.rows) {
        const id = int(row, "ID");
        if (id === undefined || id <= previous) throw new Error(`${table}: rows are not in ID order at ${row.ID}`);
        previous = id;
      }
      parts.push(text.slice(firstLine.length + 1, csv.consumed).replace(/^\n/, ""));
      if (complete) break;
      if (csv.rows.length === 0) throw new Error(`${table}: no whole row in a cut-off download`);
      last = previous;
      process.stdout.write(`  ${table}: continuing after ID ${last}\n`);
    }
    writeFileSync(file, [header, ...parts.map((p) => p.replace(/\r?\n$/, ""))].filter((p) => p !== "").join("\n"));
  }
  return parseCsv(readFileSync(file, "utf8")).rows;
}

async function download(url: string, tries = 3): Promise<{ text: string; complete: boolean }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "user-agent": "CommunitiesForever-Web item import" } });
  } catch (e) {
    if (tries <= 1) throw e;
    await new Promise((r) => setTimeout(r, 2000));
    return download(url, tries - 1);
  }
  if (!res.ok || res.body === null) throw new Error(`${res.status} from ${url}`);
  const decoder = new TextDecoder();
  let text = "";
  try {
    for await (const chunk of res.body) text += decoder.decode(chunk, { stream: true });
    text += decoder.decode();
    return { text, complete: true };
  } catch {
    return { text, complete: false };
  }
}

async function cmangos(): Promise<string> {
  const file = path.join(cache, "cmangos", `${CMANGOS_COMMIT}.sql`);
  if (!existsSync(file)) {
    if (offline) throw new Error(`Missing ${file} (--offline).`);
    mkdirSync(path.dirname(file), { recursive: true });
    const url = `https://raw.githubusercontent.com/cmangos/classic-db/${CMANGOS_COMMIT}/${CMANGOS_FILE}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} from ${url}`);
    writeFileSync(file, gunzipSync(Buffer.from(await res.arrayBuffer())));
  }
  return readFileSync(file, "utf8");
}

async function main(): Promise<void> {
  console.log(`Item import: Forever build ${build}, Era ${eraBuild}, cmangos ${CMANGOS_COMMIT.slice(0, 7)}`);
  console.log(`Cache ${cache}`);
  const db2Tables: Record<string, Record<string, string>[]> = {};
  for (const table of DB2_TABLES) {
    db2Tables[table] = await db2(table, build);
    console.log(`  ${table}: ${db2Tables[table]!.length} rows`);
  }
  const era = {
    abilities: await db2("SkillLineAbility", eraBuild),
    // Era's learn-spell effects only (Effect 36): what cmangos' trainer and recipe-item spells teach.
    learn: await db2("SpellEffect", eraBuild, "filter%5BEffect%5D=exact:36", "SpellEffect-learn"),
  };
  if (process.argv.includes("--download-only")) return;
  const sql = await cmangos();
  const columns = readColumns(sql, CMANGOS_TABLES);
  const sqlTables: ImportInput["cmangos"] = {};
  for (const table of CMANGOS_TABLES) {
    const cols = columns[table];
    if (cols === undefined) throw new Error(`cmangos dump has no table ${table}`);
    sqlTables[table] = readRows(sql, table, cols);
    console.log(`  cmangos ${table}: ${sqlTables[table]!.length} rows`);
  }
  const data = buildItemDatabase({ db2: db2Tables, era, cmangos: sqlTables });
  const dump = arg("dump");
  if (dump !== undefined) writeFileSync(dump, JSON.stringify(data, null, 1));
  const db = openDatabase(dbFile);
  const result = writeItemDatabase(
    db,
    data,
    { build, era: eraBuild, cmangos: CMANGOS_COMMIT },
    Math.floor(Date.now() / 1000),
  );
  db.$client.close();
  console.log(
    `Done: ${data.items.length} items, ${data.recipes.length} recipes ` +
      `(${data.recipes.filter((r) => r.foreverOnly).length} Forever's own, ` +
      `${data.recipes.filter((r) => !r.obtainable).length} unobtainable), ${data.sources.length} sources. ` +
      `Changed: ${result.changed ? "yes" : "no"}.`,
  );
}

await main();
