/**
 * Pricing component and ad-hoc line item repository.
 *
 * A pricing component with a null `bookingId` is a business default. One
 * carrying a `bookingId` is a snapshot taken for that booking.
 *
 * Money is integer cents everywhere. See AGENTS.md.
 */

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '../client'
import { adhocLineItems, pricingComponents } from '../schema'

export type PricingComponentRow = typeof pricingComponents.$inferSelect
export type NewPricingComponent = typeof pricingComponents.$inferInsert
export type AdhocLineItemRow = typeof adhocLineItems.$inferSelect
export type NewAdhocLineItem = typeof adhocLineItems.$inferInsert

export async function createPricingComponent(
  businessId: string,
  input: Omit<NewPricingComponent, 'businessId'>
) {
  const [row] = await db()
    .insert(pricingComponents)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createPricingComponent inserted no row')
  return row
}

/** The business defaults — components with no booking attached. */
export async function listDefaultPricingComponents(businessId: string) {
  return db()
    .select()
    .from(pricingComponents)
    .where(and(eq(pricingComponents.businessId, businessId), isNull(pricingComponents.bookingId)))
    .orderBy(pricingComponents.sortOrder)
}

export async function listPricingComponentsForBooking(businessId: string, bookingId: string) {
  return db()
    .select()
    .from(pricingComponents)
    .where(
      and(eq(pricingComponents.businessId, businessId), eq(pricingComponents.bookingId, bookingId))
    )
    .orderBy(pricingComponents.sortOrder)
}

export async function createAdhocLineItem(
  businessId: string,
  input: Omit<NewAdhocLineItem, 'businessId'>
) {
  const [row] = await db()
    .insert(adhocLineItems)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createAdhocLineItem inserted no row')
  return row
}

export async function listAdhocLineItems(businessId: string, bookingId: string) {
  return db()
    .select()
    .from(adhocLineItems)
    .where(and(eq(adhocLineItems.businessId, businessId), eq(adhocLineItems.bookingId, bookingId)))
    .orderBy(adhocLineItems.sortOrder)
}
