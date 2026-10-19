import "server-only";
import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";
import type { AppDb } from "./index";

/**
 * Cloudflare driver: the D1 database bound as `DB` in wrangler.jsonc.
 * Migrations are applied with `wrangler d1 migrations apply` (not at runtime).
 */

type D1Binding = Parameters<typeof drizzle>[0];

const cache = new WeakMap<object, AppDb>();

export function openDatabase(): AppDb {
  const env = getCloudflareContext().env as unknown as { DB?: D1Binding };
  if (!env.DB) throw new Error('D1 binding "DB" is missing. Check d1_databases in wrangler.jsonc.');
  let db = cache.get(env.DB);
  if (!db) {
    db = drizzle(env.DB, { schema }) as unknown as AppDb;
    cache.set(env.DB, db);
  }
  return db;
}

export function createDb(): AppDb {
  throw new Error("createDb() is only available with the local SQLite driver.");
}

export const DB_DRIVER = "cloudflare-d1";
