import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { todayIn } from '@/core/dates'
import { deriveStatus } from '@/core/status'
import { toCustomerFacingLabel } from '@/core/presentation'
import type { CalendarDate } from '@/core/types'
import { getBookingForPortal, listBookingsForPortal } from '@/db/repositories/bookings'
import type { PortalBooking } from '@/db/repositories/bookings'
import { getCustomerForPortal } from '@/db/repositories/customers'
import { getOnlyBusiness } from '@/db/repositories/businesses'
import { formatRange } from '@/components/format'
import { rateLimit, slugResolutionKey } from '@/lib/rate-limit'
import { env } from '@/lib/env'
import { resolveSlug } from '@/services/links'

/**
 * Slug resolution and dispatch — the first surface in this application
 * reachable by someone who is not signed in.
 *
 * NOTHING HERE CALLS `requireAdmin()`, and nothing renders the admin shell.
 *
 * Every failure produces the SAME response: `notFound()`, rendering
 * `not-found.tsx` with a 404. A slug that never existed, an expired one, a
 * revoked one, and one belonging to another business are indistinguishable
 * from outside. `resolveSlug` already collapses them; this route must not
 * un-collapse them.
 *
 * The URL stays `/s/<slug>`, per `docs/spec.md` §6.1 — the link a customer
 * was sent is the link they can bookmark, so the content renders here rather
 * than redirecting somewhere else.
 *
 * WHAT IS BUILT SO FAR: dispatch, the invalid-link page, and a read-only view
 * of what a link resolves to. Task 3.3 turns the booking-form view into an
 * editable form; Task 3.4 fills out the portal with care instructions, costs,
 * past engagements, and the business copy blocks.
 */

async function callerAddress(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded !== null && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }
  return h.get('x-real-ip') ?? 'unknown'
}

/** A portal row carries no actor columns, so status is safe to derive here. */
function statusLabelFor(booking: PortalBooking, today: CalendarDate): string {
  const core = {
    id: booking.id,
    startDate: (booking.startDate as CalendarDate | null) ?? null,
    endDate: (booking.endDate as CalendarDate | null) ?? null,
    datesApproximate: booking.datesApproximate,
    datesFirmAt: booking.datesFirmAt?.toISOString() ?? null,
    availabilityCheckedAt: booking.availabilityCheckedAt?.toISOString() ?? null,
    declinedAt: booking.declinedAt?.toISOString() ?? null,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    paidAt: (booking.paidAt as CalendarDate | null) ?? null,
    dayCountOverride: booking.dayCountOverride,
    visitCountOverride: booking.visitCountOverride,
  }
  // Internal status names are never rendered on a customer surface.
  return toCustomerFacingLabel(deriveStatus(core, today), core)
}

function Engagement({ booking, today }: { booking: PortalBooking; today: CalendarDate }) {
  return (
    <li
      data-testid="portal-engagement"
      data-booking-id={booking.id}
      className="rounded-md border border-stone-200 bg-white p-4"
    >
      <p className="font-medium">{booking.propertyNickname}</p>
      <p className="mt-1 text-sm text-stone-600" data-testid="portal-range">
        {formatRange(booking.startDate, booking.endDate)}
        {booking.datesApproximate && booking.startDate !== null && ' (approximate)'}
      </p>
      <p className="mt-2 text-sm font-medium" data-testid="portal-status">
        {statusLabelFor(booking, today)}
      </p>
    </li>
  )
}

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const now = new Date()
  const today = todayIn(env().APP_TIMEZONE, now)

  // Rate limited before anything is looked up, so this route cannot be used
  // to probe at all.
  const limit = await rateLimit(slugResolutionKey(await callerAddress()), now)
  if (!limit.allowed) redirect('/s-too-many')

  const business = await getOnlyBusiness()
  if (business === null) notFound()

  const resolution = await resolveSlug(business.id, slug, now, today)

  if (resolution.kind === 'invalid') notFound()

  if (resolution.kind === 'public_intake') redirect('/new')

  if (resolution.kind === 'booking_form') {
    const booking = await getBookingForPortal(business.id, resolution.bookingId)
    if (booking === null) notFound()

    return (
      <main className="mx-auto max-w-md px-6 py-12" data-testid="booking-form-view">
        <h1 className="text-2xl font-semibold tracking-tight">Your booking request</h1>
        <ul className="mt-6 flex flex-col gap-3">
          <Engagement booking={booking} today={today} />
        </ul>
      </main>
    )
  }

  const customer = await getCustomerForPortal(business.id, resolution.customerId)
  if (customer === null) notFound()

  const bookings = await listBookingsForPortal(business.id, resolution.customerId)
  const upcoming = bookings.filter((b) => b.endDate === null || b.endDate >= today)
  const past = bookings.filter((b) => b.endDate !== null && b.endDate < today)

  return (
    <main className="mx-auto max-w-md px-6 py-12" data-testid="portal-view">
      <h1 className="text-2xl font-semibold tracking-tight" data-testid="portal-customer">
        {customer.name}
      </h1>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Upcoming</h2>
      {upcoming.length === 0 ? (
        <p className="mt-2 text-sm text-stone-600" data-testid="portal-no-upcoming">
          Nothing coming up.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {upcoming.map((b) => (
            <Engagement key={b.id} booking={b} today={today} />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold tracking-tight">Past</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {past.map((b) => (
              <Engagement key={b.id} booking={b} today={today} />
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
