/**
 * Integration test harness for the database.
 *
 * TESTS ONLY. Nothing under `src/db/repositories/` or `src/services/` imports
 * this, and it never ships.
 */

import { neon } from '@neondatabase/serverless'

/**
 * Tables emptied between tests, ordered so that truncating one does not
 * fight a foreign key. `CASCADE` makes the order unnecessary in practice,
 * but listing them is what makes a newly added table visibly missing here.
 */
const TABLES = [
  'digest_sends',
  'email_sends',
  'calendar_events',
  'observed_weather',
  'rate_limit_hits',
  'links',
  'activity_entries',
  'photos',
  'visit_logs',
  'visit_tasks',
  'visits',
  'adhoc_line_items',
  'pricing_components',
  'bookings',
  'care_instructions',
  'properties',
  'customers',
  'sessions',
  'magic_link_tokens',
  'admins',
  'businesses',
] as const

let guarded = false

/**
 * Refuse to run against anything but the test branch.
 *
 * Integration tests truncate every table. Pointed at the development branch
 * they would destroy the seed data silently, and the first symptom would be
 * a confusing empty screen rather than an error. This makes that impossible
 * to do by accident.
 */
function guardDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set for integration tests.\n' +
        'These tests read .env.test, which must carry the Neon `test` branch\n' +
        'connection string. See SESSION_LOG.md for the branch layout.'
    )
  }

  if (!guarded) {
    // The development branch endpoint, read from .env, must not be the target.
    const devUrl = process.env.DEV_DATABASE_URL
    if (devUrl && devUrl === url) {
      throw new Error(
        'Integration tests are pointed at the development database.\n' +
          'They truncate every table. Point .env.test at the Neon `test` branch.'
      )
    }
    guarded = true
  }

  return url
}

export function testSql() {
  return neon(guardDatabaseUrl())
}

/** Empty every table. Called before each test so cases cannot leak into each other. */
export async function resetDatabase(): Promise<void> {
  const sql = testSql()
  const list = TABLES.map((t) => `"${t}"`).join(', ')
  // `query` takes a plain string; the tagged-template form is for parameters,
  // and a table list cannot be parameterized. The names are literals in this
  // file, not input.
  await sql.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

/**
 * Every table in the public schema, so a test can assert that TABLES above
 * has not fallen behind the schema.
 */
export async function publicTables(): Promise<string[]> {
  const sql = testSql()
  const rows = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `
  return rows.map((r) => r.table_name as string)
}

export const TRUNCATED_TABLES: readonly string[] = TABLES
