/**
 * The pricing engine.
 *
 * PURE. No clock, no environment, no input or output.
 *
 * MONEY IS INTEGER CENTS. Every amount this module produces is a whole
 * number of cents, and no floating point arithmetic touches a currency
 * value. See AGENTS.md, "Value representation is fixed".
 *
 * The one place dollars appear is the `basis` string on a line item, which
 * is a display artifact `docs/dev-plan.md` §6 defines that way ("7 days at
 * $5.00"). It is rendered from integer cents by integer division, never by
 * dividing into a float and formatting the result.
 */

import { daysBetween } from './dates'
import type {
  AdhocLineItem,
  BookingCore,
  LineItem,
  PricedBooking,
  PricingComponent,
  VisitCore,
} from './types'

export interface PricingInput {
  booking: BookingCore
  /** The booking's visits. Drives the visit count and the summed durations. */
  visits: readonly VisitCore[]
  components: readonly PricingComponent[]
  adhocItems: readonly AdhocLineItem[]
}

const MINUTES_PER_HOUR = 60

/**
 * Render integer cents as dollars for a basis string.
 *
 * Integer division only. `cents / 100` would introduce a float into a
 * currency value, which AGENTS.md forbids, and would render 1999 cents as
 * "19.990000000000002" often enough to matter.
 */
function formatDollars(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  const dollars = Math.floor(absolute / 100)
  const remainder = absolute % 100
  return `${sign}$${dollars}.${String(remainder).padStart(2, '0')}`
}

/** "1 day" / "7 days", so a basis never reads "1 days". */
function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Hours as a readable number: 2, not 2.00; 2.5, not 2.50. */
function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 100) / 100)
}

/** Total logged minutes across visits. Null durations contribute nothing. */
function totalVisitMinutes(visits: readonly VisitCore[]): number {
  let total = 0
  for (const visit of visits) {
    if (visit.durationMinutes !== null) total += visit.durationMinutes
  }
  return total
}

/**
 * The quantity, unit price, basis, and amount for one component.
 *
 * Returns null when the component does not apply to this booking — zero
 * days, zero visits, or no recorded durations. A component that does not
 * apply produces NO line item rather than a zero-amount one, because a row
 * reading "0 visits at $6.00 — $0.00" is noise on an invoice a customer
 * reads.
 */
function priceComponent(
  component: PricingComponent,
  dayCount: number,
  visitCount: number,
  minutes: number
): LineItem | null {
  const unit = component.amountCents

  switch (component.type) {
    case 'per_day': {
      if (dayCount === 0) return null
      return {
        label: component.label,
        basis: `${pluralize(dayCount, 'day', 'days')} at ${formatDollars(unit)}`,
        quantity: dayCount,
        unitAmountCents: unit,
        amountCents: dayCount * unit,
        source: 'component',
      }
    }

    case 'per_visit': {
      if (visitCount === 0) return null
      return {
        label: component.label,
        basis: `${pluralize(visitCount, 'visit', 'visits')} at ${formatDollars(unit)}`,
        quantity: visitCount,
        unitAmountCents: unit,
        amountCents: visitCount * unit,
        source: 'component',
      }
    }

    case 'per_hour': {
      if (minutes === 0) return null
      const hours = minutes / MINUTES_PER_HOUR
      // Multiply in integer cents first, divide once, then round. The
      // product is exact; rounding immediately keeps the result a whole
      // number of cents without a float ever being stored as money.
      const amountCents = Math.round((minutes * unit) / MINUTES_PER_HOUR)
      return {
        label: component.label,
        basis: `${formatHours(hours)} ${hours === 1 ? 'hour' : 'hours'} at ${formatDollars(unit)}`,
        quantity: hours,
        unitAmountCents: unit,
        amountCents,
        source: 'component',
      }
    }

    case 'flat': {
      return {
        label: component.label,
        basis: `Flat rate of ${formatDollars(unit)}`,
        quantity: 1,
        unitAmountCents: unit,
        amountCents: unit,
        source: 'component',
      }
    }

    case 'custom': {
      return {
        label: component.label,
        basis: `Custom charge of ${formatDollars(unit)}`,
        quantity: 1,
        unitAmountCents: unit,
        amountCents: unit,
        source: 'component',
      }
    }
  }
}

/**
 * Price a booking into an itemized list and a total, in integer cents.
 *
 * Counts:
 *   dayCount   every calendar day in the service range, counted inclusively,
 *              INCLUDING days with no visit. A booking running the first to
 *              the seventh is seven days whether it had two visits or ten.
 *   visitCount the number of visits.
 *
 * Either may be overridden on the booking. An override is used verbatim and
 * the corresponding `...WasOverridden` flag is set, so a surface can show
 * that a human changed the number rather than the range having changed.
 *
 * Ordering: components by `sortOrder`, then ad-hoc items by `sortOrder`.
 * Ad-hoc items come last because they are adjustments to a computed price,
 * and reading them after the thing they adjust is how an invoice is read.
 */
export function priceBooking(input: PricingInput): PricedBooking {
  const { booking, visits, components, adhocItems } = input

  const dayCountWasOverridden = booking.dayCountOverride !== null
  const visitCountWasOverridden = booking.visitCountOverride !== null

  const derivedDayCount =
    booking.startDate !== null && booking.endDate !== null
      ? daysBetween(booking.startDate, booking.endDate)
      : 0

  const dayCount = booking.dayCountOverride ?? derivedDayCount
  const visitCount = booking.visitCountOverride ?? visits.length
  const minutes = totalVisitMinutes(visits)

  const lineItems: LineItem[] = []

  for (const component of [...components].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const item = priceComponent(component, dayCount, visitCount, minutes)
    if (item !== null) lineItems.push(item)
  }

  // Ad-hoc items are always included, including negative ones: a discount or
  // a correction is a deliberate entry and suppressing it would hide it.
  for (const adhoc of [...adhocItems].sort((a, b) => a.sortOrder - b.sortOrder)) {
    lineItems.push({
      label: adhoc.label,
      basis: 'One-time',
      quantity: 1,
      unitAmountCents: adhoc.amountCents,
      amountCents: adhoc.amountCents,
      source: 'adhoc',
    })
  }

  let totalCents = 0
  for (const item of lineItems) totalCents += item.amountCents

  return {
    lineItems,
    totalCents,
    dayCount,
    visitCount,
    dayCountWasOverridden,
    visitCountWasOverridden,
  }
}
