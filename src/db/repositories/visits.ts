/**
 * Visit repository, including the visit-to-task join.
 */

import { and, eq, inArray } from 'drizzle-orm'

import { db } from '../client'
import { visitTasks, visits } from '../schema'

export type Visit = typeof visits.$inferSelect
export type NewVisit = typeof visits.$inferInsert

export async function createVisit(businessId: string, input: Omit<NewVisit, 'businessId'>) {
  const [row] = await db()
    .insert(visits)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createVisit inserted no row')
  return row
}

export async function listVisitsForBooking(businessId: string, bookingId: string) {
  return db()
    .select()
    .from(visits)
    .where(and(eq(visits.businessId, businessId), eq(visits.bookingId, bookingId)))
    .orderBy(visits.visitDate)
}

export async function getVisit(businessId: string, visitId: string) {
  const [row] = await db()
    .select()
    .from(visits)
    .where(and(eq(visits.businessId, businessId), eq(visits.id, visitId)))
    .limit(1)
  return row ?? null
}

export async function setVisitTasks(
  businessId: string,
  visitId: string,
  careInstructionIds: string[]
): Promise<void> {
  const visit = await getVisit(businessId, visitId)
  if (visit === null) throw new Error('setVisitTasks: visit is not in this business')

  await db().delete(visitTasks).where(eq(visitTasks.visitId, visitId))
  if (careInstructionIds.length === 0) return
  await db()
    .insert(visitTasks)
    .values(careInstructionIds.map((careInstructionId) => ({ visitId, careInstructionId })))
}

export async function listVisitTaskIds(businessId: string, visitId: string): Promise<string[]> {
  const visit = await getVisit(businessId, visitId)
  if (visit === null) return []
  const rows = await db()
    .select({ id: visitTasks.careInstructionId })
    .from(visitTasks)
    .where(eq(visitTasks.visitId, visitId))
  return rows.map((r) => r.id)
}

export async function deleteVisits(businessId: string, visitIds: string[]): Promise<number> {
  if (visitIds.length === 0) return 0
  const rows = await db()
    .delete(visits)
    .where(and(eq(visits.businessId, businessId), inArray(visits.id, visitIds)))
    .returning({ id: visits.id })
  return rows.length
}

/** Visits for several bookings at once, so a screen needs one query not N. */
export async function listVisitsForBookings(
  businessId: string,
  bookingIds: string[]
): Promise<Visit[]> {
  if (bookingIds.length === 0) return []
  return db()
    .select()
    .from(visits)
    .where(and(eq(visits.businessId, businessId), inArray(visits.bookingId, bookingIds)))
    .orderBy(visits.visitDate)
}

/** Every visit falling on one date, across all bookings. */
export async function listVisitsOnDate(businessId: string, date: string): Promise<Visit[]> {
  return db()
    .select()
    .from(visits)
    .where(and(eq(visits.businessId, businessId), eq(visits.visitDate, date)))
    .orderBy(visits.visitDate)
}
