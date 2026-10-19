import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import type { AppDb } from "./index";

/**
 * Local driver: a SQLite file on this computer via better-sqlite3.
 * Cloudflare builds replace this module with ./driver.d1 (see next.config.mjs).
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

/** Opens a SQLite database and applies pending migrations. Use ":memory:" in tests. */
export function createDb(filePath: string): AppDb {
  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db as unknown as AppDb;
}

// Reuse one connection across Next.js hot reloads in dev.
const globalForDb = globalThis as unknown as { __callcopilotLocalDb?: AppDb };

export function openDatabase(): AppDb {
  if (!globalForDb.__callcopilotLocalDb) {
    const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "callcopilot.db");
    globalForDb.__callcopilotLocalDb = createDb(file);
  }
  return globalForDb.__callcopilotLocalDb;
}

export const DB_DRIVER = "sqlite-file";
