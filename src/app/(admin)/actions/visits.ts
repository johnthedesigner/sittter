'use server'

import { revalidatePath } from 'next/cache'

import { todayIn } from '@/core/dates'
import type { CalendarDate, TimeWindow } from '@/core/types'
import { env } from '@/lib/env'
import {
  VisitError,
  addVisit,
  editVisit,
  planRegeneration,
  regenerateVisitsForBooking,
  removeVisit,
} from '@/services/visits'

// VisitState and EMPTY_VISIT_STATE live in src/components/visit-state.ts:
// a 'use server' file may export only async functions.
import { EMPTY_VISIT_STATE } from '@/components/visit-state'
import type { VisitState } from '@/components/visit-state'

import { actingAdmin } from './bookings'

/**
 * Regenerate the schedule.
 *
 * Two steps when logged visits are at stake: the first submission returns a
 * warning that NAMES them, the second proceeds. Journey step 4.3.4. Logged
 * visits are preserved either way — the warning is so nobody is surprised,
 * not a licence to delete them.
 */
export async function regenerateVisitsAction(
  _previous: VisitState,
  formData: FormData
): Promise<VisitState> {
  const { businessId, admin } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')
  const confirmed = formData.get('confirmed') === 'true'
  const today = todayIn(env().APP_TIMEZONE, new Date())

  try {
    if (!confirmed) {
      const plan = await planRegeneration(businessId, bookingId)
      if (plan.preservedLogged.length > 0) {
        const dates = plan.preservedLogged.map((v) => v.visitDate).join(', ')
        return {
          error: null,
          warning: `These visits have logs and will be kept even though the cadences no longer produce them: ${dates}. Regenerate anyway?`,
        }
      }
    }

    await regenerateVisitsForBooking(businessId, admin.id, admin.name, bookingId, today)
  } catch (error: unknown) {
    if (error instanceof VisitError) return { error: error.message, warning: null }
    throw error
  }

  revalidatePath(`/bookings/${bookingId}`)
  return EMPTY_VISIT_STATE
}

export async function addVisitAction(
  _previous: VisitState,
  formData: FormData
): Promise<VisitState> {
  const { businessId } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')
  const date = String(formData.get('visitDate') ?? '')
  const window = String(formData.get('window') ?? 'anytime') as TimeWindow
  const duration = String(formData.get('durationMinutes') ?? '')

  if (date.length === 0) return { error: 'A visit needs a date.', warning: null }

  try {
    await addVisit(
      businessId,
      bookingId,
      date as CalendarDate,
      window,
      duration.length > 0 ? Number(duration) : null
    )
  } catch (error: unknown) {
    if (error instanceof VisitError) return { error: error.message, warning: null }
    throw error
  }

  revalidatePath(`/bookings/${bookingId}`)
  return EMPTY_VISIT_STATE
}

export async function editVisitAction(formData: FormData): Promise<void> {
  const { businessId } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')
  const duration = String(formData.get('durationMinutes') ?? '')
  await editVisit(businessId, String(formData.get('visitId') ?? ''), {
    window: String(formData.get('window') ?? 'anytime') as TimeWindow,
    durationMinutes: duration.length > 0 ? Number(duration) : null,
  })
  revalidatePath(`/bookings/${bookingId}`)
}

/**
 * Delete a visit.
 *
 * A visit with a log needs `confirmed`; an unlogged one does not. Journey
 * steps 4.3.2 and 4.3.3.
 */
export async function deleteVisitAction(
  _previous: VisitState,
  formData: FormData
): Promise<VisitState> {
  const { businessId } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')

  try {
    await removeVisit(
      businessId,
      String(formData.get('visitId') ?? ''),
      formData.get('confirmed') === 'true'
    )
  } catch (error: unknown) {
    if (error instanceof VisitError) return { error: null, warning: error.message }
    throw error
  }

  revalidatePath(`/bookings/${bookingId}`)
  return EMPTY_VISIT_STATE
}
