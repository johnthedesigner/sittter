'use server'

import { revalidatePath } from 'next/cache'

import { todayIn } from '@/core/dates'
import type { CalendarDate } from '@/core/types'
import { env } from '@/lib/env'
import {
  CaptureError,
  cancelBooking,
  declineBooking,
  markPaid,
  setAvailabilityChecked,
  setDatesFirm,
} from '@/services/bookings'

import { actingAdmin } from './bookings'

export interface ConfirmationState {
  error: string | null
}

function bookingIdFrom(formData: FormData): string {
  return String(formData.get('bookingId') ?? '')
}

/** "Customer's dates are firm." */
export async function toggleDatesFirm(formData: FormData): Promise<void> {
  const { businessId, admin } = await actingAdmin()
  const bookingId = bookingIdFrom(formData)
  const now = new Date()

  await setDatesFirm(
    businessId,
    admin.id,
    admin.name,
    bookingId,
    formData.get('value') === 'true',
    now,
    todayIn(env().APP_TIMEZONE, now)
  )

  revalidatePath(`/bookings/${bookingId}`)
}

/**
 * "Checked the family calendar." ITS OWN SUBMISSION.
 *
 * This action reads exactly two fields — the booking and the desired value —
 * and passes them to a service function whose signature accepts nothing else.
 * Extra fields in the FormData are structurally incapable of taking effect,
 * which is what `docs/spec.md` §5.5 means by "must not be combined with any
 * other change into a single save action".
 *
 * UNDER REVIEW, `docs/spec.md` §10. Do not relax this.
 */
export async function toggleAvailabilityChecked(formData: FormData): Promise<void> {
  const { businessId, admin } = await actingAdmin()
  const bookingId = bookingIdFrom(formData)
  const now = new Date()

  await setAvailabilityChecked(
    businessId,
    admin.id,
    admin.name,
    bookingId,
    formData.get('value') === 'true',
    now,
    todayIn(env().APP_TIMEZONE, now)
  )

  revalidatePath(`/bookings/${bookingId}`)
}

export async function declineBookingAction(formData: FormData): Promise<void> {
  const { businessId, admin } = await actingAdmin()
  const bookingId = bookingIdFrom(formData)
  const now = new Date()
  await declineBooking(
    businessId,
    admin.id,
    admin.name,
    bookingId,
    now,
    todayIn(env().APP_TIMEZONE, now)
  )
  revalidatePath(`/bookings/${bookingId}`)
}

export async function cancelBookingAction(formData: FormData): Promise<void> {
  const { businessId, admin } = await actingAdmin()
  const bookingId = bookingIdFrom(formData)
  const now = new Date()
  await cancelBooking(
    businessId,
    admin.id,
    admin.name,
    bookingId,
    now,
    todayIn(env().APP_TIMEZONE, now)
  )
  revalidatePath(`/bookings/${bookingId}`)
}

export async function markPaidAction(
  _previous: ConfirmationState,
  formData: FormData
): Promise<ConfirmationState> {
  const { businessId, admin } = await actingAdmin()
  const bookingId = bookingIdFrom(formData)
  const now = new Date()
  const today = todayIn(env().APP_TIMEZONE, now)
  const paidOn = String(formData.get('paidOn') ?? '')
  const note = String(formData.get('paidMethodNote') ?? '')

  try {
    await markPaid(
      businessId,
      admin.id,
      admin.name,
      bookingId,
      (paidOn.length > 0 ? paidOn : today) as CalendarDate,
      note,
      today
    )
  } catch (error: unknown) {
    if (error instanceof CaptureError) return { error: error.message }
    throw error
  }

  revalidatePath(`/bookings/${bookingId}`)
  return { error: null }
}
