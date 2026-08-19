/**
 * The Drizzle client. One instance.
 *
 * This file and `src/db/repositories/` are the only places that may touch
 * the database. Route handlers, server actions, and pages go through a
 * repository. See AGENTS.md, "Every database query is scoped by business".
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import { env } from '@/lib/env'
import * as schema from './schema'

export type Database = ReturnType<typeof createDatabase>

function createDatabase() {
  return drizzle(neon(env().DATABASE_URL), { schema })
}

let cached: ReturnType<typeof createDatabase> | null = null

/**
 * The shared client, created on first use.
 *
 * Lazy rather than created at module load so that importing anything under
 * `src/db/` does not require a database connection string — a schema-only
 * consumer such as `drizzle-kit` must be able to import the schema without
 * one.
 */
export function db(): Database {
  if (cached === null) cached = createDatabase()
  return cached
}
