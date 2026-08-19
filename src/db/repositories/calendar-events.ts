/**
 * Calendar event repository.
 *
 * Rows carry the app's own identifiers so synchronization stays reconcilable
 * after a manual edit in Google. A sync failure is recorded in `lastError`
 * and retried by the daily job; it never blocks a booking write.
 */

import { and, eq } from 'drizzle-orm'

import { db } from '../client'
import { calendarEvents } from '../schema'

export type CalendarEvent = typeof calendarEvents.$inferSelect
export type NewCalendarEvent = typeof calendarEvents.$inferInsert

export async function createCalendarEvent(
  businessId: string,
  input: Omit<NewCalendarEvent, 'businessId'>
) {
  const [row] = await db()
    .insert(calendarEvents)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createCalendarEvent inserted no row')
  return row
}

export async function listDirtyCalendarEvents(businessId: string) {
  return db()
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.businessId, businessId), eq(calendarEvents.dirty, true)))
}

export async function markCalendarEventSynced(
  businessId: string,
  id: string,
  googleEventId: string,
  at: Date
) {
  const [row] = await db()
    .update(calendarEvents)
    .set({ googleEventId, dirty: false, syncedAt: at, lastError: null })
    .where(and(eq(calendarEvents.businessId, businessId), eq(calendarEvents.id, id)))
    .returning()
  return row ?? null
}

export async function markCalendarEventFailed(businessId: string, id: string, error: string) {
  const [row] = await db()
    .update(calendarEvents)
    .set({ dirty: true, lastError: error })
    .where(and(eq(calendarEvents.businessId, businessId), eq(calendarEvents.id, id)))
    .returning()
  return row ?? null
}
