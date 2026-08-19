/**
 * Activity entry repository.
 *
 * ACTIVITY ENTRIES NEVER REACH A CUSTOMER SURFACE. There is deliberately no
 * customer-facing read function in this module. See AGENTS.md, "Customer
 * surfaces exclude sensitive data at the query layer".
 */

import { and, desc, eq } from 'drizzle-orm'

import { db } from '../client'
import { activityEntries } from '../schema'

export type ActivityEntry = typeof activityEntries.$inferSelect
export type NewActivityEntry = typeof activityEntries.$inferInsert

export async function createActivityEntry(
  businessId: string,
  input: Omit<NewActivityEntry, 'businessId'>
) {
  const [row] = await db()
    .insert(activityEntries)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createActivityEntry inserted no row')
  return row
}

export async function listActivityForBooking(businessId: string, bookingId: string) {
  return db()
    .select()
    .from(activityEntries)
    .where(
      and(eq(activityEntries.businessId, businessId), eq(activityEntries.bookingId, bookingId))
    )
    .orderBy(desc(activityEntries.entryDate), desc(activityEntries.createdAt))
}

export async function listActivityForCustomer(businessId: string, customerId: string) {
  return db()
    .select()
    .from(activityEntries)
    .where(
      and(eq(activityEntries.businessId, businessId), eq(activityEntries.customerId, customerId))
    )
    .orderBy(desc(activityEntries.entryDate), desc(activityEntries.createdAt))
}
