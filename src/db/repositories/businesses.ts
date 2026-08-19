/**
 * Business repository.
 *
 * The one table not scoped BY a business — it is the business.
 *
 * THE ONLY TWO FUNCTIONS IN `src/db/repositories/` THAT DO NOT TAKE A
 * BUSINESS IDENTIFIER FIRST are here, and both are bootstrap:
 *
 *   createBusiness(input)  there is no business yet to scope by
 *   getOnlyBusiness()      resolves the identifier every other call needs
 *
 * Every other function in every other repository — all 70 of them — takes
 * `businessId` as its first argument and filters on it, including single-row
 * reads by primary key. V1 has one business; the discipline is not optional,
 * because retrofitting it later means auditing every query. See AGENTS.md,
 * "Every database query is scoped by business".
 */

import { eq } from 'drizzle-orm'

import { db } from '../client'
import { businesses } from '../schema'

export type Business = typeof businesses.$inferSelect
export type NewBusiness = typeof businesses.$inferInsert

export async function createBusiness(input: NewBusiness): Promise<Business> {
  const [row] = await db().insert(businesses).values(input).returning()
  if (!row) throw new Error('createBusiness inserted no row')
  return row
}

export async function getBusiness(businessId: string): Promise<Business | null> {
  const [row] = await db().select().from(businesses).where(eq(businesses.id, businessId)).limit(1)
  return row ?? null
}

/** V1 has exactly one business. Used at startup to resolve it. */
export async function getOnlyBusiness(): Promise<Business | null> {
  const [row] = await db().select().from(businesses).limit(1)
  return row ?? null
}

export async function updateBusiness(
  businessId: string,
  patch: Partial<Omit<NewBusiness, 'id'>>
): Promise<Business | null> {
  const [row] = await db()
    .update(businesses)
    .set(patch)
    .where(eq(businesses.id, businessId))
    .returning()
  return row ?? null
}
