import { notFound } from 'next/navigation'

import { todayIn } from '@/core/dates'
import { deriveStatus } from '@/core/status'
import { getBookingSummary } from '@/db/repositories/bookings'
import { listActivityForBooking } from '@/db/repositories/activity'
import { listAdmins } from '@/db/repositories/admins'
import { toBookingCore } from '@/services/home'
import { StatusChip } from '@/components/StatusChip'
import { FlagIndicator } from '@/components/FlagIndicator'
import { formatAttribution, formatCalendarDate, formatRange } from '@/components/format'
import { ACTIVITY_SOURCE_LABELS } from '@/components/activity'
import { env } from '@/lib/env'

import { requireAdmin } from '../../layout'

/**
 * The booking detail screen.
 *
 * PARTIAL. Task 2.2 builds only what journey step 1.1.7 asserts — that the
 * screen loads after capture, shows the derived status, and shows the note as
 * the first activity entry. Task 2.3 adds the dates section and care
 * instructions, 2.4 the confirmation toggles, 2.5 visits, 2.6 pricing, and
 * 2.7 manual activity entry.
 */
export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { businessId } = await requireAdmin()
  const { id } = await params

  const summary = await getBookingSummary(businessId, id)
  if (summary === null) notFound()

  const [activity, admins] = await Promise.all([
    listActivityForBooking(businessId, id),
    listAdmins(businessId),
  ])
  const nameById = new Map(admins.map((a) => [a.id, a.name]))

  const today = todayIn(env().APP_TIMEZONE, new Date())
  const booking = summary.booking
  const status = deriveStatus(toBookingCore(booking), today)

  return (
    <main>
      <header>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="booking-customer">
          {summary.customerName}
        </h1>
        <p className="text-sm text-stone-600" data-testid="booking-property">
          {summary.propertyNickname}
        </p>
        <p className="mt-1 text-sm" data-testid="booking-range">
          {formatRange(booking.startDate, booking.endDate)}
          {booking.datesApproximate && (booking.startDate !== null || booking.endDate !== null) && (
            <span className="ml-2 text-stone-500">approximate</span>
          )}
        </p>
        <div className="mt-2">
          <StatusChip status={status} />
        </div>
        <div className="mt-2 flex gap-4">
          <FlagIndicator
            label="Dates firm"
            set={booking.datesFirmAt !== null}
            attribution={formatAttribution(
              'Set',
              nameById.get(booking.datesFirmBy ?? '') ?? 'an admin',
              booking.datesFirmAt?.toISOString() ?? null
            )}
          />
          <FlagIndicator
            label="Calendar checked"
            set={booking.availabilityCheckedAt !== null}
            attribution={formatAttribution(
              'Checked',
              nameById.get(booking.availabilityCheckedBy ?? '') ?? 'an admin',
              booking.availabilityCheckedAt?.toISOString() ?? null
            )}
          />
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        {activity.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {activity.map((entry) => (
              <li
                key={entry.id}
                data-testid="activity-entry"
                data-system={entry.isSystem ? 'true' : 'false'}
                className={`rounded-md border p-3 text-sm ${
                  entry.isSystem
                    ? 'border-stone-100 bg-stone-100 text-stone-600'
                    : 'border-stone-200 bg-white'
                }`}
              >
                <p>{entry.note}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {ACTIVITY_SOURCE_LABELS[entry.source]} · {formatCalendarDate(entry.entryDate)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
