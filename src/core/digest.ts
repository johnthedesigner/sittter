/**
 * Daily digest model composition.
 *
 * PURE. No clock, no environment, no input or output. Today is an argument
 * and weather arrives already fetched.
 *
 * This decides WHAT THE EMAIL SAYS. Rendering it to HTML, choosing a subject
 * line, and deciding whether to send at all are Phase 6 concerns.
 */

import { compareDates, daysBetween, expandRange, isWithinRange } from './dates'
import { truncateNote } from './presentation'
import { deriveStatus } from './status'
import type {
  BookingCore,
  CalendarDate,
  CareInstruction,
  DigestAttentionItem,
  DigestBookingBlock,
  DigestModel,
  DigestTimelineDay,
  DigestWeather,
  VisitCore,
} from './types'

/** A visit log as the digest needs it. Keyed to its visit by identifier. */
export interface DigestVisitLog {
  visitId: string
  outcome: string
  note: string | null
}

export interface DigestBookingInput {
  booking: BookingCore
  propertyNickname: string
  customerName: string
  visits: readonly VisitCore[]
  logs: readonly DigestVisitLog[]
  instructions: readonly CareInstruction[]
  /** Already fetched. Ignored unless an instruction is weather-relevant. */
  weather: DigestWeather | null
}

export interface DigestInput {
  today: CalendarDate
  /**
   * The bookings the digest should cover.
   *
   * Filtering to active bookings is the CALLER'S job. This function reports
   * on what it is given and does not decide what belongs in a digest, which
   * is Phase 6 service logic.
   */
  bookings: readonly DigestBookingInput[]
}

/** A booking starting this many days out or sooner is "starting soon". */
const STARTS_SOON_WITHIN_DAYS = 7

function bookingHref(bookingId: string): string {
  return `/bookings/${bookingId}`
}

/** Days from today until `date`. Today is 0, tomorrow is 1. */
function daysUntil(today: CalendarDate, date: CalendarDate): number {
  return daysBetween(today, date) - 1
}

function positionOf(date: CalendarDate, today: CalendarDate): DigestTimelineDay['position'] {
  const order = compareDates(date, today)
  if (order < 0) return 'past'
  if (order > 0) return 'future'
  return 'today'
}

/**
 * One row per calendar day of the service range, in order.
 *
 * A future day carries no outcome and no summary even if a log somehow
 * exists for it — the email must not report on something that has not
 * happened, and a stray log is data to fix rather than to render.
 */
function buildTimeline(
  startDate: CalendarDate,
  endDate: CalendarDate,
  today: CalendarDate,
  visitsByDate: Map<CalendarDate, VisitCore>,
  logsByVisitId: Map<string, DigestVisitLog>
): DigestTimelineDay[] {
  return expandRange(startDate, endDate).map((date) => {
    const position = positionOf(date, today)
    const visit = visitsByDate.get(date)
    const log = visit === undefined ? undefined : logsByVisitId.get(visit.id)
    const reportable = position !== 'future' && log !== undefined

    return {
      date,
      position,
      hasVisit: visit !== undefined,
      logged: reportable,
      outcome: reportable ? log.outcome : null,
      summary: reportable && log.note !== null ? truncateNote(log.note) : null,
    }
  })
}

/**
 * What needs a human's attention on this booking.
 *
 * The language is deliberately plain rather than accusatory: these are
 * nudges in an email someone reads over coffee, not a defect list.
 */
function buildAttention(
  input: DigestBookingInput,
  today: CalendarDate,
  visitsByDate: Map<CalendarDate, VisitCore>,
  logsByVisitId: Map<string, DigestVisitLog>
): DigestAttentionItem[] {
  const { booking, propertyNickname, customerName } = input
  const items: DigestAttentionItem[] = []
  const href = bookingHref(booking.id)

  // A visit that has already happened and was never written up.
  for (const [date, visit] of visitsByDate) {
    if (compareDates(date, today) >= 0) continue
    if (logsByVisitId.has(visit.id)) continue
    items.push({
      kind: 'unlogged_visit',
      bookingId: booking.id,
      label: `${propertyNickname} — the ${date} visit has not been logged yet`,
      href,
    })
  }

  if (booking.datesFirmAt === null) {
    items.push({
      kind: 'missing_dates_firm',
      bookingId: booking.id,
      label: `${propertyNickname} — waiting on ${customerName} to confirm the dates`,
      href,
    })
  }

  if (booking.availabilityCheckedAt === null) {
    items.push({
      kind: 'missing_availability_check',
      bookingId: booking.id,
      label: `${propertyNickname} — check the family calendar before committing`,
      href,
    })
  }

  // Starting soon and still not committed to.
  if (booking.startDate !== null) {
    const until = daysUntil(today, booking.startDate)
    const status = deriveStatus(booking, today)
    if (until >= 0 && until <= STARTS_SOON_WITHIN_DAYS && status === 'tentative') {
      items.push({
        kind: 'starts_soon_unconfirmed',
        bookingId: booking.id,
        label:
          until === 0
            ? `${propertyNickname} — starts today and is not confirmed`
            : `${propertyNickname} — starts in ${until} ${until === 1 ? 'day' : 'days'} and is not confirmed`,
        href,
      })
    }
  }

  return items
}

/**
 * Assemble the daily digest as data.
 *
 * A booking produces a block only when it has BOTH a start and an end date,
 * because a block is built around a timeline and there is no range to expand
 * without them. A booking still at the inquiry stage therefore contributes
 * attention items but no block — which is exactly how a digest can be
 * non-empty while containing no bookings.
 *
 * Weather appears on a block only when at least one of that booking's care
 * instructions is weather-relevant. Weather is supplied either way; whether
 * it is worth saying is decided here, so the caller need not know the rule.
 */
export function buildDigestModel(input: DigestInput): DigestModel {
  const { today, bookings } = input

  const blocks: DigestBookingBlock[] = []
  const attention: DigestAttentionItem[] = []

  for (const entry of bookings) {
    const { booking, visits, logs, instructions, weather } = entry

    const visitsByDate = new Map<CalendarDate, VisitCore>()
    for (const visit of visits) visitsByDate.set(visit.date, visit)

    const logsByVisitId = new Map<string, DigestVisitLog>()
    for (const log of logs) logsByVisitId.set(log.visitId, log)

    attention.push(...buildAttention(entry, today, visitsByDate, logsByVisitId))

    if (booking.startDate === null || booking.endDate === null) continue

    const todayVisit = isWithinRange(today, booking.startDate, booking.endDate)
      ? (visitsByDate.get(today) ?? null)
      : null

    const labelsById = new Map(instructions.map((i) => [i.id, i.label]))
    const todayTasks =
      todayVisit === null
        ? []
        : todayVisit.taskIds
            .map((id) => labelsById.get(id))
            .filter((label): label is string => label !== undefined)

    const weatherMatters = instructions.some((i) => i.weatherRelevant)

    blocks.push({
      bookingId: booking.id,
      propertyNickname: entry.propertyNickname,
      customerName: entry.customerName,
      startDate: booking.startDate,
      endDate: booking.endDate,
      todayVisit,
      todayTasks,
      timeline: buildTimeline(
        booking.startDate,
        booking.endDate,
        today,
        visitsByDate,
        logsByVisitId
      ),
      weather: weatherMatters ? weather : null,
    })
  }

  return {
    date: today,
    bookings: blocks,
    attention,
    isEmpty: blocks.length === 0 && attention.length === 0,
  }
}
