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

import { generateVisitsOnConfirmation } from '@/services/visits'
import { snapshotPricing } from '@/services/pricing'

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

  const today = todayIn(env().APP_TIMEZONE, now)
  await setDatesFirm(
    businessId,
    admin.id,
    admin.name,
    bookingId,
    formData.get('value') === 'true',
    now,
    today
  )

  // Either flag can be the one that completes confirmation, so generation
  // keys off the resulting derived status rather than off which was toggled.
  await generateVisitsOnConfirmation(businessId, admin.id, admin.name, bookingId, today)
  await snapshotPricingOnConfirmation(businessId, bookingId, now, today)

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

  const today = todayIn(env().APP_TIMEZONE, now)
  await setAvailabilityChecked(
    businessId,
    admin.id,
    admin.name,
    bookingId,
    formData.get('value') === 'true',
    now,
    today
  )

  await generateVisitsOnConfirmation(businessId, admin.id, admin.name, bookingId, today)
  await snapshotPricingOnConfirmation(businessId, bookingId, now, today)

  revalidatePath(`/bookings/${bookingId}`)
}

/**
 * Freeze the pricing components once a booking is confirmed.
 *
 * Beside visit generation, and for the same reason: either flag can be the
 * one that completes confirmation, so this asks the derived status rather
 * than assuming which action ran.
 */
async function snapshotPricingOnConfirmation(
  businessId: string,
  bookingId: string,
  now: Date,
  today: CalendarDate
): Promise<void> {
  const { getBooking } = await import('@/db/repositories/bookings')
  const { deriveStatus } = await import('@/core/status')
  const { toBookingCore } = await import('@/services/home')

  const booking = await getBooking(businessId, bookingId)
  if (booking === null) return
  const status = deriveStatus(toBookingCore(booking), today)
  if (status !== 'confirmed' && status !== 'in_progress') return

  await snapshotPricing(businessId, bookingId, now)
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
