/**
 * Link repository.
 *
 * A slug is an opaque five-character lookup key carrying no claims. Access is
 * decided by reading the row and checking `revokedAt` and `expiresAt`
 * server-side. See AGENTS.md, "Links carry no claims and are resolved
 * server-side".
 *
 * Slugs are stored uppercase and resolved case-insensitively.
 *
 * Resolution takes a business identifier like every other repository
 * function, even though a slug is globally unique and the URL carries no
 * business context. The caller resolves the business first — V1 has exactly
 * one, via `getOnlyBusiness()`. Skipping the argument here because it is
 * currently redundant is exactly the shortcut AGENTS.md warns about:
 * retrofitting it later means auditing every query.
 */

import { and, eq, sql } from 'drizzle-orm'

import { db } from '../client'
import { links } from '../schema'

export type Link = typeof links.$inferSelect
export type NewLink = typeof links.$inferInsert

export async function createLink(businessId: string, input: Omit<NewLink, 'businessId'>) {
  const [row] = await db()
    .insert(links)
    .values({ ...input, businessId, slug: input.slug.toUpperCase() })
    .returning()
  if (!row) throw new Error('createLink inserted no row')
  return row
}

/**
 * Resolve a slug, case-insensitively.
 *
 * Returns the row whatever its state — revoked, expired, or live. The caller
 * decides, and must produce the SAME response for a revoked slug, an expired
 * slug, and one that never existed.
 */
export async function findLinkBySlug(businessId: string, slug: string): Promise<Link | null> {
  const [row] = await db()
    .select()
    .from(links)
    .where(and(eq(links.businessId, businessId), sql`upper(${links.slug}) = upper(${slug})`))
    .limit(1)
  return row ?? null
}

export async function recordLinkHit(businessId: string, slug: string, at: Date): Promise<void> {
  await db()
    .update(links)
    .set({ hitCount: sql`${links.hitCount} + 1`, lastHitAt: at })
    .where(and(eq(links.businessId, businessId), sql`upper(${links.slug}) = upper(${slug})`))
}

export async function revokeLink(businessId: string, linkId: string, at: Date) {
  const [row] = await db()
    .update(links)
    .set({ revokedAt: at })
    .where(and(eq(links.businessId, businessId), eq(links.id, linkId)))
    .returning()
  return row ?? null
}

export async function listLinks(businessId: string): Promise<Link[]> {
  return db().select().from(links).where(eq(links.businessId, businessId))
}
