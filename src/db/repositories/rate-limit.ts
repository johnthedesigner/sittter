/**
 * Rate limit counters.
 *
 * Database-backed, no Redis — `docs/dev-plan.md` §3. One row per key per
 * fixed one-minute window, so a window expires by never being written to
 * again rather than by anything having to expire it.
 *
 * NOT SCOPED BY BUSINESS, deliberately and by exception. A rate limit is
 * about the caller — an IP address — not about a tenant, and slug resolution
 * happens before any business is known. The table carries no business column
 * for the same reason. See `src/db/repositories/businesses.ts` for the only
 * other exceptions in this directory.
 */

import { and, eq, lt, sql } from 'drizzle-orm'

import { db } from '../client'
import { rateLimitHits } from '../schema'

/**
 * Count this hit and return the running total for the window.
 *
 * One statement, so two simultaneous requests cannot both read 29 and both
 * decide they are under a limit of 30.
 */
export async function countHit(key: string, windowStart: Date): Promise<number> {
  const [row] = await db()
    .insert(rateLimitHits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitHits.key, rateLimitHits.windowStart],
      set: { count: sql`${rateLimitHits.count} + 1` },
    })
    .returning({ count: rateLimitHits.count })

  return row?.count ?? 1
}

export async function hitsInWindow(key: string, windowStart: Date): Promise<number> {
  const [row] = await db()
    .select({ count: rateLimitHits.count })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.key, key), eq(rateLimitHits.windowStart, windowStart)))
    .limit(1)
  return row?.count ?? 0
}

/** Drop windows older than `before`. Housekeeping for the daily job. */
export async function pruneRateLimitHits(before: Date): Promise<number> {
  const rows = await db()
    .delete(rateLimitHits)
    .where(lt(rateLimitHits.windowStart, before))
    .returning({ key: rateLimitHits.key })
  return rows.length
}
