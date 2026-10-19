import "server-only";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type * as schema from "./schema";
// Local SQLite driver. Cloudflare builds swap this import for ./driver.d1 (next.config.mjs).
import { createDb, DB_DRIVER, openDatabase } from "./driver.local";

/**
 * Database handle that works with both drivers: better-sqlite3 (sync) locally and D1 (async)
 * on Cloudflare. All repository code awaits its queries, which is correct for both.
 */
export type AppDb = BaseSQLiteDatabase<"sync" | "async", unknown, typeof schema>;

let override: AppDb | undefined;

export function getDb(): AppDb {
  return override ?? openDatabase();
}

/** Test hook: swap in an isolated database. */
export function setDbForTests(db: AppDb | undefined): void {
  override = db;
}

export { createDb, DB_DRIVER };
