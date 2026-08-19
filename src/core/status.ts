/**
 * Booking status derivation.
 *
 * PURE. No clock, no environment, no input or output. Today is an argument.
 *
 * There is no status column on bookings and there never will be. This
 * function is the single source of truth: every surface that displays a
 * status calls it, and no surface computes one inline, caches one, or
 * persists one. See AGENTS.md, "Booking status is derived, never stored".
 *
 * The reason is that four of the eight statuses depend on today's date. A
 * stored status would be correct at write time and wrong the next morning,
 * and nothing in the system would notice.
 */

import { isWithinRange, compareDates } from './dates'
import type { BookingCore, BookingStatus, CalendarDate } from './types'

/**
 * The status of a booking as of `today`.
 *
 * Conditions are evaluated in a fixed order and the FIRST MATCH WINS. The
 * order is not incidental — it encodes precedence that the individual
 * conditions do not. A cancelled booking is cancelled even when its dates
 * are firm, its availability is checked, and its range is in the future.
 * A declined booking is declined even when it has been paid for.
 *
 * The order below mirrors the derivation table in tasks/phase-0.md exactly,
 * one branch per row. Do not reorder it, and do not collapse branches that
 * happen to produce the same value today.
 */
export function deriveStatus(booking: BookingCore, today: CalendarDate): BookingStatus {
  // 1 — Cancelled outranks everything, including both confirmation flags.
  if (booking.cancelledAt !== null) return 'cancelled'

  // 2 — Declined outranks completion and payment.
  if (booking.declinedAt !== null) return 'declined'

  // 3 — Without both ends of the range there is nothing to schedule or bill.
  if (booking.startDate === null || booking.endDate === null) return 'inquiry'

  // 4 — Either confirmation flag missing means it is not yet committed to.
  //     Both flags are set from here down.
  if (booking.datesFirmAt === null || booking.availabilityCheckedAt === null) {
    return 'tentative'
  }

  const endedBeforeToday = compareDates(booking.endDate, today) < 0

  // 5 — Finished and paid. Checked before `complete`, which it outranks.
  if (endedBeforeToday && booking.paidAt !== null) return 'closed'

  // 6 — Finished, not yet paid.
  if (endedBeforeToday) return 'complete'

  // 7 — Today falls inside the range, inclusive at both ends.
  if (isWithinRange(today, booking.startDate, booking.endDate)) return 'in_progress'

  // 8 — Committed to, and the range has not started.
  return 'confirmed'
}
