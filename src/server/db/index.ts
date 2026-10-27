import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export const DB_FILE = "communitiesforever.sqlite";

/**
 * DATA_DIR (.env.example): `/data` in the container. Locally the default sits next to the repo, not in it: `next dev`
 * watches the project folder, so a database inside it makes every write rebuild and reload the page (a reload loop).
 */
export const LOCAL_DATA_DIR = "../CommunitiesForever-Web-data";

export function dataDir(env: Record<string, string | undefined> = process.env): string {
  return env.DATA_DIR || LOCAL_DATA_DIR;
}

/** Opens (and creates) the database file and brings it to the latest migration. */
export function openDatabase(file: string, migrationsFolder = path.join(process.cwd(), "drizzle")): Db {
  mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return db;
}

let shared: Db | undefined;

/** The app's database in DATA_DIR, opened once per process. */
export function getDb(): Db {
  shared ??= openDatabase(path.join(dataDir(), DB_FILE));
  return shared;
}
