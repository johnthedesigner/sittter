/**
 * Booking orchestration.
 *
 * Reads repositories, composes `src/core/` calculations, and writes activity
 * entries. Route handlers and server actions call this; they do not talk to
 * the database themselves.
 *
 * EVERY STATE CHANGE RECORDS THE ACTING ADMIN. `docs/spec.md` §6.2 calls
 * attribution the accountability mechanism that replaces permissions, and
 * there is no role model to fall back on. Every function here takes
 * `actingAdminId` and every write uses it.
 */

import { compareDates, isValidCalendarDate } from '@/core/dates'
import type { CalendarDate } from '@/core/types'

import { createActivityEntry } from '@/db/repositories/activity'
import { createBooking as createBookingRow } from '@/db/repositories/bookings'
import { createCustomer } from '@/db/repositories/customers'
import { createProperty, listPropertiesForCustomer } from '@/db/repositories/properties'

/** Default nickname for the property created alongside a brand-new customer. */
export const DEFAULT_PROPERTY_NICKNAME = 'Home'

export interface CaptureInput {
  /** An existing customer, or null when creating one from a typed name. */
  customerId: string | null
  newCustomerName: string | null
  /** An existing property of that customer, or null to create one. */
  propertyId: string | null
  newPropertyNickname: string | null
  startDate: string | null
  endDate: string | null
  datesApproximate: boolean
  note: string | null
}

export class CaptureError extends Error {}

/**
 * Validate capture input before anything is written.
 *
 * Returns the problem as a sentence a person can act on, or null. The
 * database has a `range_ordered` check constraint as a backstop, but a
 * constraint violation is not an error message — a user must never be the one
 * who discovers it.
 */
export function validateCapture(input: CaptureInput): string | null {
  const hasCustomer =
    (input.customerId !== null && input.customerId.length > 0) ||
    (input.newCustomerName !== null && input.newCustomerName.trim().length > 0)
  if (!hasCustomer) return 'A customer name is required.'

  for (const [label, value] of [
    ['start date', input.startDate],
    ['end date', input.endDate],
  ] as const) {
    if (value !== null && value.length > 0 && !isValidCalendarDate(value)) {
      return `That ${label} is not a real date.`
    }
  }

  if (
    input.startDate !== null &&
    input.startDate.length > 0 &&
    input.endDate !== null &&
    input.endDate.length > 0 &&
    compareDates(input.startDate as CalendarDate, input.endDate as CalendarDate) > 0
  ) {
    return 'The end date cannot be before the start date.'
  }

  return null
}

export interface CaptureResult {
  bookingId: string
  customerId: string
  propertyId: string
}

/**
 * Fast capture: create the booking, and the customer and property if needed.
 *
 * The only required field is a customer name. A customer created this way has
 * a name and nothing else, and that record is valid in that state — spec §5.1
 * is explicit about it, because the point is to record the job before the
 * admin forgets it, not to collect a complete record.
 */
export async function captureBooking(
  businessId: string,
  actingAdminId: string,
  actingAdminName: string,
  input: CaptureInput,
  today: CalendarDate
): Promise<CaptureResult> {
  const problem = validateCapture(input)
  if (problem !== null) throw new CaptureError(problem)

  const customerId =
    input.customerId !== null && input.customerId.length > 0
      ? input.customerId
      : (await createCustomer(businessId, { name: input.newCustomerName!.trim() })).id

  let propertyId: string
  if (input.propertyId !== null && input.propertyId.length > 0) {
    propertyId = input.propertyId
  } else {
    const nickname =
      input.newPropertyNickname !== null && input.newPropertyNickname.trim().length > 0
        ? input.newPropertyNickname.trim()
        : DEFAULT_PROPERTY_NICKNAME
    propertyId = (await createProperty(businessId, { customerId, nickname })).id
  }

  const startDate = input.startDate !== null && input.startDate.length > 0 ? input.startDate : null
  const endDate = input.endDate !== null && input.endDate.length > 0 ? input.endDate : null

  const booking = await createBookingRow(businessId, {
    propertyId,
    startDate,
    endDate,
    // Only meaningful once there are dates. Spec §5.1 defaults it on.
    datesApproximate: startDate !== null || endDate !== null ? input.datesApproximate : true,
    createdBy: actingAdminId,
  })

  // The note goes in FIRST, so it is the first entry in the log — spec §5.1.
  // `admin capture` in the spec has no matching enum value; `tasks/phase-2.md`
  // Reference data resolves it to `app` with is_system false.
  if (input.note !== null && input.note.trim().length > 0) {
    await createActivityEntry(businessId, {
      bookingId: booking.id,
      note: input.note.trim(),
      source: 'app',
      entryDate: today,
      actorId: actingAdminId,
      isSystem: false,
    })
  }

  await createActivityEntry(businessId, {
    bookingId: booking.id,
    note: `${actingAdminName} created this booking.`,
    source: 'app',
    entryDate: today,
    actorId: actingAdminId,
    isSystem: true,
  })

  return { bookingId: booking.id, customerId, propertyId }
}

/** Properties belonging to a customer, for the capture form's property select. */
export async function propertiesForCustomer(businessId: string, customerId: string) {
  return listPropertiesForCustomer(businessId, customerId)
}
