'use server'

import { revalidatePath } from 'next/cache'

import { isValidCalendarDate, todayIn } from '@/core/dates'
import type { ActivitySource } from '@/core/types'
import { createActivityEntry } from '@/db/repositories/activity'
import { env } from '@/lib/env'

import { actingAdmin } from './bookings'

const SOURCES: ActivitySource[] = [
  'text_message',
  'in_person',
  'email',
  'phone',
  'customer_form',
  'app',
]

export interface ActivityState {
  error: string | null
}

/**
 * Record something that happened outside the app.
 *
 * `entryDate` is when it HAPPENED, not when it was typed — a text message
 * from last Tuesday is dated last Tuesday, and the log sorts by that. The
 * acting admin is recorded on every entry, manual or system.
 */
export async function addActivityEntry(
  _previous: ActivityState,
  formData: FormData
): Promise<ActivityState> {
  const { businessId, admin } = await actingAdmin()

  const bookingId = String(formData.get('bookingId') ?? '')
  const customerId = String(formData.get('customerId') ?? '')
  const note = String(formData.get('note') ?? '').trim()
  const source = String(formData.get('source') ?? '') as ActivitySource
  const entryDate = String(formData.get('entryDate') ?? '')

  if (note.length === 0) return { error: 'An entry needs a note.' }
  if (!SOURCES.includes(source)) return { error: 'Choose where this came from.' }
  if (entryDate.length > 0 && !isValidCalendarDate(entryDate)) {
    return { error: 'That is not a real date.' }
  }
  if (bookingId.length === 0 && customerId.length === 0) {
    return { error: 'An entry needs a booking or a customer.' }
  }

  await createActivityEntry(businessId, {
    bookingId: bookingId.length > 0 ? bookingId : null,
    customerId: customerId.length > 0 ? customerId : null,
    note,
    source,
    entryDate: entryDate.length > 0 ? entryDate : todayIn(env().APP_TIMEZONE, new Date()),
    actorId: admin.id,
    isSystem: false,
  })

  revalidatePath(bookingId.length > 0 ? `/bookings/${bookingId}` : `/customers/${customerId}`)
  return { error: null }
}
