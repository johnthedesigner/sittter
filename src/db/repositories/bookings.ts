/**
 * Booking repository.
 *
 * There is no status column and there never will be. Status is derived by
 * `deriveStatus()` in `src/core/status.ts` from the flags and dates below.
 * See AGENTS.md, "Booking status is derived, never stored".
 */

import { and, eq, inArray } from 'drizzle-orm'

import { db } from '../client'
import { bookings, customers, properties } from '../schema'

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

/**
 * A booking with the two names every admin surface shows beside it.
 *
 * The booking list needs customer name and property nickname on every row;
 * fetching them per row would be a query per booking. Columns are named
 * explicitly rather than spreading the joined tables, so nothing admin-only
 * from `properties` — access codes, access notes — can arrive by accident.
 */
export interface BookingSummary {
  booking: Booking
  customerId: string
  customerName: string
  propertyNickname: string
}

export async function listBookingSummaries(businessId: string): Promise<BookingSummary[]> {
  const rows = await db()
    .select({
      booking: bookings,
      customerId: customers.id,
      customerName: customers.name,
      propertyNickname: properties.nickname,
    })
    .from(bookings)
    .innerJoin(properties, eq(properties.id, bookings.propertyId))
    .innerJoin(customers, eq(customers.id, properties.customerId))
    .where(eq(bookings.businessId, businessId))
    .orderBy(bookings.startDate)
  return rows
}

export async function getBookingSummary(
  businessId: string,
  bookingId: string
): Promise<BookingSummary | null> {
  const [row] = await db()
    .select({
      booking: bookings,
      customerId: customers.id,
      customerName: customers.name,
      propertyNickname: properties.nickname,
    })
    .from(bookings)
    .innerJoin(properties, eq(properties.id, bookings.propertyId))
    .innerJoin(customers, eq(customers.id, properties.customerId))
    .where(and(eq(bookings.businessId, businessId), eq(bookings.id, bookingId)))
    .limit(1)
  return row ?? null
}

/** Bookings by identifier, for assembling several at once. */
export async function listBookingsByIds(businessId: string, ids: string[]): Promise<Booking[]> {
  if (ids.length === 0) return []
  return db()
    .select()
    .from(bookings)
    .where(and(eq(bookings.businessId, businessId), inArray(bookings.id, ids)))
}
