/**
 * Translation from internal vocabulary into what a customer reads.
 *
 * PURE. No clock, no environment, no input or output.
 *
 * Internal status names are never rendered on a customer surface. There are
 * eight internal statuses and seven customer-facing ones, and the mapping is
 * deliberately lossy: a customer does not need to know whether a finished
 * engagement has been marked paid, and does not need to be told the
 * difference between a booking that was declined and one that was cancelled.
 */

import type { BookingCore, BookingStatus, CustomerFacingStatus } from './types'

/**
 * The customer-facing status for an internal one.
 *
 * `tentative` is the only internal status that does not map one to one. It
 * splits on which side is holding things up, which is the single most useful
 * thing the portal can tell someone:
 *
 *   datesFirmAt null → the customer has not confirmed their travel dates
 *                      → "Waiting on you"
 *   datesFirmAt set  → dates are firm, the business has not yet checked
 *                      availability → "Waiting on us"
 *
 * The booking is required rather than optional because getting this wrong
 * points the finger at the wrong party, and an optional argument makes that
 * mistake easy to make silently.
 */
export function toCustomerFacingStatus(
  status: BookingStatus,
  booking: BookingCore
): CustomerFacingStatus {
  switch (status) {
    case 'inquiry':
      return 'requested'
    case 'tentative':
      return booking.datesFirmAt === null ? 'waiting_on_you' : 'waiting_on_us'
    case 'confirmed':
      return 'confirmed'
    case 'in_progress':
      return 'in_progress'
    case 'complete':
      return 'complete'
    // A finished engagement reads the same whether or not it has been paid.
    case 'closed':
      return 'complete'
    // A customer is not told which side ended it.
    case 'declined':
      return 'cancelled'
    case 'cancelled':
      return 'cancelled'
  }
}

/**
 * The exact words a customer sees for each customer-facing status.
 *
 * This is the only place these strings are written. A surface that needs to
 * display a status reads from here rather than spelling the words again, so
 * that changing "Waiting on you" changes it everywhere at once.
 */
export const CUSTOMER_FACING_LABELS: Record<CustomerFacingStatus, string> = {
  requested: 'Requested',
  waiting_on_you: 'Waiting on you',
  waiting_on_us: 'Waiting on us',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  complete: 'Complete',
  cancelled: 'Cancelled',
}

/** The words a customer sees, straight from an internal status. */
export function toCustomerFacingLabel(status: BookingStatus, booking: BookingCore): string {
  return CUSTOMER_FACING_LABELS[toCustomerFacingStatus(status, booking)]
}

/** The character appended to a truncated note. One character, not three dots. */
const ELLIPSIS = '…'

/**
 * Shorten a note for a timeline summary, cutting at a word boundary.
 *
 * A note of `maxLength` characters or fewer is returned whole, with no
 * ellipsis — the ellipsis is a signal that something was removed, so adding
 * one to a complete note tells the reader a lie.
 *
 * A longer note is cut at the last whole word that fits within `maxLength`
 * and the ellipsis is appended, so the result is at most `maxLength + 1`
 * characters. Trailing whitespace is removed before appending, so the output
 * never reads "the dog …".
 *
 * A first word longer than `maxLength` has no word boundary to cut at, so it
 * is cut mid-word rather than returning an empty string.
 */
export function truncateNote(note: string, maxLength = 60): string {
  if (maxLength < 1) {
    throw new RangeError(`truncateNote needs a positive maxLength, received ${maxLength}.`)
  }
  if (note.length <= maxLength) return note

  const window = note.slice(0, maxLength)

  // When the character just past the window is a space, the window already
  // ends on a complete word and nothing needs trimming. Without this, a note
  // cut at exactly a word boundary loses its last whole word: 'one two' at
  // maxLength 7 would come back as 'one…'.
  if (note[maxLength] === ' ') return `${window.trimEnd()}${ELLIPSIS}`

  const lastSpace = window.lastIndexOf(' ')
  const cut = lastSpace > 0 ? window.slice(0, lastSpace) : window

  return `${cut.trimEnd()}${ELLIPSIS}`
}
