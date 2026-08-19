/**
 * Booking repository.
 *
 * There is no status column and there never will be. Status is derived by
 * `deriveStatus()` in `src/core/status.ts` from the flags and dates below.
 * See AGENTS.md, "Booking status is derived, never stored".
 */

import { and, eq } from 'drizzle-orm'

import { db } from '../client'
import { bookings } from '../schema'

export type Booking = typeof bookings.$inferSelect
export type NewBooking = typeof bookings.$inferInsert

export async function createBooking(businessId: string, input: Omit<NewBooking, 'businessId'>) {
  const [row] = await db()
    .insert(bookings)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createBooking inserted no row')
  return row
}

export async function listBookings(businessId: string): Promise<Booking[]> {
  return db()
    .select()
    .from(bookings)
    .where(eq(bookings.businessId, businessId))
    .orderBy(bookings.startDate)
}

export async function listBookingsForProperty(businessId: string, propertyId: string) {
  return db()
    .select()
    .from(bookings)
    .where(and(eq(bookings.businessId, businessId), eq(bookings.propertyId, propertyId)))
    .orderBy(bookings.startDate)
}

export async function getBooking(businessId: string, bookingId: string) {
  const [row] = await db()
    .select()
    .from(bookings)
    .where(and(eq(bookings.businessId, businessId), eq(bookings.id, bookingId)))
    .limit(1)
  return row ?? null
}

export async function updateBooking(
  businessId: string,
  bookingId: string,
  patch: Partial<Omit<NewBooking, 'businessId' | 'id'>>
) {
  const [row] = await db()
    .update(bookings)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(bookings.businessId, businessId), eq(bookings.id, bookingId)))
    .returning()
  return row ?? null
}
