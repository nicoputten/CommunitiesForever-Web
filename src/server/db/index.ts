import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export const DB_FILE = "communitiesforever.sqlite";

/** DATA_DIR (.env.example): `./data` locally, `/data` in the container. */
export function dataDir(env: Record<string, string | undefined> = process.env): string {
  return env.DATA_DIR || "./data";
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
