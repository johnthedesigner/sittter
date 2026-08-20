/**
 * The admin home screen's data.
 *
 * "Today" and "needs attention" are defined in `docs/spec.md` §5.11 for the
 * daily digest, and `src/core/digest.ts` already computes both — including
 * the three attention rules: an unlogged past visit, a missing confirmation
 * flag, and a booking starting within seven days that is not confirmed.
 *
 * So this reuses `buildDigestModel` rather than writing a second definition
 * of what needs attention. The home screen and the morning email will always
 * agree, because there is one rule, not two that drift.
 *
 * Weather is passed as null: it arrives in Phase 6, and `buildDigestModel`
 * omits the section when there is none.
 */

import { buildDigestModel } from '@/core/digest'
import { deriveStatus } from '@/core/status'
import type { DigestBookingInput, DigestVisitLog } from '@/core/digest'
import type { BookingCore, CalendarDate, CareInstruction, VisitCore } from '@/core/types'
import type { DigestAttentionItem, DigestBookingBlock } from '@/core/types'

import { listBookingSummaries } from '@/db/repositories/bookings'
import type { Booking, BookingSummary } from '@/db/repositories/bookings'
import { listCareInstructionsForProperties } from '@/db/repositories/care-instructions'
import { listVisitLogsForVisits } from '@/db/repositories/visit-logs'
import { listVisitsForBookings } from '@/db/repositories/visits'

/**
 * Map a database row to the pure layer's booking shape.
 *
 * The row carries `Date` objects for instants and strings for calendar
 * dates. `src/core/` wants ISO strings for instants and `CalendarDate` for
 * dates, and the branding is only meaningful once the value has been through
 * the database's `date` column — which guarantees the format.
 */
export function toBookingCore(row: Booking): BookingCore {
  return {
    id: row.id,
    startDate: (row.startDate as CalendarDate | null) ?? null,
    endDate: (row.endDate as CalendarDate | null) ?? null,
    datesApproximate: row.datesApproximate,
    datesFirmAt: row.datesFirmAt?.toISOString() ?? null,
    availabilityCheckedAt: row.availabilityCheckedAt?.toISOString() ?? null,
    declinedAt: row.declinedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    paidAt: (row.paidAt as CalendarDate | null) ?? null,
    dayCountOverride: row.dayCountOverride,
    visitCountOverride: row.visitCountOverride,
  }
}

export interface HomeModel {
  today: CalendarDate
  /** One block per booking that has both dates. */
  bookings: DigestBookingBlock[]
  attention: DigestAttentionItem[]
  isEmpty: boolean
}

/**
 * A booking is dropped from the home screen once it is cancelled or declined.
 *
 * `buildDigestModel` deliberately does not decide this — its doc comment says
 * filtering to active bookings is the caller's job, because deciding what
 * belongs in a digest is service logic. This is that caller.
 */
function isActive(booking: BookingCore, today: CalendarDate): boolean {
  const status = deriveStatus(booking, today)
  return status !== 'cancelled' && status !== 'declined' && status !== 'closed'
}

export async function buildHomeModel(businessId: string, today: CalendarDate): Promise<HomeModel> {
  const summaries = await listBookingSummaries(businessId)
  const active = summaries.filter((s) => isActive(toBookingCore(s.booking), today))

  const bookingIds = active.map((s) => s.booking.id)
  const propertyIds = [...new Set(active.map((s) => s.booking.propertyId))]

  const visitRows = await listVisitsForBookings(businessId, bookingIds)
  const logRows = await listVisitLogsForVisits(
    businessId,
    visitRows.map((v) => v.id)
  )
  const instructionRows = await listCareInstructionsForProperties(businessId, propertyIds)

  const inputs: DigestBookingInput[] = active.map((summary: BookingSummary) => {
    const forBooking = visitRows.filter((v) => v.bookingId === summary.booking.id)
    const visitIds = new Set(forBooking.map((v) => v.id))

    const visits: VisitCore[] = forBooking.map((v) => ({
      id: v.id,
      date: v.visitDate as CalendarDate,
      window: v.window,
      durationMinutes: v.durationMinutes,
      taskIds: [],
    }))

    const logs: DigestVisitLog[] = logRows
      .filter((l) => visitIds.has(l.visitId))
      .map((l) => ({ visitId: l.visitId, outcome: l.outcome, note: l.note }))

    const instructions: CareInstruction[] = instructionRows
      .filter((i) => i.propertyId === summary.booking.propertyId)
      .map((i) => ({
        id: i.id,
        label: i.label,
        detail: i.detail,
        cadence: i.cadence,
        cadenceCustom: i.cadenceCustom,
        weatherRelevant: i.weatherRelevant,
        sortOrder: i.sortOrder,
      }))

    return {
      booking: toBookingCore(summary.booking),
      propertyNickname: summary.propertyNickname,
      customerName: summary.customerName,
      visits,
      logs,
      instructions,
      // Phase 6. buildDigestModel omits the section when there is none.
      weather: null,
    }
  })

  const model = buildDigestModel({ today, bookings: inputs })

  return {
    today: model.date,
    bookings: model.bookings,
    attention: model.attention,
    isEmpty: model.isEmpty,
  }
}
