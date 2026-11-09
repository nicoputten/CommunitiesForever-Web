import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  buildItemDatabase,
  CMANGOS_TABLES,
  DB2_TABLES,
  type ImportInput,
  type ItemDatabase,
} from "@/core/recipes/build";
import { int, parseCsv } from "@/core/recipes/csv";
import { readColumns, readRows } from "@/core/recipes/sqlDump";
import { dataDir, type Db } from "./db";
import { itemImport } from "./db/schema";
import { writeItemDatabase } from "./itemDb";

// The item and recipe import (WEB-90; WEB-91: also run by the server for the owner's "Import item data"), shared by
// `npm run import:items` (scripts/import-items.ts) and the admin page (src/server/itemImportRun.ts). Downloads the
// client's DB2 tables from wago.tools and cmangos classic-db's dump into a cache folder (default
// `DATA_DIR/import-cache`, never committed), builds the database (src/core/recipes/build.ts) and writes it in one
// transaction (src/server/itemDb.ts). The same data again changes nothing. Never scrapes Wowhead.
// Imported by a script that Node runs with type stripping: no enums or parameter properties here, nor in what it imports.

/** wago.tools' product of the Forever client (WOW_PROJECT_ID 18), and of Classic Era. */
const FOREVER_PRODUCT = "wowf";
const ERA_PRODUCT = "wow_classic_era";
/**
 * WEB-94: the builds to use when wago.tools' build list (`/api/builds`) doesn't answer while its table exports still
 * do (it answered 503 on 2026-11-07): the last import's builds, else these (the ones WEB-90 imported).
 */
export const KNOWN_BUILD = "1.60.1.70790";
export const KNOWN_ERA = "1.15.9.70576";
/** cmangos classic-db's full dump, pinned to a commit (GPL-3.0, https://github.com/cmangos/classic-db). */
export const CMANGOS_COMMIT = "28ef6259c782928b08a8dc9cacf6bc02e64f2b29";
const CMANGOS_FILE = "Full_DB/ClassicDB_1_12_1_z2815.sql.gz";

/** Extra filters per table, to download less (wago's `filter[col]` matches what contains it; `exact:` exactly). */
const FILTERS: Partial<Record<string, string>> = { ManifestInterfaceData: "filter%5BFilePath%5D=ICONS" };
const USER_AGENT = "CommunitiesForever-Web item import";

export interface ImportOptions {
  /** The Forever build (e.g. 1.60.1.70790); default the newest wago.tools lists for `wowf`. */
  build?: string;
  /** The Classic Era build; default the newest. */
  era?: string;
  /** The builds of the last import, used when the build list doesn't answer (default KNOWN_BUILD, KNOWN_ERA). */
  lastKnown?: { build: string; era: string };
  cache?: string;
  /** Use only what the cache holds. */
  offline?: boolean;
  /** Stop after the downloads. */
  downloadOnly?: boolean;
  /** What the import is doing, for the admin page and the console. */
  onStep?: (step: string) => void;
  fetch?: typeof fetch;
  now?: number;
}

export interface ImportSummary {
  build: string;
  era: string;
  items: number;
  recipes: number;
  foreverOnly: number;
  unobtainable: number;
  sources: number;
  /** WEB-96: dungeon bosses and their drops. */
  bosses: number;
  bossDrops: number;
  /** WEB-99: item sets with a piece among the items. */
  sets: number;
  /** False when the data was the same as the last import's. */
  changed: boolean;
  /** True when wago.tools' build list didn't answer and the last known builds were used (WEB-94). */
  fallback?: boolean;
}

/** A failure the admin page can show as it is. */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export function defaultCache(): string {
  return path.join(dataDir(), "import-cache");
}

/** Writes whole, then moves in: a cut-off run never leaves half a file in the cache. */
function writeWhole(file: string, data: string | Uint8Array): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

async function get(f: typeof fetch, url: string, tries = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await f(url, { headers: { "user-agent": USER_AGENT } });
      if (res.ok) return res;
      if (i >= tries || res.status < 500) throw new ImportError(`${new URL(url).host} answered ${res.status}.`);
    } catch (e) {
      if (e instanceof ImportError) throw e;
      if (i >= tries) throw new ImportError(`Couldn't reach ${new URL(url).host}.`);
    }
    await new Promise((r) => setTimeout(r, 2000 * i));
  }
}

/** A body as text, and whether it arrived whole (wago.tools resets long exports). */
async function text(res: Response): Promise<{ text: string; complete: boolean }> {
  if (res.body === null) return { text: "", complete: true };
  const decoder = new TextDecoder();
  let out = "";
  try {
    for await (const chunk of res.body) out += decoder.decode(chunk, { stream: true });
    out += decoder.decode();
    return { text: out, complete: true };
  } catch {
    return { text: out, complete: false };
  }
}

/** The newest builds wago.tools lists for Forever and Classic Era. */
export async function latestBuilds(f: typeof fetch = fetch): Promise<{ build: string; era: string }> {
  const res = await get(f, "https://wago.tools/api/builds");
  const list = (await res.json()) as Record<string, { version?: string; created_at?: string }[] | undefined>;
  const newest = (product: string): string => {
    const builds = (list[product] ?? []).filter((b) => typeof b.version === "string");
    builds.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const version = builds[0]?.version;
    if (version === undefined || !/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
      throw new ImportError(`wago.tools lists no ${product} build.`);
    }
    return version;
  };
  return { build: newest(FOREVER_PRODUCT), era: newest(ERA_PRODUCT) };
}

/**
 * One DB2 table as CSV. wago.tools cuts long exports off after a few seconds, so the download asks for ID order and
 * continues from the last whole row with `filter[ID]=>last` (checked) until a request ends cleanly.
 */
async function db2(
  options: ImportOptions & { cache: string },
  table: string,
  version: string,
  filter = FILTERS[table],
  name = table,
): Promise<Record<string, string>[]> {
  const file = path.join(options.cache, version, `${name}.csv`);
  if (!existsSync(file)) {
    if (options.offline) throw new ImportError(`The cache has no ${version}/${name}.csv.`);
    options.onStep?.(`Downloading ${name} (${version})`);
    let header = "";
    const parts: string[] = [];
    let last: number | undefined;
    for (let attempt = 0; ; attempt++) {
      if (attempt >= 200) throw new ImportError(`${table}: too many cut-off downloads.`);
      const filters = ["sort%5BID%5D=asc", filter, last !== undefined ? `filter%5BID%5D=%3E${last}` : undefined]
        .filter((f) => f !== undefined)
        .join("&");
      const url = `https://wago.tools/db2/${table}/csv?build=${version}&${filters}`;
      const body = await text(await get(options.fetch ?? fetch, url));
      const csv = parseCsv(body.text, body.complete);
      if (csv.header.length === 0) throw new ImportError(`wago.tools sent no ${table} table for build ${version}.`);
      const firstLine = body.text.slice(0, body.text.search(/\r?\n/));
      header ||= firstLine;
      let previous = last ?? -Infinity;
      for (const row of csv.rows) {
        const id = int(row, "ID");
        if (id === undefined || id <= previous) throw new ImportError(`${table}: rows came out of order.`);
        previous = id;
      }
      parts.push(body.text.slice(firstLine.length + 1, csv.consumed).replace(/^\n/, ""));
      if (body.complete) break;
      if (csv.rows.length === 0) throw new ImportError(`${table}: a cut-off download without a whole row.`);
      last = previous;
    }
    writeWhole(file, [header, ...parts.map((p) => p.replace(/\r?\n$/, ""))].filter((p) => p !== "").join("\n"));
  }
  return parseCsv(readFileSync(file, "utf8")).rows;
}

/** cmangos' dump, kept gzipped in the cache (13 MB rather than 73). */
async function cmangos(options: ImportOptions & { cache: string }): Promise<string> {
  const file = path.join(options.cache, "cmangos", `${CMANGOS_COMMIT}.sql.gz`);
  if (!existsSync(file)) {
    if (options.offline) throw new ImportError("The cache has no cmangos dump.");
    options.onStep?.("Downloading cmangos classic-db");
    const url = `https://raw.githubusercontent.com/cmangos/classic-db/${CMANGOS_COMMIT}/${CMANGOS_FILE}`;
    const res = await get(options.fetch ?? fetch, url);
    writeWhole(file, new Uint8Array(await res.arrayBuffer()));
  }
  return gunzipSync(readFileSync(file)).toString("utf8");
}

/** Downloads (or reads from the cache) and builds the database without writing it. */
export async function buildFromSources(
  options: ImportOptions,
): Promise<{ build: string; era: string; data?: ItemDatabase; fallback?: boolean }> {
  const o = { ...options, cache: options.cache ?? defaultCache() };
  let { build, era } = options;
  let fallback = false;
  if (build === undefined || era === undefined) {
    if (o.offline) throw new ImportError("Offline: name the builds.");
    o.onStep?.("Asking wago.tools for the newest builds");
    let latest: { build: string; era: string };
    try {
      latest = await latestBuilds(o.fetch ?? fetch);
    } catch (e) {
      if (!(e instanceof ImportError)) throw e;
      // WEB-94: the build list can be down while the table exports work; take the last known builds.
      latest = o.lastKnown ?? { build: KNOWN_BUILD, era: KNOWN_ERA };
      fallback = true;
      o.onStep?.(`wago.tools' build list didn't answer; using build ${build ?? latest.build}`);
    }
    build ??= latest.build;
    era ??= latest.era;
  }
  const db2Tables: ImportInput["db2"] = {};
  for (const table of DB2_TABLES) db2Tables[table] = await db2(o, table, build);
  const eraTables = {
    abilities: await db2(o, "SkillLineAbility", era),
    // Era's learn-spell effects only (Effect 36): what cmangos' trainer and recipe-item spells teach.
    learn: await db2(o, "SpellEffect", era, "filter%5BEffect%5D=exact:36", "SpellEffect-learn"),
  };
  if (o.downloadOnly) return { build, era, ...(fallback ? { fallback } : {}) };
  const sql = await cmangos(o);
  o.onStep?.("Building the item database");
  const columns = readColumns(sql, CMANGOS_TABLES);
  const sqlTables: ImportInput["cmangos"] = {};
  for (const table of CMANGOS_TABLES) {
    const cols = columns[table];
    if (cols === undefined) throw new ImportError(`The cmangos dump has no ${table} table.`);
    sqlTables[table] = readRows(sql, table, cols);
  }
  const data = buildItemDatabase({ db2: db2Tables, era: eraTables, cmangos: sqlTables });
  if (data.recipes.length === 0) throw new ImportError(`Build ${build} gave no recipes; nothing was changed.`);
  return { build, era, data, ...(fallback ? { fallback } : {}) };
}

/** The whole import: download, build, write. */
export async function importItems(db: Db, options: ImportOptions = {}): Promise<ImportSummary> {
  const last = db.select().from(itemImport).get();
  const lastKnown = options.lastKnown ?? (last !== undefined ? { build: last.build, era: last.eraBuild } : undefined);
  const { build, era, data, fallback } = await buildFromSources({ ...options, ...(lastKnown ? { lastKnown } : {}) });
  if (data === undefined) throw new ImportError("Nothing was built.");
  options.onStep?.("Writing the item database");
  const { changed } = writeItemDatabase(
    db,
    data,
    { build, era, cmangos: CMANGOS_COMMIT },
    options.now ?? Math.floor(Date.now() / 1000),
  );
  return { ...summaryOf(build, era, data, changed), ...(fallback ? { fallback } : {}) };
}

export function summaryOf(build: string, era: string, data: ItemDatabase, changed: boolean): ImportSummary {
  return {
    build,
    era,
    items: data.items.length,
    recipes: data.recipes.length,
    foreverOnly: data.recipes.filter((r) => r.foreverOnly).length,
    unobtainable: data.recipes.filter((r) => !r.obtainable).length,
    sources: data.sources.length,
    bosses: data.bosses.length,
    bossDrops: data.bossDrops.length,
    sets: data.sets.length,
    changed,
  };
}
